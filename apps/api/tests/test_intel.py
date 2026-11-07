"""Intel feed parsing and validation tests (no network access)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.v1.intel import parse_feed
from app.main import app

RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <title>AI agents reach production</title>
      <link>https://example.com/ai-agents?utm_source=rss</link>
      <description>&lt;p&gt;A short summary with &lt;b&gt;markup&lt;/b&gt;.&lt;/p&gt;</description>
      <pubDate>Wed, 05 Nov 2025 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>No link is skipped</title>
      <description>Ignored because it has no URL.</description>
    </item>
  </channel>
</rss>
"""

ATOM = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <entry>
    <title>Chipmaker announces new fab</title>
    <link href="https://example.com/fab" rel="alternate" />
    <summary>Semiconductor expansion.</summary>
    <updated>2025-11-04T08:30:00Z</updated>
  </entry>
</feed>
"""


def test_parse_rss_normalizes_and_strips_markup():
    articles = parse_feed(RSS, source="Example", category="ai", limit=10)
    assert len(articles) == 1
    article = articles[0]
    assert article["title"] == "AI agents reach production"
    assert article["url"].startswith("https://example.com/ai-agents")
    assert article["summary"] == "A short summary with markup ."
    assert article["published_at"] == "2025-11-05T10:00:00+00:00"
    assert article["source"] == "Example"
    assert article["category"] == "ai"


def test_parse_atom_extracts_link_and_date():
    articles = parse_feed(ATOM, source="Atom", category="tech", limit=10)
    assert len(articles) == 1
    assert articles[0]["url"] == "https://example.com/fab"
    assert articles[0]["published_at"] == "2025-11-04T08:30:00+00:00"


def test_parse_feed_rejects_malformed_payload():
    assert parse_feed(b"not xml at all", source="Broken", category="ai", limit=5) == []


def test_news_category_validation():
    with TestClient(app) as client:
        response = client.get("/api/v1/intel/news?category=not-a-category")
        assert response.status_code == 422


def test_crypto_chart_rejects_invalid_coin():
    with TestClient(app) as client:
        response = client.get("/api/v1/intel/markets/crypto/..%2Fetc/chart")
        assert response.status_code in (400, 404, 422)


def test_sources_lists_configured_feeds():
    with TestClient(app) as client:
        response = client.get("/api/v1/intel/sources")
        assert response.status_code == 200
        payload = response.json()
        assert payload["sources"]
        assert payload["method"] == "RSS/Atom syndication"
