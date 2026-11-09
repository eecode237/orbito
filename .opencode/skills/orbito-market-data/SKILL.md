---
name: ORBITO Market and News Data
description: Use when adding or changing a public data feed in ORBITO (RSS news, crypto or stock quotes, or other third-party APIs) so it respects rate limits, caches results, serves stale data on failure, and never fabricates values.
---

## Where

- Backend: `apps/api/app/api/v1/intel.py` (`IntelCache`, `FEEDS`, `SOURCE_LOCATIONS`, and the `/intel/news`, `/intel/markets/*` endpoints).
- Frontend: `apps/web/src/components/news/news-feed.tsx`, `components/planet/planet-view.tsx`, `components/crypto/crypto-market.tsx`.
- Tests: `apps/api/tests/test_intel.py`.

## Pattern

1. **TTLs.** Set explicit cache windows: `CACHE_SECONDS` for news, `MARKET_CACHE_SECONDS` for quotes, `CHART_CACHE_SECONDS` for charts.
2. **One fetch helper.** Use an explicit timeout, a `User-Agent`, and 429 handling that honors `Retry-After`, capped. Retry a bounded number of times with backoff. `_get_json` and `_get_stock_json` are the reference.
3. **Locking.** Hold the `asyncio.Lock` only around cache reads and writes. Never hold it across network I/O.
4. **Failure behavior.**
   - Cache exists: return it with `stale: true` and the `error`.
   - No cache: return `reachable: false`, the `error`, and empty arrays.
   - Never synthesize prices, headlines, or locations.
5. **Response contract.** Include `reachable`, `error`, `generated_at`, `provider`, and `stale`. Mirror the shape in `src/lib/types.ts`.
6. **Normalize.** Map upstream rows into typed dicts. Strip HTML with `_clean` and cap lengths.
7. **Sources.** Only publisher-provided syndication feeds. Adding one is a code-review decision, and it goes in `FEEDS`.
8. **Locations.** `SOURCE_LOCATIONS` holds approximate source or coverage regions only. Label them as approximate in the UI.

## Tests

- Mock upstream with `httpx.MockTransport` or by patching `_get_json`. Cover:
  - success
  - 429 followed by success
  - failure with a cache (stale response)
  - failure without a cache (`reachable: false`)
- No live network in tests.

## Known limits

- Yahoo's chart endpoint is unofficial and can be blocked. Treat it as best-effort.
- CoinGecko's public tier is strict about rate limits.
- RSS sources can change URLs or drop items. Show per-source health.
