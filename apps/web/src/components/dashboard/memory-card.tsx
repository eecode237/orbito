"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrainCircuit, ArrowUpRight } from "lucide-react";

import { getMemories } from "@/lib/api";
import type { MemoryItem } from "@/lib/types";

export function MemoryCard() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);

  useEffect(() => {
    let alive = true;
    getMemories()
      .then((data) => {
        if (alive) setMemories(data.memories.slice(0, 3));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-mint" />
          <h2 className="font-display text-[13px] font-semibold text-white/90">
            ORBITO remembers
          </h2>
        </div>
        <Link
          href="/settings?tab=memory"
          className="text-white/30 transition hover:text-white/70"
          aria-label="Manage memory"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {memories.length === 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-white/30">
          Nothing stored yet. Say “remember that…” in chat, or add a fact in Settings → Memory.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-[10.5px] leading-relaxed text-white/50"
            >
              {memory.content}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[9.5px] text-white/20">
        You control what is stored. Inspect or delete anytime.
      </p>
    </section>
  );
}
