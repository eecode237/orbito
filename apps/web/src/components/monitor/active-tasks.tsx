"use client";

import { Activity, CircleDot, PauseCircle } from "lucide-react";

import { AgentGlyph } from "@/components/agent-glyph";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TaskSummary } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

export function ActiveTasks({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: TaskSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const active = tasks.filter((task) =>
    ["running", "paused", "queued"].includes(task.status),
  );

  return (
    <section className="glass flex min-h-0 flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-violet-soft/70" />
          <h2 className="font-display text-[12px] font-semibold text-white/85">
            Active tasks
          </h2>
        </div>
        <span className="font-mono text-[9px] text-white/25">{active.length} live</span>
      </div>

      {active.length ? (
        <div className="max-h-[260px] space-y-1 overflow-y-auto p-2">
          {active.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelect(task.id)}
              className={cn(
                "focus-ring w-full rounded-xl border px-2.5 py-2 text-left transition",
                selectedId === task.id
                  ? "border-violet/35 bg-violet/[0.09]"
                  : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.025]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <AgentGlyph slug={task.agent ?? "core"} className="h-3 w-3 shrink-0 text-violet-soft" />
                  <span className="truncate text-[10.5px] font-medium text-white/75">
                    {task.title}
                  </span>
                </span>
                <StatusBadge status={task.status} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[8.5px] text-white/25">
                <span className="flex items-center gap-1">
                  {task.status === "paused" ? (
                    <PauseCircle className="h-2.5 w-2.5" />
                  ) : (
                    <CircleDot className="h-2.5 w-2.5 text-sky" />
                  )}
                  {task.agent ?? "core"} · {task.model ?? "resolving model"}
                </span>
                <span>{formatRelative(task.created_at)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet to-sky transition-all"
                  style={{ width: `${Math.max(4, task.progress)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={Activity}
          title="No tasks running"
          description="Start a task in Chat and it will appear here with live execution events."
        />
      )}
    </section>
  );
}
