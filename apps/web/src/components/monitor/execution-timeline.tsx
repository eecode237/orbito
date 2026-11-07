"use client";

import { useState } from "react";
import {
  ChevronRight,
  Circle,
  CircleCheck,
  CircleX,
  Clock3,
  Loader2,
  MinusCircle,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { TaskStep, TaskSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function StepIcon({ status }: { status: TaskStep["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky" />;
    case "done":
      return <CircleCheck className="h-3.5 w-3.5 text-mint" />;
    case "failed":
      return <CircleX className="h-3.5 w-3.5 text-rose" />;
    case "skipped":
      return <MinusCircle className="h-3.5 w-3.5 text-white/25" />;
    case "cancelled":
      return <CircleX className="h-3.5 w-3.5 text-white/30" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-white/20" />;
  }
}

function seconds(value?: number | null) {
  if (value === null || value === undefined) return null;
  if (value < 1) return `${Math.round(value * 1000)}ms`;
  if (value < 60) return `${value.toFixed(1)}s`;
  return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
}

export function ExecutionTimeline({ task }: { task: TaskSummary | null }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!task) {
    return (
      <section className="glass grid min-h-[360px] place-items-center rounded-2xl p-6 text-center">
        <div>
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
            <Clock3 className="h-4 w-4 text-white/25" />
          </span>
          <p className="mt-3 text-[12px] font-medium text-white/55">Select a task</p>
          <p className="mt-1 text-[10.5px] text-white/25">
            Choose a running or historical task to inspect its execution timeline.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="glass flex min-h-0 flex-col rounded-2xl">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-soft/60">
              Execution timeline
            </p>
            <h2 className="mt-1 truncate font-display text-[14px] font-semibold text-white/90">
              {task.title}
            </h2>
            <p className="mt-0.5 font-mono text-[8.5px] text-white/25">
              {task.id}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={task.status} />
            <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] text-white/30">
              {task.steps.filter((step) => step.status === "done").length}/{task.steps.length} steps
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-white/30">
          <span>{task.agent ?? "core"} agent</span>
          <span>·</span>
          <span className="font-mono">{task.model ?? "model pending"}</span>
          <span>·</span>
          <span>{task.provider ?? "provider pending"}</span>
          <span>·</span>
          <span>{seconds(task.duration_seconds) ?? "running"}</span>
        </div>

        {task.approval_request ? (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber/25 bg-amber/[0.06] px-2.5 py-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
            <div>
              <p className="text-[10px] font-medium text-amber">Approval required</p>
              <p className="mt-0.5 text-[9.5px] leading-snug text-white/40">
                {task.approval_request}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto p-3">
        {task.steps.map((step, index) => {
          const open = expanded === step.index;
          const isLast = index === task.steps.length - 1;
          return (
            <li key={step.index} className="relative pl-7">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[10px] top-6 h-[calc(100%-8px)] w-px",
                    step.status === "done" ? "bg-mint/20" : "bg-white/[0.07]",
                  )}
                />
              ) : null}
              <span className="absolute left-0 top-1 grid h-5 w-5 place-items-center rounded-full border border-white/[0.08] bg-[#0b0818]">
                <StepIcon status={step.status} />
              </span>

              <button
                type="button"
                onClick={() => setExpanded(open ? null : step.index)}
                aria-expanded={open}
                className="focus-ring group w-full rounded-xl px-1 py-1.5 text-left transition hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-[9px] text-white/20">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[11.5px]",
                        step.status === "running"
                          ? "font-medium text-white/90"
                          : step.status === "pending"
                            ? "text-white/40"
                            : "text-white/70",
                      )}
                    >
                      {step.title}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {step.tool ? (
                      <span className="flex items-center gap-1 rounded-md border border-violet/20 bg-violet/[0.07] px-1.5 py-0.5 text-[8px] text-violet-soft/80">
                        <Wrench className="h-2.5 w-2.5" />
                        {step.tool}
                      </span>
                    ) : null}
                    {step.duration_seconds !== null &&
                    step.duration_seconds !== undefined ? (
                      <span className="font-mono text-[8.5px] text-white/25">
                        {seconds(step.duration_seconds)}
                      </span>
                    ) : null}
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 text-white/20 transition-transform",
                        open && "rotate-90",
                      )}
                    />
                  </span>
                </div>
              </button>

              {open ? (
                <div className="mb-2 ml-1 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <p className="text-[10px] leading-relaxed text-white/45">
                    {step.detail ||
                      (step.status === "pending"
                        ? "This step has not started yet."
                        : "No additional output was recorded for this step.")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[8.5px] text-white/20">
                    <span>status: {step.status}</span>
                    {step.started_at ? (
                      <span>started: {new Date(step.started_at).toLocaleTimeString()}</span>
                    ) : null}
                    {step.finished_at ? (
                      <span>finished: {new Date(step.finished_at).toLocaleTimeString()}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
