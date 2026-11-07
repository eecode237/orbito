"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Clock3, History, Play } from "lucide-react";

import { AgentAvatar, ModelBadge } from "@/components/ui/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Agent, TaskSummary, TaskMetrics } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

const BUSY = new Set(["running", "paused", "queued"]);

function duration(task: TaskSummary) {
  if (!task.started_at) return null;
  const end = task.finished_at ? new Date(task.finished_at).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(task.started_at).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function agentStatus(agent: Agent, task: TaskSummary | undefined) {
  if (!task) return { label: "Idle", status: "idle" };
  if (task.approval_request) return { label: "Awaiting approval", status: "waiting" };
  return { label: task.status, status: task.status };
}

export function ActiveAgents({
  agents,
  tasks,
  recent,
  metrics,
}: {
  agents: Agent[];
  tasks: TaskSummary[];
  recent: TaskSummary[];
  metrics: TaskMetrics;
}) {
  const running = tasks.filter((task) => BUSY.has(task.status));
  const counts = new Map(metrics.active_agents.map((item) => [item.agent, item.running]));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Active agents"
        description="Registered specialists and their current execution"
        icon={<Bot className="h-3.5 w-3.5" />}
        actions={
          <Link
            href="/agents/monitor"
            className="focus-ring inline-flex items-center gap-1 rounded text-[10.5px] font-medium text-primary-hover hover:text-primary-soft"
          >
            Agent Monitor <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      <CardContent className="flex-1 p-3">
        {!agents.length ? (
          <EmptyState
            compact
            icon={Bot}
            title="No agents registered"
            description="The registry is empty, so there is nothing to dispatch yet."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {agents.map((agent) => {
              const task = running.find((item) => item.agent === agent.slug);
              const latest =
                recent.find((item) => item.agent === agent.slug) ??
                tasks.find((item) => item.agent === agent.slug);
              const count = counts.get(agent.slug) ?? 0;
              const state = agentStatus(agent, task);
              const model = task?.model ?? agent.model_role;

              return (
                <article
                  key={agent.slug}
                  className="group rounded-lg border border-border-subtle bg-surface-inset p-2.5 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <AgentAvatar slug={agent.slug} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[11.5px] font-medium text-foreground">
                          {agent.name}
                        </p>
                        <p className="truncate font-mono text-[8.5px] uppercase tracking-[0.12em] text-foreground-muted">
                          {agent.accent} · {count} running
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={state.status} label={state.label} />
                  </div>

                  <p className="mt-2 line-clamp-1 text-[10.5px] text-foreground-secondary">
                    {task ? task.title : "Waiting for the next assignment."}
                  </p>

                  <div className="mt-2">
                    <ProgressBar
                      value={task?.progress ?? 0}
                      tone={state.status === "failed" ? "error" : state.status === "waiting" ? "warning" : "info"}
                      size="sm"
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                    <ModelBadge provider={task?.provider ?? null} model={model} />
                    <span className="flex items-center gap-1 font-mono text-[9px] text-foreground-muted">
                      {task ? (
                        <>
                          <Clock3 className="h-2.5 w-2.5" />
                          {duration(task) ?? "just started"}
                        </>
                      ) : (
                        <>
                          <History className="h-2.5 w-2.5" />
                          {latest ? `last ${formatRelative(latest.created_at)}` : "no history"}
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    <Link href={task ? `/agents/monitor?task=${task.id}` : `/chat?agent=${agent.slug}`}>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[9.5px]">
                        {task ? <Play className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                        {task ? "Inspect" : "Start"}
                      </Button>
                    </Link>
                    <Link href={`/agents/monitor?agent=${agent.slug}`}>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[9.5px]">
                        <History className="h-2.5 w-2.5" />
                        History
                      </Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
        <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
          <Badge tone={running.length ? "info" : "neutral"}>{running.length} active</Badge>
          {metrics.counts.paused ? <Badge tone="warning">{metrics.counts.paused} paused</Badge> : null}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-foreground-muted">
          {agents.length} registered
        </span>
      </div>
    </Card>
  );
}
