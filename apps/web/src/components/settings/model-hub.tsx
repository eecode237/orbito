"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Boxes,
  CircleAlert,
  CircleCheck,
  Cpu,
  Download,
  HardDrive,
  Loader2,
  MemoryStick,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { deleteLocalModel, getModelHub, pullModel } from "@/lib/api";
import type { ModelHubOverview, PullEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

function bytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** index;
  return `${amount.toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-white/25">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-2 truncate text-[12px] font-medium text-white/80" title={value}>
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-[9.5px] text-white/28" title={detail}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function ModelHub() {
  const [data, setData] = useState<ModelHubOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pulling, setPulling] = useState<{
    name: string;
    percent: number | null;
    status: string;
  } | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getModelHub());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reach the ORBITO API.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load is the effect's entire purpose; the fetch resolves async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      await pullModel(
        name,
        (event: PullEvent) => {
          if (event.type === "progress") {
            setPulling({
              name,
              percent: event.percent,
              status: event.status,
            });
          }
          if (event.type === "error") setPullError(event.error);
        },
        controller.signal,
      );
      await load();
    } catch (err) {
      if (!controller.signal.aborted) {
        setPullError(
          err instanceof Error ? err.message : "The download failed.",
        );
      }
    } finally {
      setPulling(null);
      abortRef.current = null;
    }
  }

  async function remove(name: string) {
    if (!window.confirm(`Delete ${name}? It will need to be downloaded again.`)) {
      return;
    }
    setRemoving(name);
    setPullError(null);
    try {
      await deleteLocalModel(name);
      await load();
    } catch (err) {
      setPullError(
        err instanceof Error ? err.message : `Could not delete ${name}.`,
      );
    } finally {
      setRemoving(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="glass flex items-center gap-2 rounded-2xl p-6 text-[11px] text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading local hardware and models…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rose/20 bg-rose/[0.05] p-4 text-[11px] text-rose/80">
        {error ?? "The Model Hub is unavailable."}
      </div>
    );
  }

  const { hardware, ollama, installed, running, suggestions } = data;
  const gpu = hardware.gpus[0]?.name ?? "No dedicated GPU detected";

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start justify-between gap-3 rounded-2xl border p-4",
          ollama.reachable
            ? "border-mint/20 bg-mint/[0.04]"
            : "border-rose/20 bg-rose/[0.04]",
        )}
      >
        <div className="flex items-start gap-3">
          {ollama.reachable ? (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
          )}
          <div>
            <p
              className={cn(
                "text-[12px] font-medium",
                ollama.reachable ? "text-mint" : "text-rose",
              )}
            >
              {ollama.reachable
                ? `Ollama ${ollama.version ?? ""} connected`
                : "Ollama is offline"}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/35">
              {ollama.reachable
                ? `${installed.length} model${installed.length === 1 ? "" : "s"} installed · ${ollama.base_url}`
                : (ollama.error ??
                  "Start it with `ollama serve`, then refresh this page.")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-[10px] text-white/55 transition hover:border-white/20 hover:text-white/80"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Cpu}
          label="Processor"
          value={hardware.cpu_model ?? "Unknown CPU"}
          detail={`${hardware.cpu_threads ?? 0} threads`}
        />
        <Stat
          icon={MemoryStick}
          label="Memory"
          value={`${bytes(hardware.memory_available_bytes)} free`}
          detail={`${bytes(hardware.memory_total_bytes)} total`}
        />
        <Stat icon={Boxes} label="GPU" value={gpu} detail="Shared system memory" />
        <Stat
          icon={HardDrive}
          label="Disk"
          value={`${bytes(hardware.disk.free_bytes)} free`}
          detail={hardware.disk.path}
        />
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[13px] font-semibold text-white/85">
            Download a model
          </h2>
          <span className="text-[9px] text-white/25">
            stored by Ollama · local only
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-white/30">
          The download continues on the Ollama server. Large models take a while
          on a laptop connection.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void startPull(draft);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="qwen3.5:4b"
            spellCheck={false}
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/22 focus:border-violet/45"
          />
          <button
            type="submit"
            disabled={!draft.trim() || Boolean(pulling)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-violet px-3 text-[11px] font-semibold text-white transition hover:bg-[#8b6dff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pulling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => void startPull(item.name)}
              disabled={item.installed || Boolean(pulling)}
              title={item.note}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9.5px] transition",
                item.installed
                  ? "border-mint/15 bg-mint/[0.04] text-mint/70"
                  : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-violet/30 hover:text-white/70",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {item.installed ? (
                <CircleCheck className="h-3 w-3" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              <span className="font-mono">{item.name}</span>
              <span className="hidden text-white/25 sm:inline">{item.role}</span>
            </button>
          ))}
        </div>

        {pulling ? (
          <div className="mt-3 rounded-xl border border-violet/20 bg-violet/[0.05] p-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-mono text-white/70">{pulling.name}</span>
              <span className="text-violet-soft">
                {pulling.percent === null ? "working…" : `${pulling.percent}%`}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-violet transition-all"
                style={{ width: `${pulling.percent ?? 0}%` }}
              />
            </div>
            <p className="mt-1.5 truncate text-[9px] text-white/30">
              {pulling.status}
            </p>
          </div>
        ) : null}

        {pullError ? (
          <p className="mt-2 text-[10px] text-rose/80">{pullError}</p>
        ) : null}
      </div>

      {running.length > 0 ? (
        <div className="glass rounded-2xl p-4">
          <h2 className="font-display text-[13px] font-semibold text-white/85">
            Loaded now
          </h2>
          <div className="mt-2 divide-y divide-white/[0.04]">
            {running.map((model) => (
              <div
                key={model.name}
                className="flex flex-wrap items-center gap-2 py-2 text-[10px]"
              >
                <span className="font-mono text-white/70">{model.name}</span>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[9px]",
                    model.processor === "cpu"
                      ? "border-amber/25 bg-amber/[0.06] text-amber"
                      : "border-mint/25 bg-mint/[0.06] text-mint",
                  )}
                >
                  {model.processor === "gpu"
                    ? "100% GPU"
                    : model.processor === "partial"
                      ? "partial GPU"
                      : "CPU"}
                </span>
                <span className="text-white/25">{bytes(model.size)}</span>
                {model.context_length ? (
                  <span className="text-white/25">
                    context {model.context_length.toLocaleString()}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[13px] font-semibold text-white/85">
            Installed models
          </h2>
          <span className="text-[9.5px] text-white/25">
            {installed.length} total
          </span>
        </div>

        {installed.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-white/25">
            Nothing installed yet. Pick a suggestion above.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-white/[0.04]">
            {installed.map((model) => (
              <div
                key={model.name}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11.5px] text-white/75">
                    {model.name}
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-white/28">
                    {[
                      model.parameter_size,
                      model.quantization,
                      model.family,
                      bytes(model.size),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(model.name)}
                  disabled={removing !== null || Boolean(pulling)}
                  title="Delete model"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-white/30 transition hover:border-rose/30 hover:text-rose disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {removing === model.name ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="px-1 text-[9.5px] leading-relaxed text-white/22">
        Local models never leave this machine. ORBITO sends each role to the
        model configured in <code className="text-white/40">models.yaml</code>;
        pull a model here first, then assign it to a role.
      </p>
    </div>
  );
}
