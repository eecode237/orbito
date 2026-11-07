"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Boxes,
  Briefcase,
  Code2,
  FileSearch,
  GraduationCap,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Radar,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Tooltip } from "@/components/ui/overlay";
import type { Agent, ModelInfo } from "@/lib/types";

const quickActions = [
  {
    label: "Research",
    icon: Search,
    agent: "research",
    prompt: "Research the latest AI agent frameworks and compare them with sources.",
  },
  {
    label: "Find jobs",
    icon: Briefcase,
    agent: "career",
    prompt: "Find recent AI engineering jobs and rank them against my profile.",
  },
  {
    label: "Study",
    icon: GraduationCap,
    agent: "study",
    prompt: "Create a seven-day study plan for my current learning goal.",
  },
  {
    label: "Scrape",
    icon: Radar,
    agent: "research",
    prompt: "Scrape a public page and extract its main headings and links.",
  },
  {
    label: "Analyze files",
    icon: FileSearch,
    agent: "documents",
    prompt: "Summarize the documents in my workspace and list the key points.",
  },
  {
    label: "Generate media",
    icon: ImageIcon,
    agent: "core",
    prompt: "Plan an image generation workflow for my next project.",
  },
  {
    label: "Write code",
    icon: Code2,
    agent: "coding",
    prompt: "Help me implement the next component of my project.",
  },
];

export function CommandCenter({
  agents,
  models,
  disabled,
}: {
  agents: Agent[];
  models: ModelInfo[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [agent, setAgent] = useState("auto");
  const [model, setModel] = useState("");

  function launch(prompt: string, nextAgent = agent, nextModel = model) {
    const text = prompt.trim();
    if (!text) return;
    const params = new URLSearchParams({ q: text, agent: nextAgent || "auto" });
    if (nextModel) params.set("model", nextModel);
    router.push(`/chat?${params.toString()}`);
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-primary/25 bg-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_140px_at_20%_0%,var(--primary),transparent_70%)] opacity-[0.08]" />
      <div className="relative flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary-hover">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="type-h4 text-foreground">Command center</h2>
              <p className="text-[10.5px] text-foreground-muted">
                One prompt. ORBITO plans the steps and routes the model.
              </p>
            </div>
          </div>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-foreground-muted sm:block">
            Connected to /api/v1/chat
          </span>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            launch(value);
          }}
          className="mt-3.5 flex items-center gap-2 rounded-xl border border-border bg-surface-inset p-1.5 transition-colors focus-within:border-primary/45"
        >
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ask ORBITO to do anything…"
            aria-label="Ask ORBITO"
            disabled={disabled}
            className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[13.5px] text-foreground outline-none placeholder:text-foreground-muted disabled:cursor-not-allowed"
          />

          <Tooltip label="Attachments open in Documents" side="top">
            <span className="inline-flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled
                aria-label="Attach a file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </span>
          </Tooltip>

          <Tooltip label="Voice capture is not connected yet" side="top">
            <span className="inline-flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled
                aria-label="Use voice"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </span>
          </Tooltip>

          <Button type="submit" variant="primary" size="icon" disabled={disabled || !value.trim()}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Agent</span>
            <Select
              value={agent}
              onChange={(event) => setAgent(event.target.value)}
              className="h-8 max-w-[190px] text-[11px]"
            >
              <option value="auto">Auto agent</option>
              {agents.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="relative">
            <span className="sr-only">Model role</span>
            <Select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="h-8 max-w-[220px] text-[11px]"
            >
              <option value="">Auto model</option>
              {models.map((item) => (
                <option key={item.role} value={item.role}>
                  {item.role} · {item.label}
                </option>
              ))}
            </Select>
          </label>

          <span className="hidden text-[10px] text-foreground-muted sm:block">
            Routing respects provider health and local-first policy.
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => launch(action.prompt, action.agent, model)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-inset px-2.5 py-1 text-[10.5px] text-foreground-secondary transition-colors hover:border-primary/40 hover:bg-primary/[0.07] hover:text-foreground"
              >
                <Icon className="h-3 w-3" />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-4 sm:grid-cols-4">
          {[
            { icon: Route, label: "Routing", value: "Local-first" },
            { icon: ShieldCheck, label: "Approvals", value: "Human-gated" },
            { icon: Boxes, label: "Model roles", value: String(models.length) },
            { icon: Sparkles, label: "Agents", value: String(agents.length) },
          ].map((fact) => {
            const Icon = fact.icon;
            return (
              <div
                key={fact.label}
                className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-inset/70 px-2 py-1.5"
              >
                <Icon className="h-3 w-3 shrink-0 text-foreground-muted" />
                <div className="min-w-0">
                  <p className="type-eyebrow text-[7.5px] text-foreground-muted">{fact.label}</p>
                  <p className="truncate font-mono text-[9.5px] text-foreground-secondary">
                    {fact.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
