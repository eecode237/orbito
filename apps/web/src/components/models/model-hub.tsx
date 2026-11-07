"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  CircleAlert,
  CircleCheck,
  Cpu,
  Download,
  HardDrive,
  Info,
  Loader2,
  MemoryStick,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
} from "lucide-react";

import { OrbitoBarChart, OrbitoPieChart, type ChartConfig } from "@/components/charts/orbito-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { deleteLocalModel, getModelHub, pullModel } from "@/lib/api";
import type { ModelHubOverview, PullEvent } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

function fmtBytes(value: number): string {
  if (!value || !Number.isFinite(value)) return "0 B";
  return formatBytes(value);
}

export function ModelHub() {
  const [data, setData] = useState<ModelHubOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pulling, setPulling] = useState<{ name: string; percent: number | null; status: string } | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getModelHub());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the ORBITO API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function startPull(rawName: string) {
    const name = rawName.trim();
    if (!name || pulling) return;
    setPullError(null);
    setDraft(name);
    const controller = new AbortController();
    abortRef.current = controller;
    setPulling({ name, percent: 0, status: "starting" });
    try {
      await pullModel(name, (event: PullEvent) => {
        if (event.type === "progress") setPulling({ name, percent: event.percent, status: event.status });
        if (event.type === "error") setPullError(event.error);
      }, controller.signal);
      await load();
    } catch (err) {
      if (!controller.signal.aborted) setPullError(err instanceof Error ? err.message : "The download failed.");
    } finally {
      setPulling(null);
      abortRef.current = null;
    }
  }

  async function remove(name: string) {
    if (typeof window !== "undefined" && !window.confirm(`Delete ${name}? It will need to be downloaded again.`)) return;
    setRemoving(name);
    setPullError(null);
    try {
      await deleteLocalModel(name);
      await load();
    } catch (err) {
      setPullError(err instanceof Error ? err.message : `Could not delete ${name}.`);
    } finally {
      setRemoving(null);
    }
  }

  const hardware = data?.hardware;
  const installed = data?.installed ?? [];
  const running = data?.running ?? [];
  const suggestions = data?.suggestions ?? [];
  const ollama = data?.ollama;

  const installedSize = useMemo(() => installed.reduce((s, m) => s + (m.size || 0), 0), [installed]);
  const runningVram = useMemo(() => running.reduce((s, m) => s + (m.size_vram || 0), 0), [running]);

  const modelSizeData = useMemo(() => {
    const top = [...installed].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 8);
    return top.map((m) => ({ label: (m.name || "?").split(":")[0].slice(0, 14), gb: Number(((m.size || 0) / 1024 / 1024 / 1024).toFixed(2)) }));
  }, [installed]);
  const modelSizeConfig: ChartConfig = { gb: { label: "Size (GB)", color: "var(--chart-2)" } };

  const memTotal = hardware?.memory_total_bytes || 0;
  const memAvail = hardware?.memory_available_bytes || 0;
  const memUsed = Math.max(0, memTotal - memAvail);
  const memPie = memTotal ? [
    { name: "used", value: Number((memUsed / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-1)" },
    { name: "available", value: Number((memAvail / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-3)" },
  ] : [];
  const memConfig: ChartConfig = {
    used: { label: `Used (${fmtBytes(memUsed)})`, color: "var(--chart-1)" },
    available: { label: `Available (${fmtBytes(memAvail)})`, color: "var(--chart-3)" },
  };

  const disk = hardware?.disk;
  const diskUsed = disk ? Math.max(0, (disk.total_bytes || 0) - (disk.free_bytes || 0)) : 0;
  const diskPie = disk?.total_bytes ? [
    { name: "used", value: Number((diskUsed / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-5)" },
    { name: "free", value: Number(((disk!.free_bytes || 0) / 1024 / 1024 / 1024).toFixed(2)), fill: "var(--chart-2)" },
  ] : [];
  const diskConfig: ChartConfig = {
    used: { label: `Used (${fmtBytes(diskUsed)})`, color: "var(--chart-5)" },
    free: { label: `Free (${fmtBytes(disk?.free_bytes || 0)})`, color: "var(--chart-2)" },
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-6 text-[12px] text-foreground-muted">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Reading local hardware and Ollama models…
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-error/25 bg-error/[0.04]">
        <CardContent className="p-5">
          <p className="text-[12px] font-medium text-foreground">Model Hub unavailable</p>
          <p className="mt-1 font-mono text-[11px] text-error/90">{error ?? "Could not load model hub data."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); void load(); }}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn("flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4", ollama?.reachable ? "border-success/25 bg-success/[0.04]" : "border-error/25 bg-error/[0.04]")}>
        <div className="flex items-start gap-3">
          {ollama?.reachable ? <CircleCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" /> : <CircleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-error" />}
          <div>
            <p className={cn("text-[13px] font-medium", ollama?.reachable ? "text-success" : "text-error")}>
              {ollama?.reachable ? `Ollama ${ollama.version ?? ""} connected` : "Ollama is offline"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-secondary">
              {ollama?.reachable
                ? `${installed.length} model${installed.length === 1 ? "" : "s"} installed · ${running.length} loaded · ${ollama.base_url}`
                : (ollama?.error ?? "Start it with `ollama serve`, then refresh.")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={ollama?.reachable ? "success" : "error"} dot>{ollama?.reachable ? "Local inference ready" : "Offline"}</Badge>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading && !!data}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Cpu} label="Processor" value={hardware?.cpu_model ?? "Unknown CPU"} detail={`${hardware?.cpu_threads ?? 0} threads`} />
        <StatCard icon={MemoryStick} label="System memory" value={`${fmtBytes(memAvail)} free`} detail={`${fmtBytes(memTotal)} total`} />
        <StatCard icon={Boxes} label="GPU" value={hardware?.gpus?.[0]?.name ?? "No dedicated GPU detected"} detail={runningVram ? `${fmtBytes(runningVram)} VRAM in use` : "Ollama reports processor per model"} />
        <StatCard icon={HardDrive} label="Storage" value={`${fmtBytes(disk?.free_bytes || 0)} free`} detail={`${fmtBytes(installedSize)} in installed models`} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Hardware memory" description="Real host memory breakdown (Pie chart + tooltip)" icon={<MemoryStick className="h-3.5 w-3.5" />} />
          <CardContent>{memPie.length ? <OrbitoPieChart data={memPie} config={memConfig} height={220} innerRadius="55%" /> : <EmptyNote text="Memory info unavailable." />}</CardContent>
        </Card>
        <Card>
          <CardHeader title="Disk space" description="Real disk usage (Pie chart + tooltip)" icon={<HardDrive className="h-3.5 w-3.5" />} />
          <CardContent>{diskPie.length ? <OrbitoPieChart data={diskPie} config={diskConfig} height={220} innerRadius="55%" /> : <EmptyNote text="Disk info unavailable." />}</CardContent>
        </Card>
      </div>

      {modelSizeData.length ? (
        <Card>
          <CardHeader title="Installed model sizes" description="Real sizes reported by Ollama (Bar chart + tooltip)" icon={<Boxes className="h-3.5 w-3.5" />} />
          <CardContent><OrbitoBarChart data={modelSizeData} config={modelSizeConfig} height={220} /></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Download a model" description="Pulls from the local Ollama registry with live SSE progress (no fake progress)" icon={<Download className="h-3.5 w-3.5" />} />
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); void startPull(draft); }} className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="qwen3.5:4b"
              spellCheck={false}
              className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-surface-inset px-3 font-mono text-[12px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
            />
            <Button type="submit" disabled={!draft.trim() || Boolean(pulling) || !ollama?.reachable} size="sm">
              {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => void startPull(item.name)}
                disabled={item.installed || Boolean(pulling) || !ollama?.reachable}
                title={item.note}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] transition",
                  item.installed ? "border-success/20 bg-success/[0.05] text-success" : "border-border bg-surface-inset text-foreground-secondary hover:border-primary/40 hover:text-foreground",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {item.installed ? <CircleCheck className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                <span className="font-mono">{item.name}</span>
                <span className="hidden text-foreground-muted sm:inline">{item.role}</span>
              </button>
            ))}
          </div>
          {pulling ? (
            <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.05] p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-foreground">{pulling.name}</span>
                <span className="text-primary-hover">{pulling.percent === null ? "working…" : `${pulling.percent}%`}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, pulling.percent ?? 0))}%` }} />
              </div>
              <p className="mt-1.5 truncate font-mono text-[10px] text-foreground-muted">{pulling.status}</p>
            </div>
          ) : null}
          {pullError ? <p className="mt-2 text-[11px] text-error/90">{pullError}</p> : null}
        </CardContent>
      </Card>

      {running.length > 0 ? (
        <Card>
          <CardHeader title="Loaded now" description="Models currently loaded by Ollama (real /api/ps data)" icon={<Server className="h-3.5 w-3.5" />} />
          <CardContent className="p-0">
            <div className="divide-y divide-border-subtle">
              {running.map((model) => (
                <div key={model.name} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[11px]">
                  <span className="font-mono font-medium text-foreground">{model.name}</span>
                  <Badge tone={model.processor === "cpu" ? "warning" : "success"}>{model.processor === "gpu" ? "100% GPU" : model.processor === "partial" ? "partial GPU" : "CPU"}</Badge>
                  <span className="text-foreground-muted">{fmtBytes(model.size)}</span>
                  {model.size_vram ? <span className="text-foreground-muted">VRAM {fmtBytes(model.size_vram)}</span> : null}
                  {model.context_length ? <span className="text-foreground-muted">ctx {model.context_length.toLocaleString()}</span> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Installed models" description="Real models stored locally in Ollama" icon={<Sparkles className="h-3.5 w-3.5" />} actions={<Badge tone="neutral">{installed.length} total</Badge>} />
        <CardContent className="p-0">
          {installed.length === 0 ? (
            <p className="p-6 text-center text-[12px] text-foreground-muted">No local models installed yet. Pull a suggestion above (requires Ollama).</p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {installed.map((model) => (
                <div key={model.name} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12px] font-medium text-foreground">{model.name}</p>
                    <p className="mt-0.5 text-[10.5px] text-foreground-muted">
                      {[model.parameter_size, model.quantization, model.family, fmtBytes(model.size)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void remove(model.name)} disabled={removing !== null || Boolean(pulling)} title="Delete model" className="text-foreground-muted hover:text-error">
                    {removing === model.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-inset px-3 py-2.5 text-[11px] text-foreground-secondary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        <p>Local models never leave this machine. Download progress and model lists come from real Ollama APIs; nothing is simulated.</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Cpu; label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted"><Icon className="h-3.5 w-3.5" />{label}</div>
        <p className="mt-1.5 truncate text-[13px] font-medium text-foreground" title={value}>{value}</p>
        {detail ? <p className="mt-0.5 truncate text-[10px] text-foreground-muted" title={detail}>{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-border text-[11px] text-foreground-muted">{text}</div>;
}
