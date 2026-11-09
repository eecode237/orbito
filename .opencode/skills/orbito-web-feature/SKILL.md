---
name: ORBITO Web Feature
description: Use when building or changing a Next.js page, React component, API client function, or TypeScript contract in apps/web, including design tokens, nav entries, and honest loading, empty, and error states.
---

## First: this Next.js is not the one you remember

`apps/web/AGENTS.md` says this is Next.js 16 with breaking changes. Before writing Next-specific code (routing, metadata, dynamic imports, caching, server or client boundaries), read the matching guide in `apps/web/node_modules/next/dist/docs/` and heed deprecation notices. Do not strip the auto-managed `BEGIN/END nextjs-agent-rules` block from `apps/web/AGENTS.md`. `next dev` writes it.

## Workflow

1. **Contract first.** Add the type to `apps/web/src/lib/types.ts`. Add a typed fetch to `apps/web/src/lib/api.ts` using `apiGet`, `apiSend`, or the SSE helper (`readSse`). No `any` in exported types.
2. **Page.** `src/app/<route>/page.tsx` stays thin: `metadata`, a hero or `PageHeader`, and one client view from `src/components/<domain>/`.
3. **Navigation.** If the page is user-facing, add it to `src/lib/nav.ts`.
4. **Components.** Reuse `src/components/ui/`: `Button`, `Card`, `CardHeader`, `CardContent`, `Badge`, `EmptyState`, `Tabs`, `Skeleton`, `PageHeader`.
   - `Button` variants are `primary | secondary | outline | ghost | danger | success`. There is no `default`.
5. **Data loading.** Fetch in `useEffect` with an `alive` cancellation flag, or through a `useCallback` loader. Clear every interval in the cleanup.
6. **Verify.** Run typecheck and lint (see `orbito-verify-and-commit`), then open the route in the browser.

## Design language

- Use tokens from `src/app/globals.css` (`bg-surface`, `text-foreground`, `text-foreground-muted`, `border-border`, `primary`, `success`, `warning`, `error`, `info`). Avoid ad hoc hex colors. Chart colors are the exception: use `--chart-1` to `--chart-5`.
- Dark, premium, glass cards. Hero banners use the halo gradient pattern from `/memory`, `/models`, and `/planet`.

## Honest states (mandatory)

Every data view handles all of these:

- **Loading:** a spinner or skeleton, never placeholder numbers.
- **Empty:** say what is missing, e.g. "No memories saved yet".
- **Error:** show the real message.
- **Unreachable:** show source health, e.g. "2/4 feeds reachable".
- **Stale:** show a stale badge with the timestamp.

Never render sample rows, invented counts, or fake success.

## Lint rules (`eslint.config.mjs`)

- `@typescript-eslint/no-explicit-any` is an error. Type data mappers explicitly.
- `react-hooks/set-state-in-effect` is an error. Don't call `setState` synchronously in an effect body. Trigger the fetch and set state only in async callbacks.
- Remove unused variables.

Current baseline violations exist in `components/ui/chart.tsx` and `components/system/system-telemetry-dashboard.tsx`. Don't copy those patterns.

## Gotchas

- Client components need `"use client"`.
- Libraries that touch `window` or WebGL (three.js, charts) load through `next/dynamic` with `ssr: false`.
- The API base is `API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`. `NEXT_PUBLIC_*` values are public, so never put secrets there.
