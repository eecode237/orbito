"use client";

import Link from "next/link";
import { ArrowUpRight, Coins, Info, Server, Sparkles } from "lucide-react";

import { UsageAreaChart } from "@/components/charts/usage-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UsageBreakdown, UsagePoint, UsageSummary } from "@/lib/types";
import { cn, compactNumber, formatCost } from "@/lib/utils";

function Summary({
  label,
  value,
  hint,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-inset px-2.5 py-2">
      <p className="type-eyebrow text-[8px] text-foreground-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-[16px] font-medium leading-none", tone)}>{value}</p>
      <p className="mt-1 truncate font-mono text-[8px] text-foreground-muted">{hint}</p>
    </div>
  );
}

export function UsageOverview({
  summary,
  series,
  providers,
  models,
}: {
  summary: UsageSummary;
  series: UsagePoint[];
  providers: UsageBreakdown[];
  models: UsageBreakdown[];
}) {
  const local = providers.find((provider) => provider.name === "ollama");
  const cloud = providers.filter((provider) => provider.name !== "ollama");
  const topProvider = providers.slice(0, 4);
  const maxRequests = Math.max(1, ...topProvider.map((provider) => provider.requests));
  const chart = series.map((point) => ({
    label: point.date.slice(5),
    tokens: point.total_tokens,
    requests: point.requests,
  }));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Usage & costs"
        description="Model requests recorded by the gateway ledger"
        icon={<Coins className="h-3.5 w-3.5" />}
        actions={
          <div className="flex items-center gap-1.5">
            <Badge tone="info">Estimated</Badge>
            <Link
              href="/usage"
              className="focus-ring inline-flex items-center gap-1 rounded text-[10.5px] font-medium text-primary-hover hover:text-primary-soft"
            >
              Usage <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />
      <CardContent className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Summary
            label="Requests"
            value={compactNumber(summary.requests)}
            hint={`${summary.requests.toLocaleString()} total calls`}
          />
          <Summary
            label="Tokens"
            value={compactNumber(summary.total_tokens)}
            hint={`${compactNumber(summary.prompt_tokens)} in · ${compactNumber(
              summary.completion_tokens,
            )} out`}
          />
          <Summary
            label="Est. spend"
            value={formatCost(summary.cost_usd)}
            hint="gateway price estimate"
            tone="text-primary-hover"
          />
          <Summary
            label="Local"
            value={compactNumber(local?.requests ?? 0)}
            hint={`${compactNumber(local?.tokens ?? 0)} tokens · no billable cost`}
            tone="text-success"
          />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="type-eyebrow text-foreground-muted">Daily tokens & requests</p>
              <span className="font-mono text-[8.5px] text-foreground-muted">
                {series.length ? `${series.length} active days` : "no data"}
              </span>
            </div>
            <div className="h-[190px] rounded-lg border border-border-subtle bg-surface-inset p-1.5">
              {chart.length > 1 ? (
                <UsageAreaChart
                  data={chart}
                  formatter={(value) => compactNumber(value)}
                />
              ) : (
                <div className="grid h-full place-items-center px-4 text-center">
                  <div>
                    <Sparkles className="mx-auto h-4 w-4 text-foreground-muted" />
                    <p className="mt-1.5 text-[10.5px] text-foreground-secondary">
                      {chart.length ? "One day of usage so far" : "No model requests recorded"}
                    </p>
                    <p className="mt-0.5 text-[9px] text-foreground-muted">
                      The chart fills as tasks call a model.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="type-eyebrow text-foreground-muted">Provider breakdown</p>
              <span className="font-mono text-[8.5px] text-foreground-muted">
                {providers.length} sources
              </span>
            </div>
            <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-inset p-2.5">
              {!topProvider.length ? (
                <p className="py-6 text-center text-[10px] text-foreground-muted">
                  No provider has served a request yet.
                </p>
              ) : (
                topProvider.map((provider) => (
                  <div key={provider.name}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {provider.name === "ollama" ? (
                          <Server className="h-2.5 w-2.5 text-success" />
                        ) : (
                          <Sparkles className="h-2.5 w-2.5 text-info" />
                        )}
                        <span className="truncate font-mono text-[9.5px] text-foreground-secondary">
                          {provider.name}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-foreground-muted">
                        {provider.requests} req · {compactNumber(provider.tokens)} tok
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          provider.name === "ollama" ? "bg-success" : "bg-info",
                        )}
                        style={{ width: `${(provider.requests / maxRequests) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}

              <div className="border-t border-border-subtle pt-2">
                <p className="font-mono text-[8.5px] text-foreground-muted">
                  {models[0]
                    ? `top model · ${models[0].name} (${models[0].requests})`
                    : "no model ledger entries"}
                </p>
                <p className="mt-0.5 font-mono text-[8.5px] text-foreground-muted">
                  cloud providers billed · {cloud.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-border-subtle bg-surface-inset px-2.5 py-1.5 text-[9px] leading-relaxed text-foreground-muted">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Costs are estimates from gateway pricing. Provider invoices are not imported. Local
          inference is not assigned a monetary cost. Voice, video and scraped-page usage are not
          tracked by this ledger.
        </p>
      </CardContent>
    </Card>
  );
}
