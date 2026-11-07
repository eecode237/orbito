"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Thermometer,
  Zap,
} from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import { OrbitoAreaChart, type ChartConfig } from "@/components/charts/orbito-charts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import type { SystemStats } from "@/lib/types";
import { cn, formatBytes, formatRelative } from "@/lib/utils";

function pressure(value: number) {
  if (value >= 95) return { tone: "error" as const, label: "Critical" };
  if (value >= 85) return { tone: "warning" as const, label: "High" };
  return { tone: "success" as const, label: "Normal" };
}

function Meter({
  icon: Icon,
  label,
  value,
  hint,
  detail,
}: {
  icon: typeof Cpu;
  label: string;
  value: number;
  hint: string;
  detail: string;
}) {
  const state = pressure(value);
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-inset p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] text-foreground-secondary">
          <Icon className="h-3 w-3 text-foreground-muted" />
          {label}
        </span>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>
      <p className="mt-2 font-mono text-[17px] font-medium leading-none text-foreground">{value.toFixed(0)}%</p>
      <p className="mt-0.5 truncate text-[9px] text-foreground-muted">{detail}</p>
      <ProgressBar value={value} tone={state.tone === "success" ? "info" : state.tone} size="sm" className="mt-2" />
      <p className="mt-1 truncate font-mono text-[8.5px] text-foreground-muted">{hint}</p>
    </div>
  );
}

export function SystemHealth({
  data,
  history,
}: {
  data: SystemStats;
  history: { label: string; cpu: number; memory: number }[];
}) {
  const cpuState = pressure(data.cpu.percent);
  const memoryState = pressure(data.memory.percent);
  const diskState = pressure(data.disk.percent);
  const battery = data.battery;
  const thermal = data.temperature_c ?? null;

  const areaConfig: ChartConfig = {
    cpu: { label: "CPU %", color: "hsl(189 94% 53%)" },      // cyan - high contrast
    memory: { label: "Memory %", color: "hsl(262 83% 72%)" }, // violet
  };

  const radarData = [
    { metric: "CPU", value: Math.round(data.cpu.percent) },
    { metric: "Memory", value: Math.round(data.memory.percent) },
    { metric: "Disk", value: Math.round(data.disk.percent) },
    { metric: "Swap", value: Math.round(data.memory.swap_percent ?? 0) },
    { metric: "Battery", value: Math.round(battery?.percent ?? 100) },
  ];
  const radarConfig: ChartConfig = { value: { label: "Usage", color: "hsl(189 94% 53%)" } };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="System health"
        description="Live host telemetry with real graphs (shadcn charts + tooltips)"
        icon={<Gauge className="h-3.5 w-3.5" />}
        actions={
          <Link href="/system" className="focus-ring rounded text-[10.5px] font-medium text-primary-hover hover:text-primary-soft">
            Full monitor
          </Link>
        }
      />
      <CardContent className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Meter icon={Cpu} label="CPU" value={data.cpu.percent} hint={`${data.cpu.cores} threads${thermal != null ? ` · ${thermal.toFixed(0)}°C` : ""}`} detail={cpuState.label} />
          <Meter icon={MemoryStick} label="Memory" value={data.memory.percent} hint={`${formatBytes(data.memory.used_bytes)} / ${formatBytes(data.memory.total_bytes)}`} detail={memoryState.label} />
          <Meter icon={HardDrive} label="Disk" value={data.disk.percent} hint={`${formatBytes(data.disk.used_bytes)} / ${formatBytes(data.disk.total_bytes)}`} detail={diskState.label} />
          <div className="rounded-lg border border-border-subtle bg-surface-inset p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] text-foreground-secondary">
                {battery?.plugged ? <BatteryCharging className="h-3 w-3 text-foreground-muted" /> : <Zap className="h-3 w-3 text-foreground-muted" />}
                Battery
              </span>
              <Badge tone={battery ? "info" : "neutral"}>{battery ? battery.status : "N/A"}</Badge>
            </div>
            <p className="mt-2 font-mono text-[17px] font-medium leading-none text-foreground">{battery ? `${battery.percent.toFixed(0)}%` : "—"}</p>
            <p className="mt-0.5 truncate text-[9px] text-foreground-muted">{battery ? (battery.plugged ? "AC connected" : "On battery") : "No battery sensor"}</p>
            <div className="mt-2"><ProgressBar value={battery?.percent ?? 0} tone="success" size="sm" /></div>
            <p className="mt-1 font-mono text-[8.5px] text-foreground-muted">{thermal != null ? `thermal ${thermal.toFixed(0)}°C` : "no thermal sensor"}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[1.6fr_1fr]">
          <div className="h-[170px] rounded-lg border border-border-subtle bg-surface-inset p-1.5">
            {history.length > 1 ? (
              <OrbitoAreaChart data={history} config={areaConfig} height={158} />
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Activity className="mx-auto h-4 w-4 text-foreground-muted" />
                  <p className="mt-1 text-[10.5px] text-foreground-secondary">Building telemetry history</p>
                  <p className="mt-0.5 text-[9px] text-foreground-muted">Real samples accumulate while this page stays open.</p>
                </div>
              </div>
            )}
          </div>
          <div className="h-[170px] rounded-lg border border-border-subtle bg-surface-inset p-1">
            <ChartContainer config={radarConfig} className="h-full w-full aspect-auto">
              <RadarChart data={radarData} accessibilityLayer>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PolarGrid stroke="var(--border-subtle)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "var(--foreground-muted)" }} />
                <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.22} stroke="var(--color-value)" strokeWidth={1.5} />
              </RadarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2.5 py-2">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Processor</p>
            <p className="mt-0.5 truncate text-[10px] text-foreground-secondary">{data.cpu.model ?? "Not reported"}</p>
            <p className="mt-0.5 font-mono text-[8.5px] text-foreground-muted">
              load {data.cpu.load?.one.toFixed(2) ?? "—"} · {data.cpu.load?.five.toFixed(2) ?? "—"} · {data.cpu.load?.fifteen.toFixed(2) ?? "—"}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2.5 py-2">
            <p className="type-eyebrow flex items-center gap-1 text-[8px] text-foreground-muted"><Thermometer className="h-2.5 w-2.5" /> Status</p>
            <p className="mt-0.5 truncate text-[10px] text-foreground-secondary">Graphs reflect real API telemetry</p>
            <p className={cn("mt-0.5 flex items-center gap-1 font-mono text-[8.5px]", cpuState.tone === "success" && memoryState.tone === "success" && diskState.tone === "success" ? "text-success" : "text-warning")}>
              <AlertTriangle className="h-2.5 w-2.5" />
              {cpuState.tone === "success" && memoryState.tone === "success" && diskState.tone === "success" ? "No active resource alert" : "Resource pressure detected"}
            </p>
          </div>
        </div>
      </CardContent>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-foreground-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          live · {formatRelative(data.timestamp)}
        </span>
        <span className="font-mono text-[9px] text-foreground-muted">thresholds 85 / 95%</span>
      </div>
    </Card>
  );
}