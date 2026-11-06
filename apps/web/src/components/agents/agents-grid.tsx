"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Lock, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import { fallbackAgents } from "@/lib/agents";
import { getAgents } from "@/lib/api";
import { accentStyles, agentIcon } from "@/lib/nav";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgentsGrid() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    getAgents()
      .then((data) => {
        if (!alive) return;
        if (data.agents.length) setAgents(data.agents);
        setLive(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-[10.5px] text-white/30">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            live ? "bg-mint shadow-[0_0_8px_#3ddc97]" : "bg-amber shadow-[0_0_8px_#f5a524]",
          )}
        />
        {live ? "Connected to the ORBITO agent registry" : "Showing the bundled agent registry"}
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {agents.map((agent) => {
          const accent = accentStyles[agent.accent] ?? accentStyles.violet;
          const Icon = agentIcon(agent.slug);
          const isCore = agent.slug === "core";
          return (
            <article
              key={agent.slug}
              className={cn(
                "card-hover group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(160deg,rgba(21,15,40,0.9),rgba(8,5,18,0.92))] p-5",
                accent.glow,
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-70",
                  accent.gradient,
                )}
              />

              <div className="relative flex items-start justify-between">
                <div
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-xl border",
                    accent.bg,
                    accent.border,
                  )}
                >
                  <Icon className={cn("h-5 w-5", accent.text)} />
                </div>
                {isCore ? (
                  <span className="flex items-center gap-1 rounded-full border border-violet/25 bg-violet/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-soft">
                    <Sparkles className="h-2.5 w-2.5" /> Always on
                  </span>
                ) : (
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[9px] uppercase tracking-wide text-white/30">
                    {agent.model_role} model
                  </span>
                )}
              </div>

              <h2 className="relative mt-4 font-display text-[17px] font-semibold text-white/95">
                {agent.name}
              </h2>
              <p className="relative mt-1 text-[11.5px] leading-relaxed text-white/40">
                {agent.tagline}
              </p>
              <p className="relative mt-3 text-[11px] leading-relaxed text-white/30">
                {agent.description}
              </p>

              <div className="relative mt-4 flex flex-wrap gap-1.5">
                {agent.capabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 py-1 text-[9.5px] text-white/45"
                  >
                    {capability}
                  </span>
                ))}
              </div>

              <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-3 text-[9.5px] text-white/30">
                <div className="flex items-start gap-1.5">
                  <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-white/25" />
                  <span className="leading-snug">{agent.tools.join(", ") || "reasoning only"}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  {agent.approval_required.length ? (
                    <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber/70" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-mint/70" />
                  )}
                  <span className="leading-snug">
                    {agent.approval_required.length
                      ? `${agent.approval_required.length} approval gate${agent.approval_required.length > 1 ? "s" : ""}`
                      : "No approval gates"}
                  </span>
                </div>
              </div>

              <div className="relative mt-4 flex items-center justify-between gap-2">
                <span className="truncate text-[9.5px] text-white/20">
                  {agent.samples[0] ?? "Ready when you are"}
                </span>
                <Link
                  href={`/chat?agent=${agent.slug}`}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-medium transition hover:brightness-125",
                    accent.bg,
                    accent.border,
                    accent.text,
                  )}
                >
                  Open <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
