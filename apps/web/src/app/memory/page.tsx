import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

import { MemoryView } from "@/components/memory/memory-view";

export const metadata: Metadata = {
  title: "Memory",
  description: "View and manage ORBITO's user-controlled long-term and workspace memories.",
};

export default function MemoryPage() {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(16,34,44,0.82),rgba(8,8,18,0.94))] p-6">
        <div className="halo -right-10 -top-16 h-56 w-56 bg-primary/15" />
        <div className="relative">
          <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">
            <BrainCircuit className="h-3.5 w-3.5" /> User-controlled context
          </span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            <span className="text-gradient">Memory</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
            Real memories stored in ORBITO. Save, search, and delete what the system should remember — with no fabricated entries.
          </p>
        </div>
      </div>
      <div className="mt-5">
        <MemoryView />
      </div>
    </div>
  );
}
