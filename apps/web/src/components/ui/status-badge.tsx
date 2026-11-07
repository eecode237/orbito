import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  running: "border-info/30 bg-info/10 text-info",
  active: "border-info/30 bg-info/10 text-info",
  completed: "border-success/30 bg-success/10 text-success",
  success: "border-success/30 bg-success/10 text-success",
  done: "border-success/30 bg-success/10 text-success",
  paused: "border-warning/30 bg-warning/10 text-warning",
  waiting: "border-warning/30 bg-warning/10 text-warning",
  warning: "border-warning/30 bg-warning/10 text-warning",
  queued: "border-primary/30 bg-primary/10 text-primary-hover",
  pending: "border-border bg-foreground/[0.04] text-foreground-muted",
  skipped: "border-border-subtle bg-foreground/[0.03] text-foreground-muted",
  failed: "border-error/30 bg-error/10 text-error",
  error: "border-error/30 bg-error/10 text-error",
  cancelled: "border-border bg-foreground/[0.03] text-foreground-muted",
  info: "border-info/25 bg-info/[0.08] text-info",
  tool: "border-primary/30 bg-primary/10 text-primary-hover",
  model: "border-success/25 bg-success/[0.08] text-success",
  agent: "border-info/25 bg-info/[0.08] text-info",
  idle: "border-border bg-foreground/[0.03] text-foreground-muted",
  offline: "border-error/25 bg-error/[0.08] text-error",
  connected: "border-success/30 bg-success/10 text-success",
};

export function StatusBadge({
  status,
  label,
  pulse = false,
  className,
}: {
  status: string;
  label?: string;
  pulse?: boolean;
  className?: string;
}) {
  const style = STATUS_STYLES[status.toLowerCase()] ?? STATUS_STYLES.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
        style,
        className,
      )}
    >
      {pulse || status === "running" || status === "active" ? (
        <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
      ) : null}
      {label ?? status}
    </span>
  );
}
