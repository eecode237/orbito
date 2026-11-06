"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Coins, Gauge, Layers } from "lucide-react";

import { getTasks, getUsage } from "@/lib/api";
import type { UsageSummary } from "@/lib/types";
import { compactNumber, formatCost } from "@/lib/utils";

const emptyUsage: UsageSummary = {
  requests: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  cost_usd: 0,
};

export function StatsRow() {
  const [usage, setUsage] = useState<UsageSummary>(emptyUsage);
  const [tasks, setTasks] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([getUsage(), getTasks(50)])
      .then(([usageData, taskData]) => {
        if (!alive) return;
        setUsage(usageData);
        setTasks(taskData.tasks.length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const items = [
    { label: "Tasks", value: compactNumber(tasks), icon: Layers, accent: "text-violet-soft" },
    {
      label: "Model calls",
      value: compactNumber(usage.requests),
      icon: Gauge,
      accent: "text-sky",
    },
    {
      label: "Tokens",
      value: compactNumber(usage.total_tokens),
      icon: BrainCircuit,
      accent: "text-mint",
    },
    { label: "Est. cost", value: formatCost(usage.cost_usd), icon: Coins, accent: "text-amber" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass-soft flex items-center gap-3 rounded-xl px-3.5 py-3"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
            <item.icon className={`h-4 w-4 ${item.accent}`} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold text-white/90">
              {item.value}
            </p>
            <p className="text-[9.5px] uppercase tracking-[0.16em] text-white/25">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
