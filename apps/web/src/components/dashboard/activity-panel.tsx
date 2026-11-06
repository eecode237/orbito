"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Radio,
  XCircle,
} from "lucide-react";

import { getTasks } from "@/lib/api";
import type { TaskSummary } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

function StatusGlyph({ status }: { status: string }) {
  if (status === "running")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-soft" />;
  if (status === "completed")
    return <CheckCircle2 className="h-3.5 w-3.5 text-mint" />;
  if (status === "failed")
    return <XCircle className="h-3.5 w-3.5 text-rose" />;
  return <Clock3 className="h-3.5 w-3.5 text-white/35" />;
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "running"
      ? "bg-violet/15 text-violet-soft"
      : status === "completed"
        ? "bg-mint/10 text-mint"
        : status === "failed"
          ? "bg-rose/10 text-rose"
          : "bg-white/5 text-white/40";
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        styles,
      )}
    >
      {status}
    </span>
  );
}

export function ActivityPanel() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await getTasks(8);
        if (alive) {
          setTasks(data.tasks);
          setOffline(false);
        }
      } catch {
        if (alive) setOffline(true);
      }
    }
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const running = tasks.filter((task) => task.status === "running").length;

  return (
    <section className="glass flex h-full flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[14px] font-semibold text-white/90">Activity</h2>
          {running > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-violet/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-soft">
              <Radio className="h-2.5 w-2.5" /> {running} live
            </span>
          ) : null}
        </div>
        <Link
          href="/activity"
          className="flex items-center gap-1 text-[10.5px] text-white/35 transition hover:text-white/75"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-4 flex-1 space-y-3.5 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center">
            <p className="text-[12px] text-white/45">No activity yet.</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/25">
              {offline
                ? "The ORBITO API is offline. Start it with `make api`."
                : "Run a task and the execution timeline will show up here."}
            </p>
            <Link
              href="/chat"
              className="mt-3 inline-flex rounded-lg bg-violet/15 px-3 py-1.5 text-[11px] font-medium text-violet-soft transition hover:bg-violet/25"
            >
              Start a task
            </Link>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="group">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
                  <StatusGlyph status={task.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-[11.5px] leading-snug text-white/75 transition group-hover:text-white">
                      {task.title}
                    </p>
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/25">
                    <span className="capitalize">{task.agent ?? "core"}</span>
                    <span className="text-white/10">·</span>
                    <span>{formatRelative(task.created_at)}</span>
                  </div>
                  {task.status === "running" ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet to-sky transition-all"
                        style={{ width: `${Math.max(6, task.progress ?? 0)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
          </span>
          <p className="text-[10.5px] text-white/40">
            {offline ? "Waiting for the ORBITO API" : "All systems operational"}
          </p>
        </div>
      </div>
    </section>
  );
}
