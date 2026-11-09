"""Outbound HTTP connector for workflows.

Only the `http_request` action reaches this module, and only through the safety
gate (`authorize`) after a human approved the exact method, URL and body.

Guards applied before any byte leaves the machine:
- http/https only; no embedded credentials;
- every resolved address must be a public, globally routable address
  (loopback, private, link-local, multicast and reserved addresses are refused);
- redirects are not followed, so a public URL cannot bounce to a private one;
- a 15 s timeout and a 4000 character response cap;
- no caller-supplied headers. Secrets are never sent from workflow config.

Known limitation: DNS is resolved once for validation and again by the HTTP
client, so a hostile DNS server could in theory rebind between the two. The
attack needs control of DNS for a public name; pinning the validated address is
planned before connectors are used with untrusted workflows.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from typing import Any
from urllib.parse import urlsplit

import httpx

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
TIMEOUT_SECONDS = 15.0
MAX_RESPONSE_CHARS = 4000


class OutboundBlocked(Exception):
    """The destination or request was refused before sending."""


async def validate_outbound_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"}:
        raise OutboundBlocked("Only http and https URLs are allowed.")
    if not parts.hostname:
        raise OutboundBlocked("The URL has no host name.")
    if parts.username or parts.password:
        raise OutboundBlocked("URLs with embedded credentials are not allowed.")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            parts.hostname, port, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise OutboundBlocked(f"The host could not be resolved: {parts.hostname}") from exc
    if not infos:
        raise OutboundBlocked(f"The host could not be resolved: {parts.hostname}")
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if address.version == 6 and address.ipv4_mapped is not None:
            address = address.ipv4_mapped
        if not address.is_global:
            raise OutboundBlocked(
                f"{parts.hostname} resolves to {address}, which is not a public address. "
                "Local and private networks are blocked."
            )


def validate_method(method: str) -> str:
    upper = method.upper()
    if upper not in ALLOWED_METHODS:
        raise OutboundBlocked(f"HTTP method {upper} is not allowed.")
    return upper


async def send_http_request(method: str, url: str, body: Any) -> dict[str, Any]:
    """Send one approved request. Callers must have already passed the safety gate."""
    method = validate_method(method)
    await validate_outbound_url(url)
    kwargs: dict[str, Any] = {}
    if body is not None and method != "GET":
        if isinstance(body, (dict, list)):
            kwargs["json"] = body
        else:
            kwargs["content"] = str(body).encode("utf-8")
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False) as client:
        response = await client.request(method, url, headers={"Accept": "*/*"}, **kwargs)
    text = response.text
    return {
        "status_code": response.status_code,
        "text": text[:MAX_RESPONSE_CHARS],
        "truncated": len(text) > MAX_RESPONSE_CHARS,
        "url": url,
        "content_type": response.headers.get("content-type"),
    }
