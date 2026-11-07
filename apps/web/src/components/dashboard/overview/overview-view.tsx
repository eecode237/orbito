"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { getDashboardOverview } from "@/lib/api";
import type { DashboardOverview } from "@/lib/types";

import { ActiveAgents } from "./active-agents";
import { AutomationOverview } from "./automation-overview";
import { CommandCenter } from "./command-center";
import { ModelHubSummary } from "./model-hub-summary";
import { PendingApprovals } from "./pending-approvals";
import { QuickAccess } from "./quick-access";
import { RecentActivity } from "./recent-activity";
import { SystemHealth } from "./system-health";
import { SystemStatus } from "./system-status";
import { TaskOverview } from "./task-overview";
import { UsageOverview } from "./usage-overview";
import { WelcomeSection } from "./welcome-section";

type TelemetryPoint = { label: string; cpu: number; memory: number };
const MAX_HISTORY = 60;

export function OverviewView() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const next = await getDashboardOverview();
      setData(next);
      setError(null);
      setHistory((current) => {
        const label = new Date(next.system.timestamp).toLocaleTimeString(undefined, {
          minute: "2-digit",
          second: "2-digit",
        });
        return [
          ...current,
          {
            label,
            cpu: next.system.cpu.percent,
            memory: next.system.memory.percent,
          },
        ].slice(-MAX_HISTORY);
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The ORBITO API is unreachable. Retrying automatically.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const kickoff = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), 6_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
    };
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-7 w-[min(520px,80%)]" />
          <Skeleton className="mt-2 h-3 w-[min(420px,70%)]" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SkeletonCard className="h-[232px]" />
          </div>
          <div className="lg:col-span-4">
            <SkeletonCard className="h-[232px]" />
          </div>
          <div className="lg:col-span-7">
            <SkeletonCard className="h-[320px]" />
          </div>
          <div className="lg:col-span-5">
            <SkeletonCard className="h-[320px]" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="overflow-hidden">
        <div className="halo -right-20 -top-24 h-56 w-56 bg-error/20" />
        <CardContent className="relative grid min-h-[340px] place-items-center p-8 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-error/25 bg-error/10 text-error">
              <WifiOff className="h-5 w-5" />
            </span>
            <h1 className="mt-3 font-display text-[22px] font-semibold text-foreground">
              ORBITO core is unreachable
            </h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground-secondary">
              The dashboard cannot connect to the API, so no metrics are being shown. Nothing here
              is cached or made up.
            </p>
            <p className="mt-2 rounded-md border border-border bg-surface-inset px-2.5 py-1.5 font-mono text-[9.5px] text-foreground-muted">
              {error}
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Retry connection
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2">
          <span className="flex items-center gap-2 text-[11px] text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Connection lost — showing the last verified snapshot and retrying every 6 seconds.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
            Retry now
          </Button>
        </div>
      ) : null}

      <WelcomeSection
        data={data}
        stale={Boolean(error)}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
      />

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <CommandCenter
            agents={data.agents}
            models={data.models.catalog}
            disabled={false}
          />
        </div>
        <div className="lg:col-span-4">
          <QuickAccess />
        </div>
      </div>

      <SystemStatus data={data} />

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ActiveAgents
            agents={data.agents}
            tasks={data.tasks.active}
            recent={data.tasks.recent}
            metrics={data.tasks.metrics}
          />
        </div>
        <div className="lg:col-span-5">
          <TaskOverview
            metrics={data.tasks.metrics}
            tasks={data.tasks.recent}
            pendingApprovals={data.tasks.pending_approvals.length}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SystemHealth data={data.system} history={history} />
        </div>
        <div className="lg:col-span-4">
          <ModelHubSummary data={data} />
        </div>
        <div className="lg:col-span-3">
          <AutomationOverview />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RecentActivity events={data.activity} />
        </div>
        <div className="lg:col-span-4">
          <PendingApprovals
            approvals={data.tasks.pending_approvals}
            onChanged={() => void load(true)}
          />
        </div>
      </div>

      <UsageOverview
        summary={data.usage.summary}
        series={data.usage.series}
        providers={data.usage.breakdown.providers}
        models={data.usage.breakdown.models}
      />

      <p className="px-1 pb-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-foreground-muted">
        ORBITO · one intelligence, infinite possibilities · snapshot{" "}
        {new Date(data.generated_at).toLocaleTimeString()}
      </p>
    </div>
  );
}
