"""Planet geo helpers: headline geocoding and nearest-place description."""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from app.core.intel.geo import describe_point, infer_location
from app.main import app


def test_infer_location_prefers_title_and_specific_places():
    hit = infer_location("Bitcoin rallies as Tokyo traders return", "London is quiet")
    assert hit is not None
    assert hit["label"] == "Tokyo, JP"
    assert hit["precision"] == "headline"


def test_infer_location_matches_countries_and_respects_word_boundaries():
    assert infer_location("Germany approves new chip subsidies")["label"] == "Germany"
    assert infer_location("Chicago-style pizza wins award") is not None
    assert infer_location("Washingtonian values rise") is None


def test_infer_location_returns_none_without_a_known_place():
    assert infer_location("Startup raises a seed round", "No place named here") is None
    assert infer_location(None, "") is None


def _wiki_transport(search_hits: list[dict], summary_status: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/w/api.php":
            return httpx.Response(200, json={"query": {"geosearch": search_hits}})
        if request.url.path.startswith("/api/rest_v1/page/summary/"):
            if summary_status != 200:
                return httpx.Response(summary_status, json={})
            return httpx.Response(
                200,
                json={
                    "description": "Port in France",
                    "extract": "The Autonomous Port of Paris is a public institution.",
                    "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/X"}},
                },
            )
        return httpx.Response(404)

    return httpx.MockTransport(handler)


async def test_describe_point_returns_nearest_article_text():
    hits = [{"title": "Autonomous Port of Paris", "dist": 12.5}]
    result = await describe_point(48.85, 2.35, transport=_wiki_transport(hits))
    assert result["reachable"] is True
    assert result["title"] == "Autonomous Port of Paris"
    assert result["description"] == "Port in France"
    assert result["distance_m"] == 12.5
    assert result["extract"].startswith("The Autonomous Port of Paris")


async def test_describe_point_reports_empty_area_honestly():
    result = await describe_point(0.0, -140.0, transport=_wiki_transport([]))
    assert result["reachable"] is True
    assert result["title"] is None


async def test_describe_point_reports_upstream_failure():
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline", request=request)

    result = await describe_point(1.0, 1.0, transport=httpx.MockTransport(boom))
    assert result["reachable"] is False
    assert result["title"] is None
    assert "failed" in result["error"]


def test_describe_endpoint_validates_coordinates():
    client = TestClient(app)
    assert client.get("/api/v1/intel/geo/describe", params={"lat": 120, "lon": 0}).status_code == 422
    assert client.get("/api/v1/intel/geo/describe", params={"lat": 0}).status_code == 422


def test_news_articles_carry_precision_labelled_locations():
    from app.api.v1.intel import parse_feed

    payload = (
        b"<rss><channel><item><title>Shenzhen chipmaker expands</title>"
        b"<link>https://example.com/a</link><description>Output rises</description>"
        b"</item></channel></rss>"
    )
    articles = parse_feed(payload, source="The Verge", category="tech", limit=5)
    assert articles[0]["location"]["label"] == "Shenzhen, CN"
    assert articles[0]["location"]["precision"] == "headline"
    json.dumps(articles)
