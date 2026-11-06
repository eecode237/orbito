import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";

export function ModulePage({
  eyebrow,
  title,
  accentWord,
  description,
  phase,
  icon: Icon,
  features,
  note,
  ctaHref = "/chat",
  ctaLabel = "Start a task",
}: {
  eyebrow: string;
  title: string;
  accentWord?: string;
  description: string;
  phase: string;
  icon: LucideIcon;
  features: { title: string; body: string }[];
  note: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(23,16,44,0.88),rgba(8,5,18,0.92))] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <div className="halo -right-16 -top-20 h-64 w-64 bg-violet/25" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">
              {eyebrow}
            </span>
            <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[38px]">
              {title} {accentWord ? <span className="text-gradient">{accentWord}</span> : null}
            </h1>
            <p className="mt-3 text-[12.5px] leading-relaxed text-white/40">{description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={ctaHref}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-violet px-4 text-[11.5px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(124,92,255,1)] transition hover:bg-[#8b6dff]"
              >
                {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span className="rounded-full border border-amber/20 bg-amber/[0.05] px-2.5 py-1 text-[9.5px] uppercase tracking-[0.14em] text-amber/70">
                {phase}
              </span>
            </div>
          </div>

          <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-3xl border border-violet/20 bg-violet/[0.07]">
            <div className="halo inset-2 bg-violet/30" />
            <Icon className="relative h-10 w-10 text-violet-soft" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature, index) => (
          <div key={feature.title} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] font-semibold tracking-[0.2em] text-violet-soft/50">
                0{index + 1}
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-mint/50" />
            </div>
            <h2 className="mt-2.5 text-[12.5px] font-medium text-white/85">{feature.title}</h2>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/32">{feature.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
        <p className="max-w-3xl text-[10.5px] leading-relaxed text-white/35">{note}</p>
        <Link
          href="/settings?tab=models"
          className="flex shrink-0 items-center gap-1 text-[10.5px] text-violet-soft/80 transition hover:text-violet-soft"
        >
          See the architecture <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
