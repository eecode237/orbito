"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Coins,
  FileOutput,
  Gauge,
  Layers3,
  Link2,
  Timer,
  Wrench,
  X,
} from "lucide-react";

import { AgentGlyph } from "@/components/agent-glyph";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Agent, TaskSummary } from "@/lib/types";
import { cn, compactNumber, formatCost } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-[9px] text-white/30">{label}</span>
      <span className="min-w-0 break-words text-right font-mono text-[9.5px] text-white/65">
        {value}
      </span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bot;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/[0.05] px-3.5 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-white/25">
        <Icon className="h-2.5 w-2.5" /> {title}
      </p>
      {children}
    </div>
  );
}

export function AgentInspector({
  task,
  agents,
  onClose,
}: {
  task: TaskSummary | null;
  agents: Agent[];
  onClose?: () => void;
}) {
  if (!task) {
    return (
      <aside className="glass rounded-2xl p-4">
        <div className="flex items-center gap-1.5">
          <Layers3 className="h-3.5 w-3.5 text-violet-soft/70" />
          <h2 className="font-display text-[12px] font-semibold text-white/85">Inspector</h2>
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-white/25">
          Select a task to inspect the agent, model, resource usage, tools and generated
          outputs.
        </p>
      </aside>
    );
  }

  const agent = agents.find((item) => item.slug === (task.agent ?? "core"));
  const tools = Array.from(
    new Set(task.steps.map((step) => step.tool).filter(Boolean)),
  ) as string[];
  const usage = task.usage;
  const sources = task.sources ?? [];

  return (
    <aside className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Layers3 className="h-3.5 w-3.5 text-violet-soft/70" />
          <h2 className="font-display text-[12px] font-semibold text-white/85">Inspector</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={task.status} />
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="focus-ring grid h-6 w-6 place-items-center rounded-md border border-white/[0.07] text-white/35 xl:hidden"
              aria-label="Close inspector"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section icon={FileOutput} title="Task information">
          <p className="text-[11px] font-medium leading-snug text-white/80">{task.title}</p>
          <div className="mt-1.5">
            <Row label="Task ID" value={<span className="text-[8.5px]">{task.id}</span>} />
            <Row
              label="Created"
              value={
                task.created_at ? new Date(task.created_at).toLocaleString() : "—"
              }
            />
            <Row
              label="Duration"
              value={
                task.duration_seconds !== null && task.duration_seconds !== undefined
                  ? `${task.duration_seconds}s`
                  : task.status === "running"
                    ? "running"
                    : "—"
              }
            />
            <Row label="Priority" value="normal" />
          </div>
        </Section>

        <Section icon={Bot} title="Agent information">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet/20 bg-violet/[0.08]">
              <AgentGlyph
                slug={task.agent ?? "core"}
                className="h-3.5 w-3.5 text-violet-soft"
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-white/80">
                {agent?.name ?? task.agent ?? "ORBITO Core"}
              </p>
              <p className="truncate text-[9px] text-white/30">
                {agent?.tagline ?? "General orchestration"}
              </p>
            </div>
          </div>
          <div className="mt-1.5">
            <Row label="Agent slug" value={task.agent ?? "core"} />
            <Row label="Provider" value={task.provider ?? "—"} />
            <Row label="Model" value={task.model ?? "—"} />
          </div>
        </Section>

        <Section icon={Gauge} title="Resource usage">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
              <p className="text-[8px] uppercase tracking-wide text-white/25">Input</p>
              <p className="mt-0.5 font-mono text-[11px] text-white/75">
                {compactNumber(usage?.prompt_tokens ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
              <p className="text-[8px] uppercase tracking-wide text-white/25">Output</p>
              <p className="mt-0.5 font-mono text-[11px] text-white/75">
                {compactNumber(usage?.completion_tokens ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
              <p className="flex items-center gap-1 text-[8px] uppercase tracking-wide text-white/25">
                <Coins className="h-2 w-2" /> Cost
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-white/75">
                {formatCost(task.cost_usd)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
              <p className="flex items-center gap-1 text-[8px] uppercase tracking-wide text-white/25">
                <Timer className="h-2 w-2" /> Requests
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-white/75">
                {usage?.requests ?? 0}
              </p>
            </div>
          </div>
          <p className="mt-1.5 text-[8.5px] text-white/20">
            Host CPU and memory are visible on System Health.
          </p>
        </Section>

        <Section icon={Wrench} title="Tools used">
          {tools.length ? (
            <div className="flex flex-wrap gap-1">
              {tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-md border border-violet/20 bg-violet/[0.07] px-1.5 py-0.5 text-[8.5px] text-violet-soft/80"
                >
                  {tool}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[9.5px] text-white/25">No external tools were needed.</p>
          )}
        </Section>

        <Section icon={FileOutput} title="Outputs">
          {task.result ? (
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[9.5px] leading-relaxed text-white/50">
              {task.result}
            </p>
          ) : (
            <p className="text-[9.5px] text-white/25">
              {task.status === "running" ? "Generating the final answer…" : "No output yet."}
            </p>
          )}

          {sources.length ? (
            <div className="mt-2 space-y-1">
              <p className="flex items-center gap-1 text-[8px] uppercase tracking-wide text-white/25">
                <Link2 className="h-2 w-2" /> Sources
              </p>
              {sources.slice(0, 5).map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[9px] text-sky/70 transition hover:text-sky"
                >
                  {source.title || source.url}
                </a>
              ))}
            </div>
          ) : null}

          {task.error ? (
            <p className="mt-2 rounded-lg border border-rose/20 bg-rose/[0.05] px-2 py-1.5 text-[9px] leading-snug text-rose/80">
              {task.error}
            </p>
          ) : null}
        </Section>
      </div>

      <div className="border-t border-white/[0.05] p-2.5">
        <Link
          href={`/chat?conversation=${task.conversation_id ?? ""}`}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-1.5 text-[9.5px] text-white/45 transition hover:border-violet/30 hover:text-white/80",
            !task.conversation_id && "pointer-events-none opacity-40",
          )}
        >
          Open conversation <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}
