"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { getTasks } from "@/lib/api";
import type { TaskSummary } from "@/lib/types";
import { cn, formatCost, formatRelative } from "@/lib/utils";

const filters = ["all", "running", "completed", "failed"] as const;
type Filter = (typeof filters)[number];

function glyph(status: string) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-mint" />;
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-soft" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-rose" />;
  return <Clock3 className="h-3.5 w-3.5 text-white/30" />;
}

export function ActivityView() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  async function load() {
    try {
      const data = await getTasks(60);
      setTasks(data.tasks);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Kick off after paint; the rule guards against sync cascading renders.
    const kickoff = setTimeout(() => void load(), 0);
    const timer = setInterval(load, 20_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
    };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((task) => task.status === filter)),
    [filter, tasks],
  );

  const counts = useMemo(
    () => ({
      all: tasks.length,
      running: tasks.filter((task) => task.status === "running").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      failed: tasks.filter((task) => task.status === "failed").length,
    }),
    [tasks],
  );

  return (
    <div className="pt-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">
            Execution log
          </span>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.02em] text-white">
            Activity
          </h1>
          <p className="mt-1 text-[12px] text-white/35">
            Every task, its plan, its steps and what it cost.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[10.5px] text-white/45 transition hover:border-white/20 hover:text-white/80"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {offline ? (
        <div className="mt-4 rounded-xl border border-rose/20 bg-rose/[0.04] px-3 py-2.5 text-[11px] text-rose/80">
          The ORBITO API is offline. Start it with <code className="text-white/60">make api</code>{" "}
          to load the execution log.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[10.5px] capitalize transition",
              filter === item
                ? "border-violet/35 bg-violet/15 text-violet-soft"
                : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/65",
            )}
          >
            {item} <span className="ml-1 text-white/25">{counts[item]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-[11px] text-white/35">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-soft" /> Loading activity…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center">
            <p className="text-[12px] text-white/45">No tasks here yet.</p>
            <p className="mt-1 text-[10.5px] text-white/25">
              Start a conversation and the full execution trace appears here.
            </p>
          </div>
        ) : (
          filtered.map((task) => {
            const open = expanded === task.id;
            return (
              <div key={task.id} className="glass overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : task.id)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.02]"
                >
                  {glyph(task.status)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-white/75">{task.title}</p>
                    <p className="mt-0.5 text-[9.5px] text-white/25">
                      {task.agent ?? "core"} · {formatRelative(task.created_at)}
                      {task.model ? ` · ${task.model}` : ""}
                    </p>
                  </div>
                  <span className="hidden text-[9.5px] text-white/30 sm:block">
                    {task.steps.filter((step) => step.status === "done").length}/{task.steps.length}{" "}
                    steps
                  </span>
                  <span className="w-12 text-right text-[9.5px] text-white/30">
                    {task.cost_usd ? formatCost(task.cost_usd) : "—"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-white/25 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>

                {task.status === "running" ? (
                  <div className="h-0.5 bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-violet to-mint transition-all"
                      style={{ width: `${Math.max(4, task.progress)}%` }}
                    />
                  </div>
                ) : null}

                {open ? (
                  <div className="border-t border-white/[0.05] px-3.5 py-3">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                          Plan
                        </p>
                        <ol className="mt-1.5 space-y-1.5">
                          {task.steps.map((step) => (
                            <li key={step.index} className="flex items-start gap-2">
                              {glyph(step.status)}
                              <span className="text-[10.5px] leading-snug text-white/50">
                                {step.title}
                              </span>
                            </li>
                          ))}
                          {task.steps.length === 0 ? (
                            <li className="text-[10.5px] text-white/25">Plan not recorded.</li>
                          ) : null}
                        </ol>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                          Result
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-[10.5px] leading-relaxed text-white/45">
                          {task.error
                            ? task.error
                            : task.result
                              ? `${task.result.slice(0, 700)}${task.result.length > 700 ? "…" : ""}`
                              : "Still working or no result stored."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
