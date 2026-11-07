"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import type { DashboardOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

const OrbitalScene = dynamic(() => import("@/components/three/orbital-scene"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-2xl bg-primary/[0.04]" />,
});

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeSection({
  data,
  stale,
  refreshing,
  onRefresh,
}: {
  data: DashboardOverview | null;
  stale: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), 0);
    return () => clearTimeout(timer);
  }, []);

  const active = data?.tasks.metrics.counts.active ?? 0;
  const databaseHealthy = data?.health.database === "ok";
  const providers = data?.health.providers ?? {};
  const connectedProviders = Object.entries(providers).filter(
    ([id, configured]) => configured && id !== "mock",
  );
  const localModels = data?.models.installed.length ?? 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-35" />
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data ? (databaseHealthy ? "success" : "error") : "neutral"} dot>
              {data
                ? databaseHealthy
                  ? "ORBITO core online"
                  : "Database unavailable"
                : "Connecting to ORBITO"}
            </Badge>
            {stale ? <Badge tone="warning">Stale snapshot</Badge> : null}
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-foreground-muted">
              {now
                ? now.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </span>
          </div>

          <h1 className="mt-3 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[30px]">
            {now ? `${greeting(now.getHours())}.` : "Welcome back."}{" "}
            <span className="text-gradient">What should ORBITO take care of?</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-foreground-secondary">
            {active
              ? `${active} agent${active === 1 ? "" : "s"} working right now. Every step is recorded and visible in the Agent Monitor.`
              : "Nothing is running. Start a task and ORBITO will pick the agent, the model and the tools."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-inset px-2 py-1 text-[10.5px] text-foreground-secondary">
              <Activity className="h-3 w-3 text-success" />
              {data ? `${active} active` : "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-inset px-2 py-1 text-[10.5px] text-foreground-secondary">
              <Cpu className="h-3 w-3 text-info" />
              {data?.models.enabled
                ? data.models.reachable
                  ? `${localModels} local model${localModels === 1 ? "" : "s"}`
                  : "Local models unreachable"
                : "Local models disabled"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-inset px-2 py-1 text-[10.5px] text-foreground-secondary">
              <ShieldCheck className="h-3 w-3 text-primary-hover" />
              {connectedProviders.length} cloud provider
              {connectedProviders.length === 1 ? "" : "s"} configured
            </span>
            <IconButton
              label="Refresh dashboard"
              size="icon-sm"
              onClick={onRefresh}
              className="border border-border bg-surface-inset"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </IconButton>
          </div>
        </div>

        <div className="relative hidden h-[190px] w-full lg:block">
          <OrbitalScene />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-foreground-muted">
            <Sparkles className="h-3 w-3 text-primary-hover" />
            One intelligence
          </div>
        </div>
      </div>
    </section>
  );
}
