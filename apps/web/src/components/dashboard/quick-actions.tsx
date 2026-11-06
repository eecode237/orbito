import Link from "next/link";
import { ArrowUpRight, GraduationCap, Globe2, Code2, Briefcase } from "lucide-react";

import { accentStyles } from "@/lib/nav";
import { cn } from "@/lib/utils";

const actions = [
  {
    slug: "career",
    title: "Career",
    description: "Find jobs, tailor applications, track opportunities.",
    href: "/chat?agent=career&q=Find%2050%20AI%20engineering%20jobs%20in%20Canada",
    icon: Briefcase,
    accent: "violet",
  },
  {
    slug: "research",
    title: "Research",
    description: "Scrape & gather information from the web.",
    href: "/scraping",
    icon: Globe2,
    accent: "mint",
  },
  {
    slug: "study",
    title: "Study",
    description: "Get help with homework, learn faster.",
    href: "/chat?agent=study&q=Create%20a%207-day%20study%20plan%20for%20my%20exams",
    icon: GraduationCap,
    accent: "blue",
  },
  {
    slug: "coding",
    title: "Build",
    description: "Create code, debug projects, automate workflows.",
    href: "/chat?agent=coding&q=Build%20a%20landing%20page%20for%20my%20business",
    icon: Code2,
    accent: "amber",
  },
] as const;

export function QuickActions() {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-white/90">Pick a lane</h2>
          <p className="mt-0.5 text-[12px] text-white/35">Specialists, ready when you are.</p>
        </div>
        <Link
          href="/agents"
          className="flex items-center gap-1 text-[11.5px] text-violet-soft/80 transition hover:text-violet-soft"
        >
          All agents <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {actions.map((action) => {
          const accent = accentStyles[action.accent];
          const Icon = action.icon;
          return (
            <Link
              key={action.slug}
              href={action.href}
              className={cn(
                "card-hover group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(160deg,rgba(22,16,42,0.85),rgba(9,6,20,0.9))] p-4",
                accent.glow,
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-70",
                  accent.gradient,
                )}
              />
              <div className="relative">
                <div
                  className={cn(
                    "mb-4 grid h-10 w-10 place-items-center rounded-xl border",
                    accent.bg,
                    accent.border,
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px]", accent.text)} />
                </div>
                <h3 className="font-display text-[15px] font-semibold text-white/95">
                  {action.title}
                </h3>
                <p className="mt-1 min-h-[34px] text-[11.5px] leading-relaxed text-white/38">
                  {action.description}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/20">
                    Open
                  </span>
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full border transition group-hover:translate-x-0.5",
                      accent.bg,
                      accent.border,
                    )}
                  >
                    <ArrowUpRight className={cn("h-3.5 w-3.5", accent.text)} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
