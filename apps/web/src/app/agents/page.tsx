import type { Metadata } from "next";
import { Database, GitBranch, ShieldCheck } from "lucide-react";

import { AgentsGrid } from "@/components/agents/agents-grid";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(23,16,44,0.88),rgba(8,5,18,0.92))] p-6">
        <div className="halo -right-10 -top-16 h-56 w-56 bg-violet/25" />
        <div className="relative">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">
            Agent registry
          </span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            Specialists. <span className="text-gradient">One workspace.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
            Every agent shares the same memory, permissions and model gateway. ORBITO routes
            automatically, or you pick the specialist yourself.
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-[10.5px] text-white/35">
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-violet-soft/70" /> Explicit handoffs, no
              runaway delegation
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-mint/70" /> Shared task + memory store
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sky/70" /> Per-action approval policy
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AgentsGrid />
      </div>
    </div>
  );
}
