"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bitcoin,
  ChartCandlestick,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { PriceAreaChart, SparklineChart } from "@/components/charts/usage-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/tabs";
import { getCryptoChart, getCryptoMarket } from "@/lib/api";
import type { CryptoAsset, CryptoChart, CryptoMarket } from "@/lib/types";
import { cn, compactNumber, formatRelative } from "@/lib/utils";

const RANGES = [
  { id: "1", label: "24h" },
  { id: "7", label: "7d" },
  { id: "30", label: "30d" },
  { id: "90", label: "90d" },
];

function formatPrice(value: number | null) {
  if (value === null || value === undefined) return "—";
  if (value >= 1) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(4)}`;
}

function formatChartLabel(timestamp: number, days: number) {
  const date = new Date(timestamp);
  if (days <= 1) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CryptoMarketView() {
  const [market, setMarket] = useState<CryptoMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coin, setCoin] = useState("bitcoin");
  const [days, setDays] = useState("7");
  const [chart, setChart] = useState<CryptoChart | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCryptoMarket()
      .then((data) => {
        if (!alive) return;
        if (data.reachable || data.assets?.length) {
          setMarket(data);
          setError(data.stale ? (data.error ?? "Showing cached market data (rate limited).") : null);
        } else {
          setError(data.error ?? "Market data is unreachable.");
        }
      })
      .catch((cause) => {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : "Market data is unreachable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getCryptoChart(coin, Number(days))
      .then((data) => {
        if (!alive) return;
        if (data.reachable || data.points?.length) {
          setChart(data);
          setChartError(data.stale ? (data.error ?? "Showing cached price history.") : null);
        } else {
          setChartError(data.error ?? "Price history is unreachable.");
        }
      })
      .catch((cause) => {
        if (!alive) return;
        setChartError(cause instanceof Error ? cause.message : "Price history is unreachable.");
      })
      .finally(() => {
        if (!alive) return;
        setChartLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [coin, days]);

  function refresh() {
    setRefreshing(true);
    getCryptoMarket()
      .then((data) => {
        if (data.reachable || data.assets?.length) {
          setMarket(data);
          setError(data.stale ? (data.error ?? "Showing cached market data (rate limited).") : null);
        } else if (!market?.assets?.length) {
          setError(data.error ?? "Market data is unreachable.");
        } else {
          setError(data.error ?? "Refresh failed; showing cached data.");
        }
      })
      .catch((cause) => {
        if (!market?.assets?.length) {
          setError(cause instanceof Error ? cause.message : "Market data is unreachable.");
        } else {
          setError(cause instanceof Error ? `Refresh failed; showing cached data. ${cause.message}` : "Refresh failed; showing cached data.");
        }
      })
      .finally(() => setRefreshing(false));
  }

  function selectCoin(nextCoin: string) {
    if (nextCoin === coin) return;
    setChartLoading(true);
    setCoin(nextCoin);
  }

  function selectDays(nextDays: string) {
    if (nextDays === days) return;
    setChartLoading(true);
    setDays(nextDays);
  }

  const assets = useMemo(() => market?.assets ?? [], [market]);

  const summary = useMemo(() => {
    if (!assets.length) {
      return { cap: 0, change: 0, gainers: 0, losers: 0, leader: null as CryptoAsset | null };
    }
    const cap = assets.reduce((total, asset) => total + (asset.market_cap_usd ?? 0), 0);
    const changes = assets
      .map((asset) => asset.change_24h_percent)
      .filter((value): value is number => typeof value === "number");
    const change = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    const leader = [...assets].sort(
      (a, b) => (b.change_24h_percent ?? -Infinity) - (a.change_24h_percent ?? -Infinity),
    )[0];
    return {
      cap,
      change,
      gainers: changes.filter((value) => value > 0).length,
      losers: changes.filter((value) => value < 0).length,
      leader,
    };
  }, [assets]);

  const selected = assets.find((asset) => asset.id === coin) ?? null;
  const series = useMemo(
    () =>
      (chart?.points ?? []).map((point) => ({
        label: formatChartLabel(point.t, Number(days)),
        price: point.price,
      })),
    [chart, days],
  );
  const chartTone = (selected?.change_24h_percent ?? summary.change) < 0 ? "error" : "success";

  const columns: Column<CryptoAsset>[] = [
    {
      key: "asset",
      header: "Asset",
      render: (asset) => (
        <button
          type="button"
          onClick={() => selectCoin(asset.id)}
          className="focus-ring flex items-center gap-2.5 rounded text-left"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-surface-inset text-[8px] font-semibold text-foreground-secondary">
            {asset.symbol.slice(0, 3)}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate text-[12px] font-medium",
                asset.id === coin ? "text-primary-hover" : "text-foreground",
              )}
            >
              {asset.name}
            </span>
            <span className="font-mono text-[9.5px] uppercase text-foreground-muted">
              {asset.symbol}
            </span>
          </span>
        </button>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      render: (asset) => (
        <span className="font-mono text-[11.5px] text-foreground">{formatPrice(asset.price_usd)}</span>
      ),
    },
    {
      key: "change",
      header: "24h",
      align: "right",
      render: (asset) => {
        const value = asset.change_24h_percent;
        if (value === null || value === undefined) {
          return <span className="font-mono text-[10px] text-foreground-muted">—</span>;
        }
        const positive = value >= 0;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-mono text-[11px]",
              positive ? "text-success" : "text-error",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(value).toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: "cap",
      header: "Market cap",
      align: "right",
      render: (asset) => (
        <span className="font-mono text-[10.5px] text-foreground-secondary">
          {asset.market_cap_usd ? `$${compactNumber(asset.market_cap_usd)}` : "—"}
        </span>
      ),
    },
    {
      key: "spark",
      header: "7d",
      align: "right",
      render: (asset) => (
        <div className="flex justify-end">
          <SparklineChart
            values={asset.sparkline}
            positive={(asset.change_24h_percent ?? 0) >= 0}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Discovery · Market intelligence"
        title={
          <>
            Crypto prices, <span className="text-gradient">observed not predicted.</span>
          </>
        }
        description="Live market snapshots and price history from the CoinGecko public API through the ORBITO backend proxy. Cached data is shown when the upstream is rate-limited; no synthetic prices are generated."
        icon={<Bitcoin className="h-5 w-5" />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={market?.stale ? "warning" : market?.reachable || assets.length ? "success" : "error"} dot>
            {market?.stale ? "Cached (rate limited)" : market?.reachable || assets.length ? market?.provider ?? "Market feed" : "Market feed unreachable"}
          </Badge>
          <Badge tone="neutral">USD</Badge>
          <Badge tone="neutral">
            <ChartCandlestick className="h-3 w-3" /> {chart?.points.length ?? 0} price points
          </Badge>
        </div>
      </PageHeader>

      {error && assets.length ? (
        <Card className="border-warning/30 bg-warning/[0.05]">
          <CardContent className="flex items-start gap-3 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-[12.5px] font-medium text-foreground">Showing cached market data</p>
              <p className="mt-0.5 font-mono text-[10.5px] text-warning/90">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error && !assets.length ? (
        <Card className="border-error/30 bg-error/[0.05]">
          <CardContent className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div>
              <p className="text-[12.5px] font-medium text-foreground">Market data is unavailable</p>
              <p className="mt-1 font-mono text-[11px] text-error">{error}</p>
              <p className="mt-1 text-[11px] text-foreground-secondary">
                This usually means the public API rate limit or network access blocked the request.
                Nothing is shown in place of real prices.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={refresh}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
        ) : (
          <>
            <Card>
              <CardContent>
                <p className="type-eyebrow text-foreground-muted">Tracked market cap</p>
                <p className="mt-1.5 font-mono text-[20px] font-medium text-foreground">
                  {summary.cap ? `$${compactNumber(summary.cap)}` : "—"}
                </p>
                <p className="mt-1 text-[10px] text-foreground-muted">
                  Top {assets.length} assets by market cap
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="type-eyebrow text-foreground-muted">Average 24h move</p>
                <p
                  className={cn(
                    "mt-1.5 font-mono text-[20px] font-medium",
                    summary.change >= 0 ? "text-success" : "text-error",
                  )}
                >
                  {assets.length ? `${summary.change >= 0 ? "+" : ""}${summary.change.toFixed(2)}%` : "—"}
                </p>
                <p className="mt-1 text-[10px] text-foreground-muted">
                  {summary.gainers} up · {summary.losers} down
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="type-eyebrow text-foreground-muted">Strongest asset</p>
                <p className="mt-1.5 truncate text-[15px] font-semibold text-foreground">
                  {summary.leader?.name ?? "—"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-success">
                  {summary.leader?.change_24h_percent !== null &&
                  summary.leader?.change_24h_percent !== undefined
                    ? `+${summary.leader.change_24h_percent.toFixed(2)}% in 24h`
                    : "Awaiting data"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="type-eyebrow text-foreground-muted">Selected asset</p>
                <p className="mt-1.5 truncate text-[15px] font-semibold text-foreground">
                  {selected?.name ?? "—"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-foreground-muted">
                  {formatPrice(selected?.price_usd ?? null)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader
          title={`${selected?.name ?? "Bitcoin"} price history`}
          description={`USD · ${RANGES.find((range) => range.id === days)?.label ?? days} window${chart?.stale ? " · cached" : ""}`}
          actions={
            <Segmented options={RANGES} value={days} onChange={selectDays} />
          }
        />
        <CardContent>
          {chartError && series.length ? (
            <p className="mb-2 rounded-md border border-warning/25 bg-warning/[0.05] px-2 py-1 text-[10px] text-warning/90">
              {chartError}
            </p>
          ) : null}
          {chartLoading ? (
            <div className="shimmer h-[300px] rounded-lg bg-foreground/[0.04]" />
          ) : !series.length ? (
            <EmptyState
              icon={ChartCandlestick}
              title="Price history is unavailable"
              description={
                chartError ??
                "The public market API returned no points for this asset and window. No fallback series is drawn."
              }
              compact
            />
          ) : (
            <div className="h-[300px]">
              <PriceAreaChart data={series} tone={chartTone} />
            </div>
          )}
          <p className="mt-2 text-[10px] text-foreground-muted">
            Observed prices only. History is cached and served stale on rate limits. Not financial advice.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Market table"
          description="Select an asset to load its chart"
          actions={
            market?.generated_at ? (
              <span className="font-mono text-[9.5px] text-foreground-muted">
                updated {formatRelative(market.generated_at)}
              </span>
            ) : null
          }
        />
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="shimmer h-8 rounded bg-foreground/[0.04]" />
            ))}
          </div>
        ) : (
          <DataTable
            rows={assets}
            columns={columns}
            getKey={(asset) => asset.id}
            empty={
              <EmptyState
                icon={Bitcoin}
                title="No market rows"
                description="The market endpoint returned no assets. The table stays empty rather than displaying placeholders."
                compact
              />
            }
          />
        )}
      </Card>
    </div>
  );
}
