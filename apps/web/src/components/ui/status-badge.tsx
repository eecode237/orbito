import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  running: "border-sky/25 bg-sky/10 text-sky",
  active: "border-sky/25 bg-sky/10 text-sky",
  completed: "border-mint/25 bg-mint/10 text-mint",
  success: "border-mint/25 bg-mint/10 text-mint",
  done: "border-mint/25 bg-mint/10 text-mint",
  paused: "border-amber/25 bg-amber/10 text-amber",
  waiting: "border-amber/25 bg-amber/10 text-amber",
  warning: "border-amber/25 bg-amber/10 text-amber",
  queued: "border-violet/25 bg-violet/10 text-violet-soft",
  pending: "border-white/10 bg-white/[0.04] text-white/45",
  skipped: "border-white/10 bg-white/[0.03] text-white/30",
  failed: "border-rose/25 bg-rose/10 text-rose",
  error: "border-rose/25 bg-rose/10 text-rose",
  cancelled: "border-white/10 bg-white/[0.03] text-white/35",
  info: "border-sky/20 bg-sky/[0.07] text-sky",
  tool: "border-violet/25 bg-violet/10 text-violet-soft",
  model: "border-mint/20 bg-mint/[0.07] text-mint",
  agent: "border-sky/20 bg-sky/[0.07] text-sky",
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
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
        style,
        className,
      )}
    >
      {pulse || status === "running" ? (
        <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
      ) : null}
      {label ?? status}
    </span>
  );
}
