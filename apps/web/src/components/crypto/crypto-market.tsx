"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bitcoin,
  Building2,
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
import { getCryptoChart, getCryptoMarket, getStockChart, getStockMarket } from "@/lib/api";
import type { CryptoAsset, CryptoChart, CryptoMarket, StockAsset, StockChart, StockMarket } from "@/lib/types";
import { cn, compactNumber, formatRelative } from "@/lib/utils";

const MARKET_TABS = [
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Company stocks" },
];
const RANGES = [
  { id: "1", label: "24h" },
  { id: "7", label: "7d" },
  { id: "30", label: "30d" },
  { id: "90", label: "90d" },
];
const DEFAULT_STOCKS = "AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,AVGO,JPM,V";

function formatPrice(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return "—";
  const sym = currency === "USD" ? "$" : `${currency} `;
  if (Math.abs(value) >= 1) return `${sym}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `${sym}${value.toFixed(4)}`;
}

function formatChartLabel(timestamp: number, days: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  if (days <= 1) return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MarketsView() {
  const [tab, setTab] = useState<"crypto" | "stocks">("crypto");
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Discovery · Market intelligence"
        title={<>Markets, <span className="text-gradient">crypto and company stocks.</span></>}
        description="Real market snapshots and price history via the ORBITO backend. Crypto uses the public CoinGecko feed; company stocks use a public chart feed. Cached data is shown on rate limits — no synthetic prices."
        icon={tab === "stocks" ? <Building2 className="h-5 w-5" /> : <Bitcoin className="h-5 w-5" />}
        actions={<Segmented options={MARKET_TABS} value={tab} onChange={(v) => setTab(v as "crypto" | "stocks")} />}
      />
      {tab === "crypto" ? <CryptoSection /> : <StocksSection />}
    </div>
  );
}

// Back-compat for existing import
export const CryptoMarketView = MarketsView;

function CryptoSection() {
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
          setError(data.stale ? (data.error ?? "Showing cached crypto data (rate limited).") : null);
        } else setError(data.error ?? "Crypto market data is unreachable.");
      })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Crypto market data is unreachable."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getCryptoChart(coin, Number(days))
      .then((data) => {
        if (!alive) return;
        if (data.reachable || data.points?.length) { setChart(data); setChartError(data.stale ? (data.error ?? "Showing cached price history.") : null); }
        else setChartError(data.error ?? "Price history is unreachable.");
      })
      .catch((cause) => { if (alive) setChartError(cause instanceof Error ? cause.message : "Price history is unreachable."); })
      .finally(() => { if (alive) setChartLoading(false); });
    return () => { alive = false; };
  }, [coin, days]);

  function refresh() {
    setRefreshing(true);
    getCryptoMarket()
      .then((data) => {
        if (data.reachable || data.assets?.length) { setMarket(data); setError(data.stale ? (data.error ?? "Showing cached crypto data (rate limited).") : null); }
        else if (!market?.assets?.length) setError(data.error ?? "Crypto market data is unreachable.");
        else setError(data.error ?? "Refresh failed; showing cached data.");
      })
      .catch((cause) => setError(market?.assets?.length ? `Refresh failed; showing cached data.` : (cause instanceof Error ? cause.message : "Crypto market data is unreachable.")))
      .finally(() => setRefreshing(false));
  }

  const assets = useMemo(() => market?.assets ?? [], [market]);
  const selected = assets.find((a) => a.id === coin) ?? null;
  const series = useMemo(() => (chart?.points ?? []).map((p) => ({ label: formatChartLabel(p.t, Number(days)), price: p.price })), [chart, days]);
  const tone = (selected?.change_24h_percent ?? 0) < 0 ? "error" : "success";

  const columns: Column<CryptoAsset>[] = [
    { key: "asset", header: "Asset", render: (a) => (
      <button type="button" onClick={() => { if (a.id !== coin) { setChartLoading(true); setCoin(a.id); } }} className="focus-ring flex items-center gap-2.5 rounded text-left">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-surface-inset text-[8px] font-semibold text-foreground-secondary">{a.symbol.slice(0, 3)}</span>
        <span className="min-w-0"><span className={cn("block truncate text-[12px] font-medium", a.id === coin ? "text-primary-hover" : "text-foreground")}>{a.name}</span><span className="font-mono text-[9.5px] uppercase text-foreground-muted">{a.symbol}</span></span>
      </button>
    )},
    { key: "price", header: "Price", align: "right", render: (a) => <span className="font-mono text-[11.5px] text-foreground">{formatPrice(a.price_usd)}</span> },
    { key: "change", header: "24h", align: "right", render: (a) => <ChangeCell value={a.change_24h_percent} /> },
    { key: "cap", header: "Market cap", align: "right", render: (a) => <span className="font-mono text-[10.5px] text-foreground-secondary">{a.market_cap_usd ? `$${compactNumber(a.market_cap_usd)}` : "—"}</span> },
    { key: "spark", header: "7d", align: "right", render: (a) => <div className="flex justify-end"><SparklineChart values={a.sparkline} positive={(a.change_24h_percent ?? 0) >= 0} /></div> },
  ];

  return (
    <MarketShell
      badgeTone={market?.stale ? "warning" : market?.reachable || assets.length ? "success" : "error"}
      badgeText={market?.stale ? "Cached (rate limited)" : market?.reachable || assets.length ? (market?.provider ?? "CoinGecko") : "Feed unreachable"}
      pointCount={chart?.points.length ?? 0}
      onRefresh={refresh}
      refreshing={refreshing}
      error={error}
      hasData={assets.length > 0}
      loading={loading}
      summary={<CryptoSummary assets={assets} />}
      chartTitle={`${selected?.name ?? "Bitcoin"} price history`}
      chartMeta={`USD · ${RANGES.find((r) => r.id === days)?.label ?? days}${chart?.stale ? " · cached" : ""}`}
      chartActions={<Segmented options={RANGES} value={days} onChange={(v) => { if (v !== days) { setChartLoading(true); setDays(v); } }} />}
      chartLoading={chartLoading}
      chartError={chartError}
      series={series}
      tone={tone}
      tableTitle="Crypto market table"
      tableMeta={market?.generated_at ? `updated ${formatRelative(market.generated_at)}` : null}
      table={<DataTable rows={assets} columns={columns} getKey={(a) => a.id} empty={<EmptyState icon={Bitcoin} title="No crypto rows" description="The market endpoint returned no assets." compact />} />}
    />
  );
}

function StocksSection() {
  const [market, setMarket] = useState<StockMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [days, setDays] = useState("30");
  const [chart, setChart] = useState<StockChart | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getStockMarket(DEFAULT_STOCKS)
      .then((data) => {
        if (!alive) return;
        if (data.reachable || data.assets?.length) {
          setMarket(data);
          setError(data.stale ? (data.error ?? "Showing cached stock data (rate limited).") : null);
          if (data.assets?.[0] && !data.assets.find((a) => a.symbol === symbol)) setSymbol(data.assets[0].symbol);
        } else setError(data.error ?? "Stock market data is unreachable.");
      })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Stock market data is unreachable."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    getStockChart(symbol, Number(days))
      .then((data) => {
        if (!alive) return;
        if (data.reachable || data.points?.length) { setChart(data); setChartError(data.stale ? (data.error ?? "Showing cached price history.") : null); }
        else setChartError(data.error ?? "Price history is unreachable.");
      })
      .catch((cause) => { if (alive) setChartError(cause instanceof Error ? cause.message : "Price history is unreachable."); })
      .finally(() => { if (alive) setChartLoading(false); });
    return () => { alive = false; };
  }, [symbol, days]);

  function refresh() {
    setRefreshing(true);
    getStockMarket(DEFAULT_STOCKS)
      .then((data) => {
        if (data.reachable || data.assets?.length) { setMarket(data); setError(data.stale ? (data.error ?? "Showing cached stock data (rate limited).") : null); }
        else if (!market?.assets?.length) setError(data.error ?? "Stock market data is unreachable.");
        else setError(data.error ?? "Refresh failed; showing cached data.");
      })
      .catch((cause) => setError(market?.assets?.length ? "Refresh failed; showing cached data." : (cause instanceof Error ? cause.message : "Stock market data is unreachable.")))
      .finally(() => setRefreshing(false));
  }

  const assets = useMemo(() => market?.assets ?? [], [market]);
  const selected = assets.find((a) => a.symbol === symbol) ?? null;
  const series = useMemo(() => (chart?.points ?? []).map((p) => ({ label: formatChartLabel(p.t, Number(days)), price: p.price })), [chart, days]);
  const tone = (selected?.change_percent ?? 0) < 0 ? "error" : "success";

  const columns: Column<StockAsset>[] = [
    { key: "asset", header: "Company", render: (a) => (
      <button type="button" onClick={() => { if (a.symbol !== symbol) { setChartLoading(true); setSymbol(a.symbol); } }} className="focus-ring flex items-center gap-2.5 rounded text-left">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-border bg-surface-inset text-[8px] font-semibold text-foreground-secondary">{a.symbol.slice(0, 4)}</span>
        <span className="min-w-0"><span className={cn("block truncate text-[12px] font-medium", a.symbol === symbol ? "text-primary-hover" : "text-foreground")}>{a.name}</span><span className="font-mono text-[9.5px] uppercase text-foreground-muted">{a.symbol}{a.exchange ? ` · ${a.exchange}` : ""}</span></span>
      </button>
    )},
    { key: "price", header: "Price", align: "right", render: (a) => <span className="font-mono text-[11.5px] text-foreground">{formatPrice(a.price, a.currency)}</span> },
    { key: "change", header: "Change", align: "right", render: (a) => <ChangeCell value={a.change_percent} /> },
    { key: "state", header: "Market", align: "right", render: (a) => <span className="font-mono text-[10px] text-foreground-muted">{a.market_state || "—"}</span> },
    { key: "spark", header: "5d", align: "right", render: (a) => <div className="flex justify-end"><SparklineChart values={a.sparkline} positive={(a.change_percent ?? 0) >= 0} /></div> },
  ];

  return (
    <MarketShell
      badgeTone={market?.stale ? "warning" : market?.reachable || assets.length ? "success" : "error"}
      badgeText={market?.stale ? "Cached (rate limited)" : market?.reachable || assets.length ? (market?.provider ?? "Stock feed") : "Feed unreachable"}
      pointCount={chart?.points.length ?? 0}
      onRefresh={refresh}
      refreshing={refreshing}
      error={error}
      hasData={assets.length > 0}
      loading={loading}
      summary={<StocksSummary assets={assets} />}
      chartTitle={`${selected?.name ?? symbol} price history`}
      chartMeta={`${selected?.currency ?? "USD"} · ${RANGES.find((r) => r.id === days)?.label ?? days}${chart?.stale ? " · cached" : ""}`}
      chartActions={<Segmented options={RANGES} value={days} onChange={(v) => { if (v !== days) { setChartLoading(true); setDays(v); } }} />}
      chartLoading={chartLoading}
      chartError={chartError}
      series={series}
      tone={tone}
      tableTitle="Company stocks"
      tableMeta={market?.generated_at ? `updated ${formatRelative(market.generated_at)}` : null}
      table={<DataTable rows={assets} columns={columns} getKey={(a) => a.symbol} empty={<EmptyState icon={Building2} title="No stock rows" description="The stock endpoint returned no company data. The table stays empty rather than displaying placeholders." compact />} />}
    />
  );
}

function ChangeCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="font-mono text-[10px] text-foreground-muted">—</span>;
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono text-[11px]", positive ? "text-success" : "text-error")}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function MarketShell(props: {
  badgeTone: "success" | "warning" | "error";
  badgeText: string;
  pointCount: number;
  onRefresh: () => void;
  refreshing: boolean;
  error: string | null;
  hasData: boolean;
  loading: boolean;
  summary: React.ReactNode;
  chartTitle: string;
  chartMeta: string;
  chartActions: React.ReactNode;
  chartLoading: boolean;
  chartError: string | null;
  series: { label: string; price: number }[];
  tone: "success" | "error";
  tableTitle: string;
  tableMeta: string | null;
  table: React.ReactNode;
}) {
  const { badgeTone, badgeText, pointCount, onRefresh, refreshing, error, hasData, loading, summary, chartTitle, chartMeta, chartActions, chartLoading, chartError, series, tone, tableTitle, tableMeta, table } = props;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={badgeTone} dot>{badgeText}</Badge>
        <Badge tone="neutral"><ChartCandlestick className="h-3 w-3" /> {pointCount} points</Badge>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>
      {error && hasData ? (
        <Card className="border-warning/30 bg-warning/[0.05]"><CardContent className="flex items-start gap-3 py-3"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><p className="text-[12.5px] font-medium text-foreground">Showing cached market data</p><p className="mt-0.5 font-mono text-[10.5px] text-warning/90">{error}</p></div></CardContent></Card>
      ) : null}
      {error && !hasData ? (
        <Card className="border-error/30 bg-error/[0.05]"><CardContent className="flex items-start gap-3"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" /><div><p className="text-[12.5px] font-medium text-foreground">Market data is unavailable</p><p className="mt-1 font-mono text-[11px] text-error">{error}</p><Button variant="outline" size="sm" className="mt-2" onClick={onRefresh}>Retry</Button></div></CardContent></Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : summary}</div>
      <Card>
        <CardHeader title={chartTitle} description={chartMeta} actions={chartActions} />
        <CardContent>
          {chartError && series.length ? <p className="mb-2 rounded-md border border-warning/25 bg-warning/[0.05] px-2 py-1 text-[10px] text-warning/90">{chartError}</p> : null}
          {chartLoading ? <div className="shimmer h-[300px] rounded-lg bg-foreground/[0.04]" /> : !series.length ? <EmptyState icon={ChartCandlestick} title="Price history is unavailable" description={chartError ?? "No real data points returned. No fallback series is drawn."} compact /> : <div className="h-[300px]"><PriceAreaChart data={series} tone={tone} /></div>}
          <p className="mt-2 text-[10px] text-foreground-muted">Observed prices only. Cached and served stale on rate limits. Not financial advice.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={tableTitle} description="Select a row to load its chart" actions={tableMeta ? <span className="font-mono text-[9.5px] text-foreground-muted">{tableMeta}</span> : null} />
        {loading ? <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-8 rounded bg-foreground/[0.04]" />)}</div> : table}
      </Card>
    </div>
  );
}

function CryptoSummary({ assets }: { assets: CryptoAsset[] }) {
  if (!assets.length) return <>{[0,1,2,3].map((i)=><Card key={i}><CardContent><p className="text-[10px] text-foreground-muted">—</p></CardContent></Card>)}</>;
  const cap = assets.reduce((t, a) => t + (a.market_cap_usd ?? 0), 0);
  const changes = assets.map((a) => a.change_24h_percent).filter((v): v is number => typeof v === "number");
  const avg = changes.length ? changes.reduce((a,b)=>a+b,0)/changes.length : 0;
  const leader = [...assets].sort((a,b)=>(b.change_24h_percent ?? -Infinity)-(a.change_24h_percent ?? -Infinity))[0];
  return <>
    <SummaryCard label="Tracked market cap" value={cap ? "$" + compactNumber(cap) : "—"} sub={"Top " + assets.length + " assets"} />
    <SummaryCard label="Average 24h move" value={(avg >= 0 ? "+" : "") + avg.toFixed(2) + "%"} sub={changes.filter(v=>v>0).length + " up · " + changes.filter(v=>v<0).length + " down"} tone={avg>=0?"success":"error"} />
    <SummaryCard label="Strongest asset" value={leader?.name ?? "—"} sub={leader?.change_24h_percent != null ? "+" + leader.change_24h_percent.toFixed(2) + "% in 24h" : "Awaiting data"} tone="success" />
    <SummaryCard label="Assets tracked" value={String(assets.length)} sub="Real rows only" />
  </>;
}

function StocksSummary({ assets }: { assets: StockAsset[] }) {
  if (!assets.length) return <>{[0,1,2,3].map((i)=><Card key={i}><CardContent><p className="text-[10px] text-foreground-muted">—</p></CardContent></Card>)}</>;
  const changes = assets.map((a) => a.change_percent).filter((v): v is number => typeof v === "number");
  const avg = changes.length ? changes.reduce((a,b)=>a+b,0)/changes.length : 0;
  const leader = [...assets].sort((a,b)=>(b.change_percent ?? -Infinity)-(a.change_percent ?? -Infinity))[0];
  return <>
    <SummaryCard label="Companies tracked" value={String(assets.length)} sub="Curated watchlist" />
    <SummaryCard label="Average move" value={(avg >= 0 ? "+" : "") + avg.toFixed(2) + "%"} sub={changes.filter(v=>v>0).length + " up · " + changes.filter(v=>v<0).length + " down"} tone={avg>=0?"success":"error"} />
    <SummaryCard label="Top mover" value={leader?.name ?? "—"} sub={leader?.change_percent != null ? ((leader.change_percent>=0?"+":"") + leader.change_percent.toFixed(2) + "%") : "Awaiting data"} tone={(leader?.change_percent??0)>=0?"success":"error"} />
    <SummaryCard label="Data source" value={assets[0]?.currency ?? "USD"} sub="Public company quotes" />
  </>;
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "success"|"error" }) {
  return (
    <Card>
      <CardContent>
        <p className="type-eyebrow text-foreground-muted">{label}</p>
        <p className={cn("mt-1.5 truncate font-mono text-[20px] font-medium", tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-foreground")}>{value}</p>
        <p className="mt-1 text-[10px] text-foreground-muted">{sub}</p>
      </CardContent>
    </Card>
  );
}