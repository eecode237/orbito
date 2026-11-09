---
name: ORBITO Charts
description: Use when adding or changing any chart in ORBITO (Area, Bar, Line, Pie, Radar, Radial, or other Recharts visuals), including tooltips, legends, and chart color tokens, so charts use the shared shadcn-style primitives and show only real data.
---

## Primitives

- `apps/web/src/components/ui/chart.tsx`: shadcn-style `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, and the `ChartConfig` type.
- `apps/web/src/components/charts/orbito-charts.tsx`: `OrbitoAreaChart`, `OrbitoBarChart`, `OrbitoLineChart`, `OrbitoPieChart`, `OrbitoRadarChart`, `OrbitoRadialChart`. Use these before writing raw Recharts. Read the file for exact prop names.

Working examples: `components/models/model-hub.tsx` (pie and bar), `components/memory/memory-view.tsx` (pie and bar), and `components/system/system-telemetry-dashboard.tsx` (time series).

## Rules

- `ChartConfig` keys match data keys. Colors come from CSS variables `var(--chart-1)` through `var(--chart-5)`, defined in `src/app/globals.css` (high-contrast tokens already exist). Don't hardcode colors.
- Every chart needs a real data source, a tooltip, a legend or labeled axis, and an empty state. Use the `EmptyNote` pattern from `model-hub.tsx`.
- If a metric is `null` (for example GPU on a machine without one), omit that series and say so. Don't interpolate or pad.
- Convert bytes to GB with two decimals for pies, and put the formatted size in the config label.
- Prefer graphs over raw dumps for telemetry. Keep the raw table as a secondary view.
- Type the data mapper rows explicitly. No `any` (lint error).

## Checklist

- [ ] Data comes from a real endpoint, typed in `types.ts` and fetched in `api.ts`.
- [ ] Loading, empty, and error states exist.
- [ ] Tooltip and legend are present.
- [ ] Colors come from tokens.
- [ ] Verified in the browser on `/system`, `/models`, `/memory`, `/crypto`, or `/planet`, whichever the chart lives on.
