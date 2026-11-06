"""Page fetching and content extraction used by browsing and Scraping Studio."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.logging import get_logger
from app.tools.base import Tool, ToolPermission, ToolResult
from app.tools.net import validate_public_url

logger = get_logger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124 Safari/537.36 ORBITO/0.1"
)


class FetchError(RuntimeError):
    pass


async def fetch_html(url: str, *, max_bytes: int = 3_000_000) -> tuple[str, str]:
    """Validate + fetch a public page. Returns (final_url, html)."""
    safe_url = await validate_public_url(url)
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    async with httpx.AsyncClient(
        timeout=settings.scraping_timeout, follow_redirects=True, headers=headers
    ) as client:
        async with client.stream("GET", safe_url) as response:
            if response.status_code >= 400:
                raise FetchError(f"HTTP {response.status_code} for {safe_url}")
            content_type = response.headers.get("content-type", "")
            if "html" not in content_type and "xml" not in content_type:
                raise FetchError(f"Unsupported content type: {content_type or 'unknown'}")
            chunks: list[bytes] = []
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    break
                chunks.append(chunk)
            return str(response.url), b"".join(chunks).decode(response.encoding or "utf-8", "ignore")


def clean_soup(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()
    return soup


def page_text(html: str, limit: int = 20_000) -> str:
    soup = clean_soup(html)
    for tag in soup(["nav", "footer", "header", "aside", "form"]):
        tag.decompose()
    text = re.sub(r"\n{3,}", "\n\n", soup.get_text("\n", strip=True))
    return text[:limit]


def page_meta(html: str, base_url: str) -> dict[str, Any]:
    soup = clean_soup(html)
    title = soup.title.get_text(strip=True) if soup.title else base_url
    description_tag = soup.find("meta", attrs={"name": "description"}) or soup.find(
        "meta", attrs={"property": "og:description"}
    )
    description = description_tag.get("content", "") if description_tag else ""
    headings = [h.get_text(" ", strip=True) for h in soup.select("h1, h2")][:20]
    links = []
    for anchor in soup.select("a[href]")[:80]:
        href = anchor.get("href", "")
        if href.startswith(("http://", "https://", "/")):
            links.append({"text": anchor.get_text(" ", strip=True)[:120], "url": urljoin(base_url, href)})
    return {
        "title": title,
        "description": description,
        "headings": headings,
        "links": links,
    }


def _selector_value(node: Any, spec: Any) -> Any:
    if node is None:
        return None
    attribute = "text"
    if isinstance(spec, dict):
        attribute = spec.get("attribute", "text")
    if attribute == "text":
        return node.get_text(" ", strip=True)
    if attribute == "html":
        return str(node)
    return node.get(attribute)


def extract_fields(html: str, base_url: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Extract a record using a user-supplied field → CSS selector schema.

    Supports either `"field": "css selector"` or
    `"field": {"selector": "...", "attribute": "href|src|text|html|..."}`.
    """
    soup = clean_soup(html)
    record: dict[str, Any] = {}
    for field, spec in (schema or {}).items():
        selector = spec.get("selector") if isinstance(spec, dict) else spec
        if not selector:
            record[field] = None
            continue
        nodes = soup.select(str(selector))
        if not nodes:
            record[field] = None
            continue
        values = [_selector_value(node, spec) for node in nodes]
        if isinstance(spec, dict) and spec.get("multiple"):
            record[field] = values
        else:
            record[field] = values[0] if len(values) == 1 else values
    record.setdefault("source_url", base_url)
    return record


class BrowserTool(Tool):
    name = "browser"
    description = "Fetch a public web page and return its readable text and metadata."
    permission = ToolPermission.AUTO
    timeout = 30.0

    async def run(self, url: str, **_: Any) -> ToolResult:
        try:
            final_url, html = await fetch_html(url)
        except Exception as exc:
            return ToolResult(ok=False, error=str(exc))
        meta = page_meta(html, final_url)
        text = page_text(html)
        return ToolResult(
            ok=True,
            summary=f"{meta['title']}\n\n{text[:1500]}",
            data={**meta, "url": final_url, "text": text},
            sources=[{"title": meta["title"], "url": final_url}],
        )


browser = BrowserTool()
