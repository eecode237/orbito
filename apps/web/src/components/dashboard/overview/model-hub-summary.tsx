"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes, Cloud, Cpu, MemoryStick } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

export function ModelHubSummary({ data }: { data: DashboardOverview }) {
  const { models, health, system } = data;
  const installed = models.installed;
  const runningNames = new Set(models.running.map((model) => model.name));
  const loadedBytes = models.running.reduce((sum, model) => sum + (model.size_vram || 0), 0);
  const defaultModel = models.catalog.find((model) => model.is_default);
  const configuredCloud = Object.entries(health.providers).filter(
    ([id, configured]) => configured && id !== "mock",
  ).length;
  const cloudTotal = Object.keys(health.providers).filter((id) => id !== "mock").length;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Model hub"
        description="Local runtimes and configured providers"
        icon={<Boxes className="h-3.5 w-3.5" />}
        actions={
          <Link
            href="/models"
            className="focus-ring inline-flex items-center gap-1 rounded text-[10.5px] font-medium text-primary-hover hover:text-primary-soft"
          >
            Model Hub <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      <CardContent className="flex-1 space-y-3 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Local</p>
            <p className="mt-0.5 font-mono text-[14px] text-foreground">{installed.length}</p>
            <p className="font-mono text-[8px] text-foreground-muted">installed</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Loaded</p>
            <p className="mt-0.5 font-mono text-[14px] text-foreground">{models.running.length}</p>
            <p className="font-mono text-[8px] text-foreground-muted">
              {loadedBytes ? formatBytes(loadedBytes) : "idle"}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Cloud</p>
            <p className="mt-0.5 font-mono text-[14px] text-foreground">
              {configuredCloud}/{cloudTotal}
            </p>
            <p className="font-mono text-[8px] text-foreground-muted">connected</p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="type-eyebrow flex items-center gap-1 text-foreground-muted">
              <Cpu className="h-2.5 w-2.5" /> Local models
            </p>
            <Badge tone={models.reachable ? "success" : models.enabled ? "error" : "neutral"} dot>
              {models.reachable ? "Ollama ready" : models.enabled ? "Unreachable" : "Disabled"}
            </Badge>
          </div>

          {!installed.length ? (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
              <p className="text-[10.5px] text-foreground-secondary">
                {models.enabled ? "No local model installed" : "Local models are disabled"}
              </p>
              <p className="mt-0.5 text-[9px] text-foreground-muted">
                {models.ollama.error ?? models.error ?? "Install one from the Model Hub."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {installed.slice(0, 4).map((model) => {
                const loaded = runningNames.has(model.name);
                return (
                  <div
                    key={model.name}
                    className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[10px] text-foreground">{model.name}</p>
                      <p className="truncate font-mono text-[8px] text-foreground-muted">
                        {[model.parameter_size, model.quantization, formatBytes(model.size)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge tone={loaded ? "success" : "neutral"} dot={loaded}>
                      {loaded ? "Loaded" : "Ready"}
                    </Badge>
                  </div>
                );
              })}
              {installed.length > 4 ? (
                <p className="px-1 font-mono text-[8.5px] text-foreground-muted">
                  +{installed.length - 4} more in Model Hub
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <p className="type-eyebrow mb-1.5 flex items-center gap-1 text-foreground-muted">
            <Cloud className="h-2.5 w-2.5" /> Default route
          </p>
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2.5 py-2">
            <p className="truncate text-[10.5px] text-foreground-secondary">
              {defaultModel?.label ?? "No default model configured"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[8.5px] text-foreground-muted">
              {defaultModel
                ? `${defaultModel.provider} · ${defaultModel.model} · ${defaultModel.local ? "local" : "cloud"}`
                : "Set a provider key in Settings → AI Models"}
            </p>
          </div>
        </div>
      </CardContent>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-foreground-muted">
          <MemoryStick className="h-2.5 w-2.5" />
          host RAM {system.memory.percent.toFixed(0)}% used
        </span>
        <span className="font-mono text-[9px] text-foreground-muted">
          {models.ollama.version ? `ollama v${models.ollama.version}` : "no runtime"}
        </span>
      </div>
    </Card>
  );
}
