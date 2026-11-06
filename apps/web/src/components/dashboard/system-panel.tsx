"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BatteryCharging,
  Cpu,
  HardDrive,
  Loader2,
  MemoryStick,
  Radio,
  Thermometer,
  Timer,
} from "lucide-react";

import { getSystemAlerts, getSystemStats } from "@/lib/api";
import type { SystemAlert, SystemStats } from "@/lib/types";
import { cn, formatBytes, formatUptime } from "@/lib/utils";

const POLL_MS = 3000;
const HISTORY = 36;

function tone(percent: number) {
  if (percent >= 90) return { bar: "bg-rose", text: "text-rose" };
  if (percent >= 75) return { bar: "bg-amber", text: "text-amber" };
  return { bar: "bg-mint", text: "text-mint" };
}

function Meter({
  icon: Icon,
  label,
  percent,
  hint,
}: {
  icon: typeof Cpu;
  label: string;
  percent: number;
  hint: string;
}) {
  const colors = tone(percent);
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1.5 text-white/40">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className={cn("font-mono font-medium", colors.text)}>{percent.toFixed(0)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
          style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        />
      </div>
      <p className="mt-1 truncate text-[9px] text-white/25" title={hint}>
        {hint}
      </p>
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const points = values.slice(-HISTORY);
  return (
    <div className={cn("flex h-10 items-end gap-[2px]", className)} aria-hidden>
      {Array.from({ length: HISTORY }).map((_, index) => {
        const value = points[index] ?? 0;
        const height = Math.max(3, Math.round((value / 100) * 36));
        return (
          <span
            key={index}
            className={cn(
              "flex-1 rounded-sm transition-all duration-300",
              value >= 90 ? "bg-rose/70" : value >= 75 ? "bg-amber/70" : "bg-mint/50",
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function AlertRow({ alert }: { alert: SystemAlert }) {
  const style =
    alert.level === "critical"
      ? "border-rose/25 bg-rose/[0.06] text-rose"
      : "border-amber/25 bg-amber/[0.06] text-amber";
  return (
    <div className={cn("rounded-xl border px-2.5 py-2", style)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-medium">{alert.title}</p>
        <span className="font-mono text-[9px] opacity-80">{alert.value}</span>
      </div>
      <p className="mt-0.5 text-[9.5px] leading-snug text-white/40">{alert.detail}</p>
      {alert.href ? (
        <Link
          href={alert.href}
          className="mt-1 inline-flex items-center gap-0.5 text-[9.5px] text-white/50 transition hover:text-white/80"
        >
          Fix this <ArrowUpRight className="h-2.5 w-2.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function SystemPanel({ detailed = false }: { detailed?: boolean }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [history, setHistory] = useState<{ cpu: number[]; memory: number[] }>({
    cpu: [],
    memory: [],
  });
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [next, alertData] = await Promise.all([getSystemStats(), getSystemAlerts()]);
      setStats(next);
      setAlerts(alertData.alerts);
      setOffline(false);
      setHistory((previous) => ({
        cpu: [...previous.cpu, next.cpu.percent].slice(-HISTORY),
        memory: [...previous.memory, next.memory.percent].slice(-HISTORY),
      }));
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    async function tick() {
      if (!alive) return;
      await load();
    }
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load]);

  const temperature = stats?.temperature_c ?? null;
  const battery = stats?.battery ?? null;
  const loadAverage = stats?.cpu.load;

  const coreBars = useMemo(() => stats?.cpu.per_core.slice(0, 16) ?? [], [stats]);

  if (loading && !stats) {
    return (
      <section className="glass flex items-center gap-2 rounded-2xl p-4 text-[11px] text-white/35">
        <Loader2 className="h-4 w-4 animate-spin text-violet-soft" /> Sampling this machine…
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[13.5px] font-semibold text-white/90">
              Live system
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-mint/10 px-1.5 py-0.5 text-[8.5px] font-medium uppercase tracking-wide text-mint">
              <Radio className="h-2.5 w-2.5" /> live
            </span>
          </div>
          <p className="mt-0.5 text-[9.5px] text-white/25">
            {offline
              ? "API offline — retrying every 3s"
              : (stats?.cpu.model ?? stats?.platform ?? "Local machine")}
          </p>
        </div>
        <span className="text-[9px] text-white/25">
          {stats ? new Date(stats.timestamp).toLocaleTimeString() : "—"}
        </span>
      </div>

      {!stats ? (
        <p className="mt-4 rounded-xl border border-rose/20 bg-rose/[0.05] px-3 py-2 text-[10.5px] text-rose/80">
          Could not read system telemetry. Is the ORBITO API running?
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Meter
              icon={Cpu}
              label="CPU"
              percent={stats.cpu.percent}
              hint={`${stats.cpu.cores} threads${
                loadAverage ? ` · load ${loadAverage.one.toFixed(2)}` : ""
              }`}
            />
            <Meter
              icon={MemoryStick}
              label="Memory"
              percent={stats.memory.percent}
              hint={`${formatBytes(stats.memory.used_bytes)} / ${formatBytes(
                stats.memory.total_bytes,
              )}`}
            />
            <Meter
              icon={HardDrive}
              label="Disk"
              percent={stats.disk.percent}
              hint={`${formatBytes(stats.disk.free_bytes)} free`}
            />
            {detailed ? (
              <Meter
                icon={MemoryStick}
                label="Swap"
                percent={stats.memory.swap_percent}
                hint={
                  stats.memory.swap_total_bytes
                    ? `${formatBytes(stats.memory.swap_used_bytes)} / ${formatBytes(
                        stats.memory.swap_total_bytes,
                      )}`
                    : "not configured"
                }
              />
            ) : (
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-white/40">
                    <Thermometer className="h-3 w-3" /> Temperature
                  </span>
                  <span className="font-mono font-medium text-white/70">
                    {temperature === null ? "—" : `${temperature.toFixed(0)} °C`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      temperature !== null && temperature >= 85
                        ? "bg-rose"
                        : temperature !== null && temperature >= 75
                          ? "bg-amber"
                          : "bg-sky",
                    )}
                    style={{
                      width: `${temperature === null ? 0 : Math.min(100, (temperature / 100) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[9px] text-white/25">
                  {battery
                    ? `Battery ${battery.percent}% · ${battery.status.toLowerCase()}`
                    : "No battery reported"}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-white/25">
              <span>CPU history</span>
              <span>{stats.cpu.percent.toFixed(0)}% now</span>
            </div>
            <Sparkline values={history.cpu} className="mt-1.5" />
          </div>

          {detailed ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/25">
                  <Thermometer className="h-2.5 w-2.5" /> Temp
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/80">
                  {temperature === null ? "—" : `${temperature.toFixed(0)} °C`}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/25">
                  <BatteryCharging className="h-2.5 w-2.5" /> Battery
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/80">
                  {battery ? `${battery.percent}%` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/25">
                  <Timer className="h-2.5 w-2.5" /> Uptime
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/80">
                  {formatUptime(stats.uptime_seconds)}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/25">
                  <Cpu className="h-2.5 w-2.5" /> Load
                </p>
                <p className="mt-1 font-mono text-[12px] text-white/80">
                  {loadAverage ? loadAverage.one.toFixed(2) : "—"}
                </p>
              </div>
            </div>
          ) : null}

          {detailed && coreBars.length ? (
            <div className="mt-4">
              <p className="text-[9px] uppercase tracking-wide text-white/25">Per core</p>
              <div className="mt-1.5 grid grid-cols-8 gap-1">
                {coreBars.map((value, index) => (
                  <div
                    key={index}
                    className="flex h-10 items-end rounded-md bg-black/30 p-[2px]"
                  >
                    <div
                      className={cn("w-full rounded-sm transition-all", tone(value).bar)}
                      style={{ height: `${Math.max(6, value)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.05] pt-3 text-[9.5px] text-white/30">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  stats.ollama.reachable ? "bg-mint shadow-[0_0_8px_#3ddc97]" : "bg-rose",
                )}
              />
              Ollama {stats.ollama.reachable ? stats.ollama.version ?? "connected" : "offline"}
            </span>
            <span>·</span>
            <span>{stats.platform}</span>
            {stats.memory.swap_percent > 0 ? (
              <>
                <span>·</span>
                <span>swap {stats.memory.swap_percent.toFixed(0)}%</span>
              </>
            ) : null}
          </div>

          {alerts.length ? (
            <div className="mt-3 space-y-1.5">
              {alerts.slice(0, detailed ? undefined : 2).map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-mint/15 bg-mint/[0.04] px-2.5 py-2 text-[10px] text-mint/80">
              All monitored resources are within range.
            </p>
          )}

          {!detailed ? (
            <Link
              href="/system"
              className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-white/[0.07] py-1.5 text-[10px] text-white/40 transition hover:border-violet/30 hover:text-white/70"
            >
              Open system monitor <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
