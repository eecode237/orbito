import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  hover = false,
  as: Comp = "div",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Comp
      className={cn(
        "rounded-xl border border-border bg-surface",
        hover && "card-hover",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-elevated text-foreground-secondary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="type-h4 truncate text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-foreground-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="type-eyebrow text-foreground-muted">{label}</p>
      <p className="mt-1 truncate font-display text-[18px] font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[10.5px] text-foreground-muted">{hint}</p> : null}
    </div>
  );
}
