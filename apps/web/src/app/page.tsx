import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Mascot } from "@/components/brand/mascot";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { AgentFleet } from "@/components/dashboard/agent-fleet";
import { MemoryCard } from "@/components/dashboard/memory-card";
import { ModelStrip } from "@/components/dashboard/model-strip";
import { PromptBar } from "@/components/dashboard/prompt-bar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatsRow } from "@/components/dashboard/stats-row";
import { SystemPanel } from "@/components/dashboard/system-panel";

export const metadata = { title: "Overview" };

export default function HomePage() {
  return (
    <div className="pt-6 sm:pt-8">
      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(24,17,46,0.9),rgba(8,5,18,0.92))] p-5 shadow-[0_40px_120px_-60px_rgba(124,92,255,0.9)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />
        <div className="halo -right-16 -top-24 h-72 w-72 bg-violet/30" />
        <div className="halo -left-24 bottom-0 h-56 w-56 bg-mint/[0.07]" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet/10 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-violet-soft">
              <Sparkles className="h-3 w-3" /> ORBITO Core online
            </span>

            <h1 className="mt-4 font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[38px]">
              What should we <span className="text-gradient">get done?</span>
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/45">
              I&apos;m ORBITO — your AI operating system. Give me an outcome; I&apos;ll pick the
              agent, the model and the tools, and show you every step.
            </p>

            <div className="mt-5 max-w-2xl">
              <PromptBar />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] text-white/28">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-mint/70" /> Sensitive actions need your
                approval
              </span>
              <Link
                href="/settings?tab=models"
                className="flex items-center gap-1 transition hover:text-white/60"
              >
                Bring your own models <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="relative hidden items-center justify-center lg:flex">
            <Mascot className="h-52 w-52 animate-float" />
            <div className="absolute bottom-1 left-0 right-0 text-center">
              <p className="font-display text-[11px] font-medium tracking-[0.18em] text-white/45">
                MEET ORBITO
              </p>
              <p className="mt-0.5 text-[10px] text-white/25">Your always-on AI companion.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <StatsRow />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <QuickActions />
          <ModelStrip />
          <AgentFleet />

          <section className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="font-display text-[13.5px] font-semibold text-white/90">
                Built for the work you actually do
              </h2>
              <Link
                href="/agents"
                className="flex items-center gap-1 text-[10.5px] text-violet-soft/75 transition hover:text-violet-soft"
              >
                Explore agents <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid divide-y divide-white/[0.05] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                {
                  step: "01",
                  title: "Understands",
                  body: "Routes your intent to the right specialist and builds a plan you can see.",
                },
                {
                  step: "02",
                  title: "Orchestrates",
                  body: "Selects a model, runs search/scraping/files, and tracks tokens and cost.",
                },
                {
                  step: "03",
                  title: "Delivers",
                  body: "Streams the answer, keeps sources, and stores the task in your workspace.",
                },
              ].map((item) => (
                <div key={item.step} className="p-4">
                  <span className="font-display text-[10px] font-semibold tracking-[0.2em] text-violet-soft/50">
                    {item.step}
                  </span>
                  <h3 className="mt-2 text-[12.5px] font-medium text-white/85">{item.title}</h3>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-white/32">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <SystemPanel />
          <ActivityPanel />
          <MemoryCard />
        </aside>
      </div>
    </div>
  );
}
