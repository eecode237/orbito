"""Web search with graceful provider selection.

Order: Tavily (if key) → Serper (if key) → DuckDuckGo HTML → honest failure.
No fabricated results: when search is unavailable the caller is told so.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.logging import get_logger
from app.tools.base import Tool, ToolPermission, ToolResult

logger = get_logger(__name__)


class WebSearchTool(Tool):
    name = "web_search"
    description = "Search the public web and return ranked results with URLs."
    permission = ToolPermission.AUTO
    timeout = 20.0

    async def run(self, query: str, limit: int = 6, **_: Any) -> ToolResult:
        query = (query or "").strip()
        if not query:
            return ToolResult(ok=False, error="A search query is required.")

        try:
            if settings.tavily_api_key:
                results = await self._tavily(query, limit)
                provider = "tavily"
            elif settings.serper_api_key:
                results = await self._serper(query, limit)
                provider = "serper"
            else:
                results = await self._duckduckgo(query, limit)
                provider = "duckduckgo"
        except Exception as exc:
            logger.warning("web search failed: %s", exc)
            return ToolResult(
                ok=False,
                error=(
                    "Live web search is unavailable. Add TAVILY_API_KEY or SERPER_API_KEY "
                    "to .env for reliable search."
                ),
            )

        sources = [{"title": item["title"], "url": item["url"]} for item in results]
        lines = [f"- {item['title']} — {item['url']}" for item in results]
        return ToolResult(
            ok=True,
            summary="\n".join(lines) if lines else "No results found.",
            data={"query": query, "provider": provider, "results": results},
            sources=sources,
        )

    async def _tavily(self, query: str, limit: int) -> list[dict[str, str]]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": limit,
                    "search_depth": "basic",
                },
            )
            response.raise_for_status()
            payload = response.json()
        return [
            {
                "title": item.get("title", "Untitled"),
                "url": item.get("url", ""),
                "snippet": item.get("content", ""),
            }
            for item in payload.get("results", [])[:limit]
        ]

    async def _serper(self, query: str, limit: int) -> list[dict[str, str]]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": settings.serper_api_key or ""},
                json={"q": query, "num": limit},
            )
            response.raise_for_status()
            payload = response.json()
        return [
            {
                "title": item.get("title", "Untitled"),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            }
            for item in payload.get("organic", [])[:limit]
        ]

    async def _duckduckgo(self, query: str, limit: int) -> list[dict[str, str]]:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124 Safari/537.36"
            )
        }
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.post(
                "https://html.duckduckgo.com/html/", data={"q": query}, headers=headers
            )
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        results: list[dict[str, str]] = []
        for block in soup.select("div.result"):
            anchor = block.select_one("a.result__a")
            if not anchor:
                continue
            href = anchor.get("href", "")
            if "uddg=" in href:
                href = unquote(parse_qs(urlparse(href).query).get("uddg", [href])[0])
            snippet = block.select_one(".result__snippet")
            results.append(
                {
                    "title": anchor.get_text(" ", strip=True),
                    "url": href,
                    "snippet": snippet.get_text(" ", strip=True) if snippet else "",
                }
            )
            if len(results) >= limit:
                break
        if not results:
            raise RuntimeError("search provider returned no parseable results")
        return results


web_search = WebSearchTool()
