import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const tones = {
  violet: {
    icon: "text-primary-hover bg-primary/10 border-primary/20",
    value: "text-foreground",
  },
  mint: {
    icon: "text-success bg-success/10 border-success/20",
    value: "text-foreground",
  },
  sky: {
    icon: "text-info bg-info/10 border-info/20",
    value: "text-foreground",
  },
  amber: {
    icon: "text-warning bg-warning/10 border-warning/20",
    value: "text-foreground",
  },
  rose: {
    icon: "text-error bg-error/10 border-error/20",
    value: "text-foreground",
  },
};

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
  tone?: keyof typeof tones;
  className?: string;
}) {
  const style = tones[tone];

  return (
    <div className={cn("rounded-lg border border-border bg-surface-inset px-3 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="type-eyebrow text-foreground-muted">{label}</p>
        <span className={cn("grid h-6 w-6 place-items-center rounded-md border", style.icon)}>
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <p className={cn("mt-2 font-mono text-[19px] font-medium leading-none", style.value)}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 truncate text-[9.5px] text-foreground-muted">{hint}</p> : null}
    </div>
  );
}
