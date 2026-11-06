import type { Metadata } from "next";
import { Cpu, ShieldAlert, Thermometer } from "lucide-react";

import { SystemPanel } from "@/components/dashboard/system-panel";

export const metadata: Metadata = { title: "System" };

export default function SystemPage() {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(23,16,44,0.88),rgba(8,5,18,0.92))] p-6">
        <div className="halo -right-10 -top-16 h-56 w-56 bg-sky/20" />
        <div className="relative">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-sky/70">
            Machine telemetry
          </span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            Know what your <span className="text-gradient">machine is doing.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
            CPU, memory, swap, disk, heat and battery are sampled every three seconds. Alerts
            fire only when a resource crosses a threshold, so a busy fan is not treated as a
            failure.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <Cpu className="h-3 w-3 text-violet-soft" /> Live 3s sampling
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <ShieldAlert className="h-3 w-3 text-amber" /> Threshold alerts
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <Thermometer className="h-3 w-3 text-sky" /> Thermal + battery aware
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <SystemPanel detailed />
      </div>
    </div>
  );
}
