"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Coins, Loader2, RefreshCw } from "lucide-react";

import { getDashboardOverview } from "@/lib/api";
import type { DashboardOverview } from "@/lib/types";
import { formatCost } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Usage = DashboardOverview["usage"];

export function UsageView() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const overview = await getDashboardOverview();
      setUsage(overview.usage);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-warning">
          <Coins className="h-3.5 w-3.5" /> Model usage
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Usage &amp; costs</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Tokens and estimated cost from recorded model calls. Local Ollama calls cost $0; days with no calls are not shown.
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      {loading && !usage ? (
        <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading usage…</div>
      ) : usage ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Requests" value={usage.summary.requests.toLocaleString()} />
            <Stat label="Total tokens" value={usage.summary.total_tokens.toLocaleString()} />
            <Stat label="Prompt / completion" value={`${usage.summary.prompt_tokens.toLocaleString()} / ${usage.summary.completion_tokens.toLocaleString()}`} />
            <Stat label="Estimated cost" value={formatCost(usage.summary.cost_usd)} />
          </div>

          <Card>
            <CardHeader title="Daily usage" description="Only days with recorded calls" icon={<Coins className="h-3.5 w-3.5" />} actions={<Button variant="secondary" size="sm" onClick={() => { void load(); }} aria-label="Refresh usage"><RefreshCw className="h-3.5 w-3.5" /></Button>} />
            <CardContent>
              {usage.series.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-foreground-secondary">No model calls recorded yet.</p>
              ) : (
                <table className="w-full text-left text-[11px]">
                  <thead className="text-[9.5px] uppercase tracking-wide text-foreground-muted">
                    <tr><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Requests</th><th className="py-2 font-medium">Tokens</th><th className="py-2 font-medium">Cost</th></tr>
                  </thead>
                  <tbody>
                    {usage.series.map((point) => (
                      <tr key={point.date} className="border-t border-border-subtle">
                        <td className="py-2 font-mono text-[10px]">{point.date}</td>
                        <td className="py-2">{point.requests}</td>
                        <td className="py-2">{point.total_tokens.toLocaleString()}</td>
                        <td className="py-2">{formatCost(point.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <BreakdownCard title="By provider" rows={usage.breakdown.providers} />
            <BreakdownCard title="By model" rows={usage.breakdown.models} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] font-medium text-foreground-muted">{label}</p>
        <p className="mt-1 font-mono text-[18px] font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Usage["breakdown"]["providers"] }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-foreground-secondary">No data yet.</p>
        ) : (
          <ul className="space-y-2 text-[11px]">
            {rows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2 first:border-t-0 first:pt-0">
                <span className="truncate font-mono text-[10px] text-foreground">{row.name}</span>
                <span className="shrink-0 text-foreground-muted">{row.requests} req · {row.tokens.toLocaleString()} tok · {formatCost(row.cost_usd)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
