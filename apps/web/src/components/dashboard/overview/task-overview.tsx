"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ListChecks, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TaskMetrics, TaskSummary } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

function duration(task: TaskSummary) {
  if (task.duration_seconds != null) {
    const seconds = Math.round(task.duration_seconds);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  if (!task.started_at) return "—";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(task.started_at).getTime()) / 1000),
  );
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}

export function TaskOverview({
  metrics,
  tasks,
  pendingApprovals,
}: {
  metrics: TaskMetrics;
  tasks: TaskSummary[];
  pendingApprovals: number;
}) {
  const stats = [
    { label: "Running", value: metrics.counts.running, tone: "text-info" },
    { label: "Queued", value: metrics.counts.queued, tone: "text-primary-hover" },
    { label: "Completed", value: metrics.counts.completed, tone: "text-success" },
    { label: "Failed", value: metrics.counts.failed, tone: "text-error" },
    { label: "Approvals", value: pendingApprovals, tone: "text-warning" },
  ];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Task execution"
        description="Latest runs and the states that need attention"
        icon={<ListChecks className="h-3.5 w-3.5" />}
        actions={
          <Link
            href="/agents/monitor"
            className="focus-ring inline-flex items-center gap-1 rounded text-[10.5px] font-medium text-primary-hover hover:text-primary-soft"
          >
            Task Manager <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      <CardContent className="flex-1 p-0">
        <div className="grid grid-cols-5 border-b border-border-subtle">
          {stats.map((stat) => (
            <div key={stat.label} className="border-r border-border-subtle px-2.5 py-2.5 last:border-r-0">
              <p className="type-eyebrow text-[8px] text-foreground-muted">{stat.label}</p>
              <p className={cn("mt-1 font-mono text-[17px] font-medium leading-none", stat.tone)}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {!tasks.length ? (
          <EmptyState
            compact
            icon={ListChecks}
            title="No task has run yet"
            description="Send a prompt from the command center and execution will appear here."
            action={
              <Link href="/chat" className="text-[11px] font-medium text-primary-hover">
                Open chat
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border-subtle">
            {tasks.slice(0, 6).map((task) => (
              <Link
                key={task.id}
                href={`/agents/monitor?task=${task.id}`}
                className="focus-ring block px-3.5 py-2 transition-colors hover:bg-surface-hover/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium text-foreground">
                      {task.title || task.prompt || "Untitled task"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-foreground-muted">
                      <span>{task.agent ?? "core"}</span>
                      <span>·</span>
                      <span>{formatRelative(task.created_at)}</span>
                      <span>·</span>
                      <span>{duration(task)}</span>
                      {task.cost_usd ? <span>· ${task.cost_usd.toFixed(4)}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.approval_request ? (
                      <Badge tone="warning">
                        <ShieldAlert className="h-2.5 w-2.5" /> Approval
                      </Badge>
                    ) : null}
                    <StatusBadge status={task.status} />
                  </div>
                </div>
                {task.status === "running" || task.status === "paused" ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar
                      value={task.progress}
                      tone={task.status === "paused" ? "warning" : "info"}
                      size="sm"
                      className="flex-1"
                    />
                    <span className="w-7 text-right font-mono text-[8.5px] text-foreground-muted">
                      {task.progress}%
                    </span>
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
        <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
          <CheckCircle2 className="h-3 w-3 text-success" />
          {metrics.counts.completed_today} completed today
        </span>
        <span className="font-mono text-[9px] text-foreground-muted">
          avg {metrics.average_duration_seconds ?? "—"}s
        </span>
      </div>
    </Card>
  );
}
