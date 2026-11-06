"""Outbound network safety helpers.

Scraping and browsing accept user-supplied URLs, so every fetch is checked for
SSRF: scheme allowlist, DNS resolution, and rejection of private/loopback/
link-local/reserved ranges. An optional domain allowlist adds tenant policy.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

from app.config import settings


class UnsafeURLError(ValueError):
    pass


def _is_public_ip(value: str) -> bool:
    ip = ipaddress.ip_address(value)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


async def validate_public_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeURLError("Only http and https URLs are allowed.")
    if not parsed.hostname:
        raise UnsafeURLError("URL is missing a hostname.")
    if parsed.username or parsed.password:
        raise UnsafeURLError("Credentials in URLs are not allowed.")

    host = parsed.hostname.lower()
    allowlist = settings.allowed_scrape_domains
    if allowlist and not any(host == domain or host.endswith(f".{domain}") for domain in allowlist):
        raise UnsafeURLError(f"{host} is not in the allowed domains list.")

    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo, host, parsed.port or (443 if parsed.scheme == "https" else 80)
        )
    except socket.gaierror as exc:
        raise UnsafeURLError(f"Could not resolve {host}.") from exc

    if not addresses:
        raise UnsafeURLError(f"Could not resolve {host}.")
    for info in addresses:
        if not _is_public_ip(info[4][0]):
            raise UnsafeURLError("URL resolves to a private or reserved address.")

    # Rebuild without fragments so equivalent URLs dedupe correctly.
    return urlunparse(parsed._replace(fragment=""))
