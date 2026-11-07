import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * ORBITO mark — an orbital ring around a central intelligence point.
 * Uses design tokens so the symbol follows the active theme.
 */
export function OrbitMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="6" y1="10" x2="58" y2="54">
          <stop stopColor="var(--primary-soft)" />
          <stop offset="0.45" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--secondary)" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="10" y1="52" x2="54" y2="12">
          <stop stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="var(--primary-hover)" />
          <stop offset="1" stopColor="var(--success)" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <ellipse
        cx="32"
        cy="32"
        rx="27"
        ry="12.5"
        transform="rotate(-38 32 32)"
        stroke={`url(#${id}-a)`}
        strokeWidth="3.4"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="27"
        ry="12.5"
        transform="rotate(52 32 32)"
        stroke={`url(#${id}-b)`}
        strokeWidth="3.4"
      />
      <path
        d="M32 17.5c1.15 6.6 3.9 9.35 10.5 10.5-6.6 1.15-9.35 3.9-10.5 10.5-1.15-6.6-3.9-9.35-10.5-10.5 6.6-1.15 9.35-3.9 10.5-10.5Z"
        fill={`url(#${id}-a)`}
      />
      <circle cx="32" cy="32" r="3.1" fill="var(--foreground)" />
    </svg>
  );
}

export function Wordmark({
  className,
  subtitle = true,
}: {
  className?: string;
  subtitle?: boolean;
}) {
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <span className="font-display text-[1.3rem] font-semibold tracking-[0.2em] text-foreground">
        ORBITO
      </span>
      {subtitle ? (
        <span className="mt-1.5 text-[0.5rem] font-medium tracking-[0.32em] text-foreground-muted">
          PERSONAL AI OS
        </span>
      ) : null}
    </div>
  );
}

export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/[0.07] shadow-[0_0_26px_-10px_var(--primary)]",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        className,
      )}
    >
      <OrbitMark className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
    </div>
  );
}

export function BrandLockup({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!compact ? <Wordmark /> : null}
    </div>
  );
}
