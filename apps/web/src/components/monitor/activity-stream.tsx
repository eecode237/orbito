"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  CirclePause,
  CirclePlay,
  Eraser,
  Search,
  Terminal,
  WrapText,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { TaskEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS = ["all", "info", "success", "warning", "error", "tool", "model", "agent"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_STYLE: Record<string, string> = {
  info: "text-white/45",
  success: "text-mint",
  warning: "text-amber",
  error: "text-rose",
  tool: "text-violet-soft",
  model: "text-sky",
  agent: "text-mint",
};

const LEVEL_LABEL: Record<string, string> = {
  info: "INFO",
  success: "OK",
  warning: "WARN",
  error: "ERR",
  tool: "TOOL",
  model: "MODEL",
  agent: "AGENT",
};

function time(value: string | null) {
  if (!value) return "--:--:--";
  return new Date(value).toLocaleTimeString(undefined, { hour12: false });
}

export function ActivityStream({
  events,
  paused,
  connected,
  onTogglePause,
  onClear,
}: {
  events: TaskEvent[];
  paused: boolean;
  connected: boolean;
  onTogglePause: () => void;
  onClear: () => void;
}) {
  const [level, setLevel] = useState<Level>("all");
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (level !== "all" && event.level !== level) return false;
      if (!needle) return true;
      return (
        event.message.toLowerCase().includes(needle) ||
        (event.detail ?? "").toLowerCase().includes(needle) ||
        event.kind.toLowerCase().includes(needle)
      );
    });
  }, [events, level, query]);

  useEffect(() => {
    if (paused) return;
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [filtered.length, paused]);

  return (
    <section className="glass flex min-h-0 flex-col rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-violet-soft/70" />
          <h2 className="font-display text-[12px] font-semibold text-white/85">
            Live activity
          </h2>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-mint shadow-[0_0_8px_#3ddc97]" : "bg-white/20",
            )}
          />
          <span className="font-mono text-[8.5px] text-white/25">
            {connected ? "streaming" : "polling"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePause}
            className="focus-ring grid h-6 w-6 place-items-center rounded-md border border-white/[0.07] text-white/35 transition hover:border-white/20 hover:text-white/70"
            aria-label={paused ? "Resume activity stream" : "Pause activity stream"}
            title={paused ? "Resume stream" : "Pause stream"}
          >
            {paused ? (
              <CirclePlay className="h-3 w-3" />
            ) : (
              <CirclePause className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="focus-ring grid h-6 w-6 place-items-center rounded-md border border-white/[0.07] text-white/35 transition hover:border-white/20 hover:text-white/70"
            aria-label="Clear activity log"
            title="Clear log (view only)"
          >
            <Eraser className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.05] px-3 py-2">
        <div className="relative min-w-[120px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/20" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events…"
            className="h-6 w-full rounded-md border border-white/[0.06] bg-black/25 pl-6 pr-2 font-mono text-[9px] text-white/60 outline-none placeholder:text-white/20 focus:border-violet/30"
          />
        </div>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {LEVELS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide transition",
                level === item
                  ? "border-violet/30 bg-violet/10 text-violet-soft"
                  : "border-white/[0.06] text-white/25 hover:text-white/50",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scroller}
        className="min-h-[220px] flex-1 overflow-y-auto bg-black/20 p-2 font-mono text-[9.5px] leading-[1.7]"
      >
        {filtered.length ? (
          filtered.map((event) => (
            <div
              key={event.id}
              className="group flex gap-2 rounded px-1.5 py-0.5 hover:bg-white/[0.025]"
            >
              <span className="shrink-0 text-white/20">{time(event.created_at)}</span>
              <span
                className={cn(
                  "w-[42px] shrink-0 font-semibold",
                  LEVEL_STYLE[event.level] ?? "text-white/35",
                )}
              >
                {LEVEL_LABEL[event.level] ?? "INFO"}
              </span>
              <span className="min-w-0 flex-1 text-white/55">
                {event.message}
                {event.detail ? (
                  <span className="ml-1 text-white/25">— {event.detail}</span>
                ) : null}
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            compact
            icon={events.length ? WrapText : ArrowDownToLine}
            title={events.length ? "No events match this filter" : "Waiting for execution events"}
            description={
              events.length
                ? "Clear the search or choose another level."
                : "Run a task to see what the agent understood, called and produced."
            }
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.05] px-3 py-1.5 text-[8px] text-white/20">
        <span>{filtered.length} of {events.length} events</span>
        <span>{paused ? "stream paused" : "auto-scroll on"}</span>
      </div>
    </section>
  );
}
