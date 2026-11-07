"use client";

import { Network, Workflow } from "lucide-react";

import { AgentGlyph } from "@/components/agent-glyph";
import type { Agent, TaskMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgentNetwork({
  agents,
  metrics,
}: {
  agents: Agent[];
  metrics: TaskMetrics | null;
}) {
  const active = new Map(
    (metrics?.active_agents ?? []).map((item) => [item.agent, item.running]),
  );
  const running = metrics?.counts.running ?? 0;
  const tools = Array.from(new Set(agents.flatMap((agent) => agent.tools))).slice(0, 6);

  return (
    <section className="glass rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-violet-soft/70" />
          <h2 className="font-display text-[12px] font-semibold text-white/85">
            Agent network
          </h2>
        </div>
        <span className="font-mono text-[8.5px] text-white/25">
          {running ? `${running} executing` : "idle"}
        </span>
      </div>

      <div className="relative mt-3">
        <div className="mx-auto w-fit rounded-lg border border-violet/30 bg-violet/[0.1] px-3 py-1.5 text-center">
          <p className="text-[9.5px] font-semibold text-violet-soft">ORBITO CORE</p>
          <p className="text-[7.5px] uppercase tracking-[0.14em] text-white/25">
            intent + routing
          </p>
        </div>

        <div
          className={cn(
            "mx-auto h-4 w-px",
            running ? "bg-gradient-to-b from-violet to-sky" : "bg-white/[0.08]",
          )}
        />
        <div className="mx-auto w-fit rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-center">
          <p className="flex items-center justify-center gap-1 text-[9px] font-medium text-white/70">
            <Workflow className="h-2.5 w-2.5" /> Task orchestrator
          </p>
        </div>
        <div
          className={cn(
            "mx-auto h-4 w-px",
            running ? "bg-gradient-to-b from-sky to-mint" : "bg-white/[0.08]",
          )}
        />

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {agents.slice(0, 6).map((agent) => {
            const count = active.get(agent.slug) ?? 0;
            return (
              <div
                key={agent.slug}
                className={cn(
                  "relative rounded-lg border p-1.5 transition",
                  count
                    ? "border-sky/30 bg-sky/[0.06]"
                    : "border-white/[0.06] bg-black/20",
                )}
              >
                {count ? (
                  <span className="absolute right-1.5 top-1.5 h-1 w-1 animate-pulse rounded-full bg-sky shadow-[0_0_6px_#38bdf8]" />
                ) : null}
                <div className="flex items-center gap-1.5">
                  <AgentGlyph
                    slug={agent.slug}
                    className={cn("h-3 w-3", count ? "text-sky" : "text-white/30")}
                  />
                  <p className="truncate text-[9px] font-medium text-white/60">
                    {agent.name}
                  </p>
                </div>
                <p className="mt-0.5 truncate font-mono text-[7.5px] text-white/20">
                  {count ? `${count} running` : agent.model_role}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {tools.map((tool) => (
            <span
              key={tool}
              className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[7.5px] text-white/25"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
