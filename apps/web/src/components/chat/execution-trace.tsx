"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

import type { Agent, TaskStep } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ExecutionTrace({
  steps,
  agent,
  streaming,
}: {
  steps: TaskStep[];
  agent: Agent | null;
  streaming: boolean;
}) {
  // `null` follows the run (open while working, collapsed when done until the
  // user toggles). The parent remounts this component per task.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? streaming;

  if (steps.length === 0) return null;

  const doneCount = steps.filter((step) => step.status === "done").length;

  return (
    <div className="w-full max-w-[760px] overflow-hidden rounded-xl border border-white/[0.07] bg-[#0a0716]/80">
      <button
        type="button"
        onClick={() => setManual(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.02]"
      >
        {streaming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-soft" />
        ) : (
          <Check className="h-3.5 w-3.5 text-mint" />
        )}
        <span className="text-[11.5px] font-medium text-white/70">
          {streaming ? "ORBITO is working…" : `${doneCount}/${steps.length} steps complete`}
        </span>
        <span className="text-[10px] text-white/25">
          {agent ? `· ${agent.name} agent` : ""}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 text-white/30 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ol className="space-y-1.5 border-t border-white/[0.05] px-3 py-2.5">
          {steps.map((step) => (
            <li key={step.index} className="flex items-start gap-2">
              <span className="mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center">
                {step.status === "done" ? (
                  <Check className="h-3.5 w-3.5 text-mint" />
                ) : step.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-violet-soft" />
                ) : step.status === "failed" ? (
                  <X className="h-3.5 w-3.5 text-rose" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full border border-white/25" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[11px] leading-tight",
                    step.status === "pending" ? "text-white/30" : "text-white/65",
                  )}
                >
                  {step.title}
                </p>
                {step.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/28">
                    {step.detail}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
