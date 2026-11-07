import { cn } from "@/lib/utils";

const toneClass = {
  primary: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  neutral: "bg-foreground-muted",
};

export type ProgressTone = keyof typeof toneClass;

export function ProgressBar({
  value,
  tone = "primary",
  className,
  trackClassName,
  size = "md",
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
  trackClassName?: string;
  size?: "sm" | "md" | "lg";
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "overflow-hidden rounded-full bg-foreground/[0.07]",
        size === "sm" ? "h-1" : size === "lg" ? "h-2.5" : "h-1.5",
        trackClassName,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", toneClass[tone], className)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  tone = "primary",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: ProgressTone;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const colors = {
    primary: "var(--primary)",
    info: "var(--info)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--error)",
    neutral: "var(--foreground-muted)",
  };
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono text-[9.5px] font-medium text-foreground-secondary">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}

export function Sparkline({
  values,
  height = 40,
  tone = "primary",
  max = 100,
  className,
}: {
  values: number[];
  height?: number;
  tone?: ProgressTone;
  max?: number;
  className?: string;
}) {
  const points = values.slice(-48);
  return (
    <div className={cn("flex items-end gap-[2px]", className)} style={{ height }} aria-hidden>
      {points.length ? (
        points.map((value, index) => {
          const percent = Math.max(2, Math.min(100, (value / max) * 100));
          return (
            <span
              key={index}
              className={cn("flex-1 rounded-[2px] opacity-80 transition-all duration-300", toneClass[tone])}
              style={{ height: `${percent}%` }}
            />
          );
        })
      ) : (
        <span className="text-[10px] text-foreground-muted">No samples yet</span>
      )}
    </div>
  );
}

export function Meter({
  label,
  value,
  hint,
  tone = "primary",
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: ProgressTone;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-foreground-secondary">
          {icon}
          {label}
        </span>
        <span className="font-mono text-[11px] font-medium text-foreground">
          {value.toFixed(0)}%
        </span>
      </div>
      <ProgressBar value={value} tone={tone} size="sm" className="mt-1.5" />
      {hint ? <p className="mt-1 truncate text-[10px] text-foreground-muted">{hint}</p> : null}
    </div>
  );
}
