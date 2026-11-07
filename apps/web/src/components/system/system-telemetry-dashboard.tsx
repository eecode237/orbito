"use client";

import * as React from "react";
import {
  Activity,
  BatteryCharging,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  ScrollText,
  Thermometer,
} from "lucide-react";

import {
  OrbitoAreaChart,
  OrbitoBarChart,
  OrbitoLineChart,
  OrbitoPieChart,
  OrbitoRadarChart,
  OrbitoRadialChart,
  type ChartConfig,
} from "@/components/charts/orbito-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSystemHistory, getSystemLogs, getSystemOverview, getSystemStats } from "@/lib/api";
import type { SystemAlert, SystemStats, TaskEvent } from "@/lib/types";
import { cn, formatBytes, formatRelative } from "@/lib/utils";

const RANGE_OPTIONS = [
  { id: "5m", label: "5m", points: 60 },
  { id: "15m", label: "15m", points: 120 },
  { id: "1h", label: "1h", points: 180 },
  { id: "6h", label: "6h", points: 240 },
] as const;

function fmtTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function SystemTelemetryDashboard({ alerts = [] }: { alerts?: SystemAlert[] }) {
  const [range, setRange] = React.useState<(typeof RANGE_OPTIONS)[number]["id"]>("15m");
  const [stats, setStats] = React.useState<SystemStats | null>(null);
  const [overview, setOverview] = React.useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = React.useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = React.useState<TaskEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const opt = RANGE_OPTIONS.find((r) => r.id === range) ?? RANGE_OPTIONS[1];
      const [s, h, o, l] = await Promise.all([
        getSystemStats(),
        getSystemHistory(range, opt.points),
        getSystemOverview().catch(() => null),
        getSystemLogs(80).catch(() => ({ events: [], count: 0, limit: 80 })),
      ]);
      setStats(s);
      setOverview(o);
      setLogs((l.events ?? []) as TaskEvent[]);
      setHistory(
        (h.points ?? []).map((p) => ({
          label: fmtTime(p.timestamp),
          cpu: p.cpu_percent,
          memory: p.memory_percent,
          swap: p.swap_percent,
          disk: p.disk_percent,
          gpu: p.gpu_percent ?? 0,
          read_mbps: p.read_bytes_per_sec != null ? Number((p.read_bytes_per_sec / 1024 / 1024).toFixed(2)) : 0,
          write_mbps: p.write_bytes_per_sec != null ? Number((p.write_bytes_per_sec / 1024 / 1024).toFixed(2)) : 0,
          recv_mbps: p.recv_bytes_per_sec != null ? Number((p.recv_bytes_per_sec / 1024 / 1024).toFixed(2)) : 0,
          sent_mbps: p.sent_bytes_per_sec != null ? Number((p.sent_bytes_per_sec / 1024 / 1024).toFixed(2)) : 0,
          temp: p.temperature_c ?? 0,
        })),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load system telemetry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  React.useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const cpu = stats?.cpu;
  const mem = stats?.memory;
  const disk = stats?.disk;
  const oDisk = asRecord(overview?.disk);
  const oMem = asRecord(overview?.memory);
  const partitions = Array.isArray(oDisk?.partitions) ? (oDisk!.partitions as unknown[]) : [];
  const perCore: number[] = Array.isArray(cpu?.per_core) ? (cpu!.per_core as number[]) : [];

  const areaConfig: ChartConfig = {
    cpu: { label: "CPU %", color: "var(--chart-1)" },
    memory: { label: "Memory %", color: "var(--chart-2)" },
    swap: { label: "Swap %", color: "var(--chart-4)" },
  };
  const ioConfig: ChartConfig = {
    read_mbps: { label: "Read MB/s", color: "var(--chart-3)" },
    write_mbps: { label: "Write MB/s", color: "var(--chart-5)" },
  };
  const netConfig: ChartConfig = {
    recv_mbps: { label: "Recv MB/s", color: "var(--chart-1)" },
    sent_mbps: { label: "Sent MB/s", color: "var(--chart-2)" },
  };

  const coreData = perCore.map((v, i) => ({ label: `C${i}`, usage: Math.round(v) }));
  const coreConfig: ChartConfig = { usage: { label: "Usage %", color: "var(--chart-1)" } };

  const diskUsed = disk ? Math.max(0, disk.used_bytes) : 0;
  const diskFree = disk ? Math.max(0, disk.free_bytes) : 0;
  const diskPie = disk
    ? [
        { name: "used", value: Number((diskUsed / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-5)" },
        { name: "free", value: Number((diskFree / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-3)" },
      ]
    : [];
  const diskPieConfig: ChartConfig = {
    used: { label: `Used (${formatBytes(diskUsed)})`, color: "var(--chart-5)" },
    free: { label: `Free (${formatBytes(diskFree)})`, color: "var(--chart-3)" },
  };

  const memUsed = mem ? Math.max(0, mem.used_bytes) : 0;
  const memAvail = mem ? Math.max(0, mem.available_bytes) : 0;
  const memPie = mem
    ? [
        { name: "used", value: Number((memUsed / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-1)" },
        { name: "available", value: Number((memAvail / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-2)" },
      ]
    : [];
  const memPieConfig: ChartConfig = {
    used: { label: `Used (${formatBytes(memUsed)})`, color: "var(--chart-1)" },
    available: { label: `Available (${formatBytes(memAvail)})`, color: "var(--chart-2)" },
  };

  const radialData = [
    { name: "CPU", value: Math.round(cpu?.percent ?? 0), fill: "var(--chart-1)" },
    { name: "Memory", value: Math.round(mem?.percent ?? 0), fill: "var(--chart-2)" },
    { name: "Disk", value: Math.round(disk?.percent ?? 0), fill: "var(--chart-5)" },
    { name: "Swap", value: Math.round(mem?.swap_percent ?? 0), fill: "var(--chart-4)" },
  ];
  const radialConfig: ChartConfig = {
    CPU: { label: "CPU", color: "var(--chart-1)" },
    Memory: { label: "Memory", color: "var(--chart-2)" },
    Disk: { label: "Disk", color: "var(--chart-5)" },
    Swap: { label: "Swap", color: "var(--chart-4)" },
  };

  const latest = history[history.length - 1];
  const radarData = [
    { metric: "CPU", current: Math.round(cpu?.percent ?? 0), avg: Math.round(history.reduce((a, p) => a + (Number(p.cpu) || 0), 0) / Math.max(1, history.length)) },
    { metric: "Memory", current: Math.round(mem?.percent ?? 0), avg: Math.round(history.reduce((a, p) => a + (Number(p.memory) || 0), 0) / Math.max(1, history.length)) },
    { metric: "Swap", current: Math.round(mem?.swap_percent ?? 0), avg: Math.round(history.reduce((a, p) => a + (Number(p.swap) || 0), 0) / Math.max(1, history.length)) },
    { metric: "Disk", current: Math.round(disk?.percent ?? 0), avg: Math.round(history.reduce((a, p) => a + (Number(p.disk) || 0), 0) / Math.max(1, history.length)) },
    { metric: "IO", current: Math.min(100, Math.round(((Number(latest?.read_mbps) || 0) + (Number(latest?.write_mbps) || 0)) * 10)), avg: 20 },
  ];
  const radarConfig: ChartConfig = {
    current: { label: "Current", color: "var(--chart-1)" },
    avg: { label: "Average", color: "var(--chart-3)" },
  };

  if (loading && !stats) {
    return <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-foreground-muted">Sampling real system telemetry…</div>;
  }
  if (error && !stats) {
    return (
      <div className="rounded-2xl border border-error/25 bg-error/[0.05] p-6">
        <p className="text-sm font-medium text-foreground">Could not read system telemetry</p>
        <p className="mt-1 font-mono text-xs text-error/90">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load(true)}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={error ? "warning" : "success"} dot>{error ? "Refreshing with last known data" : "Live telemetry"}</Badge>
          <span className="font-mono text-[10px] text-foreground-muted">
            {stats?.timestamp ? formatRelative(stats.timestamp) : "—"} · {stats?.platform ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[10px] transition",
                range === r.id ? "bg-primary/15 text-primary-hover" : "text-foreground-muted hover:bg-surface-hover"
              )}
            >
              {r.label}
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Cpu} label="CPU" value={`${Math.round(cpu?.percent ?? 0)}%`} hint={`${cpu?.cores ?? 0} threads · ${cpu?.model ?? "—"}`} tone={cpu?.percent ?? 0} />
        <StatCard icon={MemoryStick} label="Memory" value={`${Math.round(mem?.percent ?? 0)}%`} hint={mem ? `${formatBytes(mem.used_bytes)} / ${formatBytes(mem.total_bytes)}` : "—"} tone={mem?.percent ?? 0} />
        <StatCard icon={HardDrive} label="Disk" value={`${Math.round(disk?.percent ?? 0)}%`} hint={disk ? `${formatBytes(disk.free_bytes)} free of ${formatBytes(disk.total_bytes)}` : "—"} tone={disk?.percent ?? 0} />
        <StatCard icon={Thermometer} label="Thermal / Power" value={stats?.temperature_c != null ? `${Math.round(stats.temperature_c)}°C` : stats?.battery ? `${Math.round(stats.battery.percent)}%` : "—"} hint={stats?.battery ? `Battery ${stats.battery.status}` : "No thermal sensor reported"} tone={stats?.temperature_c ?? 0} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Resource usage over time" description="Real samples from /api/v1/system/history (Area chart + tooltip)" icon={<Activity className="h-3.5 w-3.5" />} />
          <CardContent>{history.length ? <OrbitoAreaChart data={history} config={areaConfig} height={260} /> : <EmptyChart />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Resource trend" description="Line chart view of the same real telemetry" icon={<Activity className="h-3.5 w-3.5" />} />
          <CardContent>{history.length ? <OrbitoLineChart data={history} config={areaConfig} height={260} /> : <EmptyChart />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Load gauges" description="Current CPU, memory, disk, swap (Radial chart)" icon={<Cpu className="h-3.5 w-3.5" />} />
          <CardContent>{stats ? <OrbitoRadialChart data={radialData} config={radialConfig} height={240} innerRadius={35} outerRadius={95} /> : <EmptyChart />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Resource profile" description="Current vs recent average (Radar chart)" icon={<Activity className="h-3.5 w-3.5" />} />
          <CardContent>{history.length ? <OrbitoRadarChart data={radarData} config={radarConfig} height={240} /> : <EmptyChart />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Per-core CPU" description="Real per-core utilization (Bar chart)" icon={<Cpu className="h-3.5 w-3.5" />} />
          <CardContent>{coreData.length ? <OrbitoBarChart data={coreData.slice(0, 16)} config={coreConfig} height={240} /> : <EmptyChart note="Per-core data not available." />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Disk usage" description="Used vs free space in GB (Pie chart)" icon={<HardDrive className="h-3.5 w-3.5" />} />
          <CardContent>{diskPie.length ? <OrbitoPieChart data={diskPie} config={diskPieConfig} height={240} innerRadius="55%" /> : <EmptyChart />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Memory breakdown" description="Used vs available in GB (Pie chart)" icon={<MemoryStick className="h-3.5 w-3.5" />} />
          <CardContent>{memPie.length ? <OrbitoPieChart data={memPie} config={memPieConfig} height={240} innerRadius="55%" /> : <EmptyChart />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Disk I/O" description="Read/write throughput from history (Bar chart)" icon={<HardDrive className="h-3.5 w-3.5" />} />
          <CardContent>{history.length ? <OrbitoBarChart data={history.slice(-24)} config={ioConfig} height={220} /> : <EmptyChart />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Network throughput" description="Receive/send throughput from history (Area chart)" icon={<Activity className="h-3.5 w-3.5" />} />
          <CardContent>{history.length ? <OrbitoAreaChart data={history.slice(-40)} config={netConfig} height={220} /> : <EmptyChart />}</CardContent>
        </Card>
      </div>

      {partitions.length ? (
        <Card>
          <CardHeader title="Partitions" description="Real mount points from system overview (Bar chart)" icon={<HardDrive className="h-3.5 w-3.5" />} />
          <CardContent>
            <OrbitoBarChart
              data={partitions.slice(0, 10).map((p) => {
                const r = asRecord(p) ?? {};
                return { label: String(r.mount ?? r.device ?? "?").slice(0, 16), used: Math.round(asNum(r.percent) ?? 0) };
              })}
              config={{ used: { label: "Used %", color: "var(--chart-5)" } }}
              height={220}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="System logs" description="Recent real execution/system events" icon={<ScrollText className="h-3.5 w-3.5" />} actions={<Badge tone="neutral">{logs.length} events</Badge>} />
        <CardContent className="p-0">
          {!logs.length ? (
            <p className="p-4 text-[11px] text-foreground-muted">No system events recorded yet. Run tasks to generate real execution logs.</p>
          ) : (
            <div className="max-h-[360px] overflow-auto divide-y divide-border-subtle">
              {logs.map((event) => (
                <div key={event.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2 px-4 py-2 text-[11px]">
                  <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", levelDot(event.level))} />
                  <div className="min-w-0">
                    <p className="truncate text-foreground-secondary">{event.message}</p>
                    <p className="truncate font-mono text-[9px] text-foreground-muted">
                      {event.kind}{event.detail ? ` · ${event.detail}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-[9px] text-foreground-muted">{formatRelative(event.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {alerts.length ? (
        <Card>
          <CardHeader title="Active alerts" description="Threshold alerts from the API" icon={<BatteryCharging className="h-3.5 w-3.5" />} />
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className={cn("rounded-lg border px-3 py-2", a.level === "critical" ? "border-error/25 bg-error/[0.05]" : "border-warning/25 bg-warning/[0.05]")}>
                <div className="flex items-center justify-between gap-2"><p className="text-[11.5px] font-medium">{a.title}</p><span className="font-mono text-[10px]">{a.value}</span></div>
                <p className="mt-0.5 text-[10px] text-foreground-muted">{a.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function levelDot(level?: string) {
  if (level === "error") return "bg-error";
  if (level === "warning") return "bg-warning";
  if (level === "success") return "bg-success";
  return "bg-info";
}

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: typeof Cpu; label: string; value: string; hint: string; tone: number }) {
  const color = tone >= 90 ? "text-error" : tone >= 75 ? "text-warning" : "text-success";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-[10px] text-foreground-muted">
          <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
          <span className={cn("font-mono font-semibold", color)}>{value}</span>
        </div>
        <p className="mt-1 truncate text-[10px] text-foreground-secondary" title={hint}>{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ note = "Waiting for real telemetry samples…" }: { note?: string }) {
  return <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-border text-[11px] text-foreground-muted">{note}</div>;
}