"use client";

import {
  Activity,
  Bot,
  CircleCheck,
  CircleX,
  Radio,
  Timer,
} from "lucide-react";

import { MetricCard } from "@/components/ui/metric-card";
import type { TaskMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

function duration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function MonitorHeader({
  metrics,
  live,
  updatedAt,
}: {
  metrics: TaskMetrics | null;
  live: boolean;
  updatedAt: string | null;
}) {
  const counts = metrics?.counts;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(150deg,rgba(23,16,44,0.86),rgba(8,5,18,0.92))] p-5 sm:p-6">
      <div className="halo -right-16 -top-20 h-52 w-52 bg-violet/20" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">
            Execution observability
          </span>
          <h1 className="mt-1.5 font-display text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[32px]">
            Agent <span className="text-gradient">Monitor</span>
          </h1>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-white/35">
            Observe, inspect and control everything your agents do. Every event below comes
            from a real task run — not a simulated animation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em]",
              live
                ? "border-mint/25 bg-mint/[0.07] text-mint"
                : "border-rose/25 bg-rose/[0.07] text-rose",
            )}
          >
            <Radio className={cn("h-3 w-3", live && "animate-pulse")} />
            {live ? "Live" : "API offline"}
          </span>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 font-mono text-[9px] text-white/30">
            {updatedAt
              ? `synced ${new Date(updatedAt).toLocaleTimeString()}`
              : "connecting…"}
          </span>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          icon={Bot}
          label="Active agents"
          value={metrics?.active_agents.length ?? "—"}
          hint={
            metrics?.active_agents.length
              ? metrics.active_agents
                  .map((item) => `${item.agent} ×${item.running}`)
                  .join(" · ")
              : "idle"
          }
          tone="sky"
        />
        <MetricCard
          icon={Activity}
          label="Running tasks"
          value={counts?.running ?? "—"}
          hint={`${counts?.paused ?? 0} paused`}
          tone="violet"
        />
        <MetricCard
          icon={CircleCheck}
          label="Completed"
          value={counts?.completed ?? "—"}
          hint={`${counts?.completed_today ?? 0} today`}
          tone="mint"
        />
        <MetricCard
          icon={CircleX}
          label="Failed"
          value={counts?.failed ?? "—"}
          hint={`${counts?.failed_today ?? 0} today`}
          tone="rose"
        />
        <MetricCard
          icon={Timer}
          label="Avg execution"
          value={duration(metrics?.average_duration_seconds ?? null)}
          hint={`${counts?.all ?? 0} tasks tracked`}
          tone="amber"
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </header>
  );
}
