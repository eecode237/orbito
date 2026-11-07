import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "grid place-items-center px-4 py-8 text-center"
          : "grid min-h-[220px] place-items-center px-6 py-12 text-center"
      }
    >
      <div className="max-w-sm">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-elevated">
          <Icon className="h-4 w-4 text-foreground-muted" />
        </span>
        <p className="mt-3 text-[12px] font-medium text-foreground-secondary">{title}</p>
        {description ? (
          <p className="mt-1 text-[10.5px] leading-relaxed text-foreground-muted">{description}</p>
        ) : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
