import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "violet" | "mint" | "sky" | "amber" | "rose";
  className?: string;
}) {
  const toneClass = {
    violet: "text-violet-soft bg-violet/10 border-violet/20",
    mint: "text-mint bg-mint/10 border-mint/20",
    sky: "text-sky bg-sky/10 border-sky/20",
    amber: "text-amber bg-amber/10 border-amber/20",
    rose: "text-rose bg-rose/10 border-rose/20",
  }[tone];

  return (
    <div className={cn("glass-soft rounded-xl px-3 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">
          {label}
        </p>
        <span className={cn("grid h-6 w-6 place-items-center rounded-lg border", toneClass)}>
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[19px] font-medium leading-none text-white/90">
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-[9px] text-white/25">{hint}</p> : null}
    </div>
  );
}
