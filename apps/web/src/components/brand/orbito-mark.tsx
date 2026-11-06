import { useId } from "react";

import { cn } from "@/lib/utils";

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
          <stop stopColor="#C4B5FD" />
          <stop offset="0.45" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="10" y1="52" x2="54" y2="12">
          <stop stopColor="#7C5CFF" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#3DDC97" stopOpacity="0.85" />
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
      <circle cx="32" cy="32" r="3.1" fill="#F5F3FF" />
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
      <span className="font-display text-[1.35rem] font-bold tracking-[0.2em] text-white">
        ORBITO
      </span>
      {subtitle ? (
        <span className="mt-1 text-[0.53rem] font-medium tracking-[0.34em] text-white/40">
          AI OPERATING SYSTEM
        </span>
      ) : null}
    </div>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative grid h-11 w-11 place-items-center rounded-2xl border border-violet/25 bg-[#100b21] shadow-[0_0_30px_-8px_rgba(124,92,255,0.65)]">
        <OrbitMark className="h-7 w-7" />
      </div>
      <Wordmark />
    </div>
  );
}
