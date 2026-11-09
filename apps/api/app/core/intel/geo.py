"""Geographic helpers for the Planet view.

Two honest sources of location:

* ``infer_location`` matches place names in a headline or summary against a
  small gazetteer. The result is labelled ``precision="headline"``.
* ``describe_point`` asks Wikipedia for the nearest article to a coordinate.
  It returns real article text or an explicit failure, never invented copy.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

import httpx

USER_AGENT = "ORBITO/0.1 (local intelligence reader; contact: local user)"

# (name, lat, lon, label). Cities come before countries so the most specific
# place in a headline wins. Coordinates are approximate city/country centres.
GAZETTEER: tuple[tuple[str, float, float, str], ...] = (
    ("San Francisco", 37.7749, -122.4194, "San Francisco, US"),
    ("Silicon Valley", 37.3875, -122.0575, "Silicon Valley, US"),
    ("Seattle", 47.6062, -122.3321, "Seattle, US"),
    ("Austin", 30.2672, -97.7431, "Austin, US"),
    ("New York", 40.7128, -74.006, "New York, US"),
    ("Wall Street", 40.7066, -74.0088, "New York, US"),
    ("Boston", 42.3601, -71.0589, "Boston, US"),
    ("Los Angeles", 34.0522, -118.2437, "Los Angeles, US"),
    ("Chicago", 41.8781, -87.6298, "Chicago, US"),
    ("Washington", 38.9072, -77.0369, "Washington DC, US"),
    ("Toronto", 43.6532, -79.3832, "Toronto, CA"),
    ("Mexico City", 19.4326, -99.1332, "Mexico City, MX"),
    ("São Paulo", -23.5505, -46.6333, "São Paulo, BR"),
    ("Buenos Aires", -34.6037, -58.3816, "Buenos Aires, AR"),
    ("London", 51.5074, -0.1278, "London, UK"),
    ("Paris", 48.8566, 2.3522, "Paris, FR"),
    ("Berlin", 52.52, 13.405, "Berlin, DE"),
    ("Brussels", 50.8503, 4.3517, "Brussels, EU"),
    ("Zurich", 47.3769, 8.5417, "Zurich, CH"),
    ("Madrid", 40.4168, -3.7038, "Madrid, ES"),
    ("Rome", 41.9028, 12.4964, "Rome, IT"),
    ("Moscow", 55.7558, 37.6173, "Moscow, RU"),
    ("Kyiv", 50.4501, 30.5234, "Kyiv, UA"),
    ("Tel Aviv", 32.0853, 34.7818, "Tel Aviv, IL"),
    ("Dubai", 25.2048, 55.2708, "Dubai, AE"),
    ("Istanbul", 41.0082, 28.9784, "Istanbul, TR"),
    ("Lagos", 6.5244, 3.3792, "Lagos, NG"),
    ("Nairobi", -1.2921, 36.8219, "Nairobi, KE"),
    ("Cairo", 30.0444, 31.2357, "Cairo, EG"),
    ("Mumbai", 19.076, 72.8777, "Mumbai, IN"),
    ("Bengaluru", 12.9716, 77.5946, "Bengaluru, IN"),
    ("New Delhi", 28.6139, 77.209, "New Delhi, IN"),
    ("Beijing", 39.9042, 116.4074, "Beijing, CN"),
    ("Shanghai", 31.2304, 121.4737, "Shanghai, CN"),
    ("Shenzhen", 22.5431, 114.0579, "Shenzhen, CN"),
    ("Hong Kong", 22.3193, 114.1694, "Hong Kong, HK"),
    ("Tokyo", 35.6762, 139.6503, "Tokyo, JP"),
    ("Seoul", 37.5665, 126.978, "Seoul, KR"),
    ("Taipei", 25.033, 121.5654, "Taipei, TW"),
    ("Singapore", 1.3521, 103.8198, "Singapore, SG"),
    ("Jakarta", -6.2088, 106.8456, "Jakarta, ID"),
    ("Sydney", -33.8688, 151.2093, "Sydney, AU"),
    ("United States", 39.8283, -98.5795, "United States"),
    ("Canada", 56.1304, -106.3468, "Canada"),
    ("Brazil", -14.235, -51.9253, "Brazil"),
    ("United Kingdom", 55.3781, -3.436, "United Kingdom"),
    ("Germany", 51.1657, 10.4515, "Germany"),
    ("France", 46.2276, 2.2137, "France"),
    ("Ukraine", 48.3794, 31.1656, "Ukraine"),
    ("Russia", 61.524, 105.3188, "Russia"),
    ("China", 35.8617, 104.1954, "China"),
    ("Japan", 36.2048, 138.2529, "Japan"),
    ("India", 20.5937, 78.9629, "India"),
    ("Australia", -25.2744, 133.7751, "Australia"),
    ("Israel", 31.0461, 34.8516, "Israel"),
    ("Iran", 32.4279, 53.688, "Iran"),
    ("Saudi Arabia", 23.8859, 45.0792, "Saudi Arabia"),
    ("South Africa", -30.5595, 22.9375, "South Africa"),
    ("Nigeria", 9.082, 8.6753, "Nigeria"),
    ("Mexico", 23.6345, -102.5528, "Mexico"),
    ("Korea", 35.9078, 127.7669, "South Korea"),
    ("Europe", 50.1109, 10.6797, "Europe"),
)

_PATTERNS = tuple(
    (re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE), lat, lon, label)
    for name, lat, lon, label in GAZETTEER
)


def infer_location(*texts: str | None) -> dict[str, Any] | None:
    """Return the first gazetteer place named in the texts, or ``None``.

    Texts are scanned in order (title first, then summary), so a headline
    location beats a summary mention.
    """
    for text in texts:
        if not text:
            continue
        for pattern, lat, lon, label in _PATTERNS:
            if pattern.search(text):
                return {"lat": lat, "lon": lon, "label": label, "precision": "headline"}
    return None


async def describe_point(
    lat: float,
    lon: float,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    """Describe the nearest Wikipedia article to a coordinate.

    Returns ``reachable: false`` with the error when Wikipedia cannot be
    queried. ``title`` is ``None`` when no article is nearby.
    """
    base: dict[str, Any] = {
        "lat": lat,
        "lon": lon,
        "title": None,
        "description": None,
        "extract": None,
        "url": None,
        "distance_m": None,
        "source": "Wikipedia",
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=5.0),
            headers=headers,
            follow_redirects=True,
            transport=transport,
        ) as client:
            search = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "geosearch",
                    "gscoord": f"{lat:.5f}|{lon:.5f}",
                    "gsradius": "10000",
                    "gslimit": "1",
                    "format": "json",
                },
            )
            search.raise_for_status()
            hits = ((search.json().get("query") or {}).get("geosearch")) or []
            if not hits:
                return {**base, "reachable": True, "error": None}

            hit = hits[0]
            title = str(hit.get("title") or "")
            base.update(
                {
                    "title": title,
                    "distance_m": hit.get("dist"),
                    "url": f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                }
            )
            summary = await client.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title.replace(' ', '_'))}"
            )
            if summary.status_code == 200:
                data = summary.json()
                extract = str(data.get("extract") or "")
                base.update(
                    {
                        "description": data.get("description") or None,
                        "extract": extract[:280].rstrip() + ("…" if len(extract) > 280 else "") or None,
                        "url": ((data.get("content_urls") or {}).get("desktop") or {}).get("page")
                        or base["url"],
                    }
                )
            return {**base, "reachable": True, "error": None}
    except Exception as exc:  # noqa: BLE001 - reported as data-source health
        return {**base, "reachable": False, "error": f"Wikipedia lookup failed: {str(exc)[:160]}"}
