"""Public intelligence ingestors.

Two read-only, permission-aware feeds power the discovery experience:

* RSS headlines from publisher feeds. ORBITO stores titles, links and short
  summaries; it never republishes full articles.
* Public market snapshots (CoinGecko) for crypto prices and charts.

Both endpoints degrade honestly when an upstream is unreachable; they return
``reachable: false`` with the upstream error instead of fabricating data.
"""

from __future__ import annotations

import asyncio
import html
import re
import time
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/intel", tags=["intelligence"])

USER_AGENT = "ORBITO/0.1 (local intelligence reader; contact: local user)"

# Curated, publicly published RSS/Atom feeds. Adding a source here is a code
# review decision: it must be a feed the publisher offers for syndication.
FEEDS: dict[str, list[tuple[str, str]]] = {
    "ai": [
        ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
        ("VentureBeat AI", "https://venturebeat.com/category/ai/feed/"),
    ],
    "tech": [
        ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/technology-lab"),
        ("The Verge", "https://www.theverge.com/rss/tech/index.xml"),
    ],
    "crypto": [
        ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
        ("Cointelegraph", "https://cointelegraph.com/rss"),
    ],
    "finance": [
        ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ],
}

CATEGORIES = ("all", "ai", "tech", "crypto", "finance")
CACHE_SECONDS = 120
MARKET_CACHE_SECONDS = 90
CHART_CACHE_SECONDS = 600
# CoinGecko free tier is rate-limited; honor Retry-After/429 and serve stale
# cache rather than surfacing a hard error to the dashboard.
MARKET_MIN_INTERVAL = 2.0
MARKET_MAX_RETRIES = 2
MARKET_BACKOFF = 1.5

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _clean(value: str | None, limit: int = 260) -> str:
    if not value:
        return ""
    text = html.unescape(_TAG.sub(" ", value))
    text = _WS.sub(" ", text).strip()
    return text[:limit]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _child_text(node: ElementTree.Element, names: set[str]) -> str:
    for child in node:
        if _local_name(child.tag) in names:
            return child.text or ""
    return ""


def _atom_link(node: ElementTree.Element) -> str:
    for child in node:
        if _local_name(child.tag) == "link":
            href = child.attrib.get("href")
            if href:
                return href
            if child.text:
                return child.text.strip()
    return ""


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat()
    except (TypeError, ValueError):
        pass
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat()
    except ValueError:
        return None


def parse_feed(
    payload: bytes,
    *,
    source: str,
    category: str,
    limit: int,
) -> list[dict[str, Any]]:
    """Parse RSS 2.0 or Atom into normalized headline records."""
    try:
        root = ElementTree.fromstring(payload)
    except ElementTree.ParseError:
        return []

    nodes: list[ElementTree.Element] = []
    for node in root.iter():
        name = _local_name(node.tag)
        if name in {"item", "entry"}:
            nodes.append(node)

    articles: list[dict[str, Any]] = []
    for node in nodes[:limit]:
        title = _clean(_child_text(node, {"title"}), 220)
        link = _atom_link(node) or _child_text(node, {"link"})
        link = link.strip()
        if not title or not link.startswith(("http://", "https://")):
            continue
        summary = _clean(
            _child_text(node, {"description", "summary", "content", "encoded"}),
            300,
        )
        published = _parse_date(
            _child_text(node, {"pubdate", "published", "updated", "date"})
        )
        articles.append(
            {
                "id": f"{source}-{abs(hash((title, link)))}",
                "title": title,
                "url": link,
                "summary": summary,
                "source": source,
                "category": category,
                "published_at": published,
            }
        )
    return articles


class IntelCache:
    def __init__(self) -> None:
        self._news: dict[str, Any] = {}
        self._news_at = 0.0
        self._market: dict[str, Any] = {}
        self._market_at = 0.0
        self._market_next_ok = 0.0
        self._charts: dict[str, tuple[float, dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    async def _get_json(
        self, url: str, *, params: dict[str, str] | None = None
    ) -> tuple[bool, Any, str | None]:
        """Fetch JSON with 429-aware backoff. Returns (ok, data_or_None, error)."""
        last_err: str | None = None
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(12.0, connect=6.0),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            follow_redirects=True,
        ) as client:
            for attempt in range(MARKET_MAX_RETRIES + 1):
                try:
                    response = await client.get(url, params=params)
                    if response.status_code == 429:
                        retry = response.headers.get("Retry-After")
                        try:
                            wait = min(30.0, max(1.0, float(retry or MARKET_BACKOFF)))
                        except ValueError:
                            wait = MARKET_BACKOFF
                        self._market_next_ok = time.monotonic() + wait
                        last_err = "Public market API rate-limited (429). Showing cached data when available."
                        if attempt < MARKET_MAX_RETRIES:
                            await asyncio.sleep(wait)
                            continue
                        return False, None, last_err
                    response.raise_for_status()
                    return True, response.json(), None
                except Exception as exc:  # noqa: BLE001 - surfaced as data-source health
                    last_err = str(exc)[:180]
                    if attempt < MARKET_MAX_RETRIES:
                        await asyncio.sleep(MARKET_BACKOFF * (attempt + 1))
                        continue
        return False, None, last_err or "Request failed"

    async def news(self, category: str, limit: int) -> dict[str, Any]:
        key = f"{category}:{limit}"
        async with self._lock:
            cached = self._news.get(key)
            if cached and time.monotonic() - self._news_at < CACHE_SECONDS:
                return cached
            payload = await self._fetch_news(category, limit)
            self._news[key] = payload
            self._news_at = time.monotonic()
            return payload

    async def _fetch_news(self, category: str, limit: int) -> dict[str, Any]:
        selected = (
            [(name, url, cat) for cat, feeds in FEEDS.items() for name, url in feeds]
            if category == "all"
            else [(name, url, category) for name, url in FEEDS.get(category, [])]
        )
        if not selected:
            raise HTTPException(status_code=404, detail=f"Unknown news category: {category}")

        async with httpx.AsyncClient(
            timeout=8.0,
            headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"},
            follow_redirects=True,
        ) as client:
            async def fetch(name: str, url: str, cat: str):
                try:
                    response = await client.get(url)
                    response.raise_for_status()
                    items = parse_feed(response.content, source=name, category=cat, limit=limit)
                    return {
                        "name": name,
                        "category": cat,
                        "reachable": True,
                        "error": None,
                        "count": len(items),
                        "items": items,
                    }
                except Exception as exc:  # noqa: BLE001 - upstream errors are reported, not raised
                    return {
                        "name": name,
                        "category": cat,
                        "reachable": False,
                        "error": str(exc)[:180],
                        "count": 0,
                        "items": [],
                    }

            results = await asyncio.gather(*(fetch(*feed) for feed in selected))

        seen: set[str] = set()
        articles: list[dict[str, Any]] = []
        for result in results:
            for item in result.pop("items"):
                key = re.sub(r"[^a-z0-9]", "", item["title"].lower())[:90]
                if key in seen:
                    continue
                seen.add(key)
                articles.append(item)

        articles.sort(key=lambda item: item.get("published_at") or "", reverse=True)
        return {
            "category": category,
            "articles": articles[:limit],
            "sources": results,
            "reachable": any(result["reachable"] for result in results),
            "generated_at": datetime.now(UTC).isoformat(),
            "notice": "Headlines and links only. Full articles remain on the publisher's site.",
        }

    async def market(self) -> dict[str, Any]:
        async with self._lock:
            now = time.monotonic()
            if self._market and now - self._market_at < MARKET_CACHE_SECONDS:
                return self._market
            if now < self._market_next_ok and self._market:
                stale = {**self._market, "stale": True}
                return stale
            payload = await self._fetch_market()
            if payload.get("reachable"):
                self._market = payload
                self._market_at = time.monotonic()
                self._market_next_ok = time.monotonic() + MARKET_MIN_INTERVAL
                return payload
            # Upstream failed: serve stale cache if we have one, never invent prices.
            if self._market:
                stale = {
                    **self._market,
                    "reachable": True,
                    "stale": True,
                    "error": payload.get("error"),
                    "generated_at": self._market.get("generated_at"),
                }
                self._market_at = time.monotonic() - (MARKET_CACHE_SECONDS / 2)
                return stale
            self._market = payload
            self._market_at = time.monotonic()
            return payload

    async def _fetch_market(self) -> dict[str, Any]:
        url = "https://api.coingecko.com/api/v3/coins/markets"
        params = {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": "20",
            "page": "1",
            "sparkline": "true",
            "price_change_percentage": "24h",
        }
        ok, rows, err = await self._get_json(url, params=params)
        if not ok or not isinstance(rows, list):
            return {
                "reachable": False,
                "error": err,
                "currency": "usd",
                "assets": [],
                "generated_at": datetime.now(UTC).isoformat(),
                "provider": "CoinGecko public API",
                "stale": False,
            }
        assets = [
            {
                "id": row.get("id"),
                "symbol": (row.get("symbol") or "").upper(),
                "name": row.get("name"),
                "image": row.get("image"),
                "price_usd": row.get("current_price"),
                "market_cap_usd": row.get("market_cap"),
                "rank": row.get("market_cap_rank"),
                "volume_24h_usd": row.get("total_volume"),
                "change_24h_percent": row.get("price_change_percentage_24h"),
                "sparkline": (row.get("sparkline_in_7d") or {}).get("price", [])[-48:],
                "last_updated": row.get("last_updated"),
            }
            for row in rows
        ]
        return {
            "reachable": True,
            "error": None,
            "currency": "usd",
            "assets": assets,
            "generated_at": datetime.now(UTC).isoformat(),
            "provider": "CoinGecko public API",
            "stale": False,
        }

    async def chart(self, coin: str, days: int) -> dict[str, Any]:
        key = f"{coin}:{days}"
        async with self._lock:
            now = time.monotonic()
            cached = self._charts.get(key)
            if cached and now - cached[0] < CHART_CACHE_SECONDS:
                return cached[1]
            if cached and now < self._market_next_ok:
                return {**cached[1], "stale": True}

        url = f"https://api.coingecko.com/api/v3/coins/{coin}/market_chart"
        params = {
            "vs_currency": "usd",
            "days": str(days),
            "interval": "daily" if days > 1 else "hourly",
        }
        ok, payload, err = await self._get_json(url, params=params)
        if ok and isinstance(payload, dict):
            points = [
                {"t": int(timestamp), "price": price}
                for timestamp, price in payload.get("prices", [])
            ]
            result = {
                "reachable": True,
                "error": None,
                "coin": coin,
                "days": days,
                "currency": "usd",
                "points": points,
                "generated_at": datetime.now(UTC).isoformat(),
                "stale": False,
            }
        else:
            async with self._lock:
                cached = self._charts.get(key)
            if cached:
                result = {**cached[1], "reachable": True, "stale": True, "error": err}
            else:
                result = {
                    "reachable": False,
                    "error": err,
                    "coin": coin,
                    "days": days,
                    "currency": "usd",
                    "points": [],
                    "generated_at": datetime.now(UTC).isoformat(),
                    "stale": False,
                }

        async with self._lock:
            self._charts[key] = (time.monotonic(), result)
        return result


cache = IntelCache()


@router.get("/news")
async def news(
    category: str = Query("all", pattern="^(all|ai|tech|crypto|finance)$"),
    limit: int = Query(30, ge=1, le=80),
) -> dict[str, Any]:
    return await cache.news(category, limit)


@router.get("/sources")
async def sources() -> dict[str, Any]:
    return {
        "sources": [
            {"name": name, "url": url, "category": category}
            for category, feeds in FEEDS.items()
            for name, url in feeds
        ],
        "method": "RSS/Atom syndication",
    }


COIN_RE = r"^[a-z0-9-]{2,64}$"


@router.get("/markets/crypto")
async def crypto_market() -> dict[str, Any]:
    return await cache.market()


@router.get("/markets/crypto/{coin}/chart")
async def crypto_chart(
    coin: str,
    days: int = Query(7, ge=1, le=365),
) -> dict[str, Any]:
    if not re.match(COIN_RE, coin):
        raise HTTPException(status_code=400, detail="Invalid coin id")
    return await cache.chart(coin, days)
