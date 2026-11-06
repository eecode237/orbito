"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Radio } from "lucide-react";

import { getAgents, getTasks } from "@/lib/api";
import { fallbackAgents } from "@/lib/agents";
import { accentStyles, agentIcon } from "@/lib/nav";
import type { Agent, TaskSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgentFleet() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([getAgents(), getTasks(50)])
      .then(([agentData, taskData]) => {
        if (!alive) return;
        if (agentData.agents.length) setAgents(agentData.agents);
        setTasks(taskData.tasks);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, { total: number; running: number }>();
    for (const task of tasks) {
      const slug = task.agent ?? "core";
      const entry = map.get(slug) ?? { total: 0, running: 0 };
      entry.total += 1;
      if (task.status === "running") entry.running += 1;
      map.set(slug, entry);
    }
    return map;
  }, [tasks]);

  const running = tasks.filter((task) => task.status === "running").length;

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[13.5px] font-semibold text-white/90">
            Agent fleet
          </h2>
          {running > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-violet/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-soft">
              <Radio className="h-2.5 w-2.5 animate-pulse" /> {running} running
            </span>
          ) : (
            <span className="text-[9px] uppercase tracking-wide text-white/25">
              {agents.length} specialists
            </span>
          )}
        </div>
        <Link
          href="/agents"
          className="flex items-center gap-1 text-[10.5px] text-violet-soft/75 transition hover:text-violet-soft"
        >
          Manage <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const accent = accentStyles[agent.accent] ?? accentStyles.violet;
          const Icon = agentIcon(agent.slug);
          const count = counts.get(agent.slug);
          return (
            <Link
              key={agent.slug}
              href={`/chat?agent=${agent.slug}`}
              className="group flex items-start gap-2.5 bg-[#0b0718]/60 px-4 py-3 transition hover:bg-white/[0.03]"
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                  accent.bg,
                  accent.border,
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", accent.text)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11.5px] font-medium text-white/80 transition group-hover:text-white">
                    {agent.name}
                  </span>
                  {count?.running ? (
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-mint" />
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[9.5px] text-white/28">
                  {agent.model_role} model
                  {count?.total ? ` · ${count.total} task${count.total === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
