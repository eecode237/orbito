import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  backHref,
  backLabel = "Back",
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-5 sm:px-6", className)}>
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
      <div className="halo -right-20 -top-24 h-56 w-56 bg-primary/20" />
      <div className="relative">
        {backHref ? (
          <Link
            href={backHref}
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-[11px] font-medium text-foreground-muted transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            {icon ? (
              <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary-hover sm:grid">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className="type-eyebrow text-primary-hover/80">{eyebrow}</p> : null}
              <h1 className={cn("type-h1 text-foreground text-balance", eyebrow && "mt-1.5")}>
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-foreground-secondary">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="type-h2 text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-[12px] text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
