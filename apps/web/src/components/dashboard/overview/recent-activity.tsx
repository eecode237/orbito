"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BellRing,
  Bot,
  CheckCircle2,
  Cpu,
  FileText,
  History,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { TaskEvent } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "tasks", label: "Tasks" },
  { id: "approvals", label: "Approvals" },
  { id: "models", label: "Models" },
] as const;

function groupFor(kind: string) {
  if (kind.startsWith("approval.")) return "approvals";
  if (kind.startsWith("model.") || kind.includes("model")) return "models";
  if (kind.startsWith("agent.") || kind.startsWith("step.")) return "agents";
  return "tasks";
}

function iconFor(event: TaskEvent) {
  if (event.kind.includes("failed") || event.level === "error") return XCircle;
  if (event.kind.includes("completed") || event.kind === "approval.approved") return CheckCircle2;
  if (event.kind.startsWith("approval.")) return ShieldCheck;
  if (event.kind.includes("model")) return Cpu;
  if (event.kind.includes("file") || event.kind.includes("document")) return FileText;
  if (event.kind.includes("agent")) return Bot;
  if (event.kind.includes("retried") || event.kind.includes("created")) return BellRing;
  return Activity;
}

function toneFor(event: TaskEvent) {
  if (event.level === "error") return "text-error bg-error/10 border-error/25";
  if (event.level === "warning") return "text-warning bg-warning/10 border-warning/25";
  if (event.level === "success") return "text-success bg-success/10 border-success/25";
  if (event.level === "tool" || event.level === "model") {
    return "text-info bg-info/10 border-info/25";
  }
  return "text-foreground-secondary bg-foreground/[0.04] border-border";
}

export function RecentActivity({ events }: { events: TaskEvent[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const visible =
    filter === "all" ? events : events.filter((event) => groupFor(event.kind) === filter);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Recent activity"
        description="Execution events written by the orchestrator"
        icon={<History className="h-3.5 w-3.5" />}
        actions={
          <Link
            href="/agents/monitor"
            className="focus-ring rounded text-[10.5px] font-medium text-primary-hover hover:text-primary-soft"
          >
            Full stream
          </Link>
        }
      />
      <div className="flex gap-1 border-b border-border-subtle px-3 py-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "focus-ring rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors",
              filter === item.id
                ? "bg-primary/12 text-primary-hover"
                : "text-foreground-muted hover:text-foreground-secondary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <CardContent className="flex-1 p-0">
        {!visible.length ? (
          <EmptyState
            compact
            icon={Activity}
            title={events.length ? "No events in this filter" : "No execution events yet"}
            description={
              events.length
                ? "Switch filters to see the rest of the stream."
                : "Run a task and its events will appear here."
            }
          />
        ) : (
          <div className="divide-y divide-border-subtle">
            {visible.slice(0, 8).map((event) => {
              const Icon = iconFor(event);
              return (
                <Link
                  key={event.id}
                  href={`/agents/monitor?task=${event.task_id}`}
                  className="focus-ring flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-surface-hover/40"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border",
                      toneFor(event),
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] text-foreground-secondary">
                      {event.message}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[8.5px] text-foreground-muted">
                      <span className="truncate">{event.kind}</span>
                      <span>·</span>
                      <span className="shrink-0">{formatRelative(event.created_at)}</span>
                      {event.detail ? (
                        <>
                          <span>·</span>
                          <span className="truncate">{event.detail}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
      <div className="border-t border-border-subtle px-4 py-2 font-mono text-[9px] text-foreground-muted">
        {events.length} events · newest first · click to inspect
      </div>
    </Card>
  );
}
