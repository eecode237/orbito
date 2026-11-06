"""Scraping engine — first-class, not a hidden tool.

Foundation capabilities: multi-URL jobs, same-origin depth crawl, CSS selector
schemas, auto extraction, progress + per-page errors, SSRF protection.
JavaScript rendering (Playwright) and sitemaps land in Phase 4.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin, urlparse

from app.config import settings
from app.db import repositories as repo
from app.logging import get_logger
from app.tools.browser import extract_fields, fetch_html, page_meta
from app.tools.net import validate_public_url

logger = get_logger(__name__)


def auto_schema() -> dict[str, Any]:
    return {
        "title": {"selector": "title"},
        "description": {"selector": 'meta[name="description"]', "attribute": "content"},
        "h1": {"selector": "h1"},
        "text": {"selector": "body"},
    }


def _same_origin(base: str, candidate: str) -> bool:
    a, b = urlparse(base), urlparse(candidate)
    return (a.scheme, a.netloc) == (b.scheme, b.netloc)


def discover_links(html: str, base_url: str, limit: int = 40) -> list[str]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    seen: set[str] = set()
    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        absolute = absolute.split("#", 1)[0]
        if not absolute.startswith(("http://", "https://")):
            continue
        if absolute in seen or not _same_origin(base_url, absolute):
            continue
        seen.add(absolute)
        links.append(absolute)
        if len(links) >= limit:
            return links
    return links


async def run_job(job_id: str) -> None:
    job = await repo.get_scraping_job(job_id)
    if not job:
        return

    urls = list(job.urls or [])
    auto = not job.schema_
    schema = job.schema_ or auto_schema()
    config = job.config or {}
    max_pages = min(int(config.get("max_pages") or settings.scraping_max_pages), 500)
    depth_limit = min(int(config.get("depth") or 0), settings.scraping_max_depth)
    follow_links = bool(config.get("follow_links", False))

    queue: list[tuple[str, int]] = [(url, 0) for url in urls]
    visited: set[str] = set()
    pages_done = 0
    errors: list[str] = []

    await repo.update_scraping_job(job_id, status="running", progress=2)

    while queue and pages_done < max_pages:
        url, depth = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            safe_url = await validate_public_url(url)
            final_url, html = await fetch_html(safe_url)
            record = extract_fields(html, final_url, schema)
            record.setdefault("depth", depth)

            if auto:
                meta = page_meta(html, final_url)
                record.update(
                    {
                        "title": meta["title"],
                        "description": meta["description"],
                        "h1": meta["headings"][:1],
                    }
                )

            await repo.add_scraping_result(job_id, final_url, record)
            pages_done += 1

            if follow_links and depth < depth_limit:
                for link in discover_links(html, final_url):
                    if link not in visited:
                        queue.append((link, depth + 1))
        except Exception as exc:
            errors.append(f"{url}: {exc}")
            logger.info("scrape failed for %s: %s", url, exc)

        progress = min(95, int((pages_done / max(1, min(max_pages, len(visited) + len(queue)))) * 100))
        await repo.update_scraping_job(
            job_id,
            progress=max(2, progress),
            pages_done=pages_done,
            error="; ".join(errors[-5:]) or None,
        )

    status = "completed" if pages_done else "failed"
    await repo.update_scraping_job(
        job_id,
        status=status,
        progress=100,
        pages_done=pages_done,
        error="; ".join(errors[-5:]) or None,
        finished_at=datetime.now(UTC),
    )
    logger.info("scrape job %s %s (%s pages)", job_id, status, pages_done)


def schedule_job(job_id: str) -> None:
    asyncio.create_task(run_job(job_id))
