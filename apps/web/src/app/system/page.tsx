"use client";

import { useEffect, useState } from "react";
import { Cpu, ScrollText, ShieldAlert, Thermometer } from "lucide-react";

import { SystemTelemetryDashboard } from "@/components/system/system-telemetry-dashboard";
import { getSystemAlerts } from "@/lib/api";
import type { SystemAlert } from "@/lib/types";

export default function SystemPage() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await getSystemAlerts();
        if (alive) setAlerts(data.alerts ?? []);
      } catch {
        // Alerts are optional; telemetry dashboard handles its own state.
      }
    }
    void load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

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
            Real CPU, memory, swap, disk, I/O, network and sensor data sampled from the host and rendered as
            shadcn charts with tooltips. No static or fabricated metrics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <Cpu className="h-3 w-3 text-violet-soft" /> Live sampling
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <ShieldAlert className="h-3 w-3 text-amber" /> Threshold alerts
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <ScrollText className="h-3 w-3 text-mint" /> System logs
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1">
              <Thermometer className="h-3 w-3 text-sky" /> Area/Bar/Line/Pie/Radar/Radial
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <SystemTelemetryDashboard alerts={alerts} />
      </div>
    </div>
  );
}