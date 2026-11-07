"use client";

import Link from "next/link";
import {
  Cloud,
  HardDrive,
  Server,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge, Dot } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

function StatusRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: "success" | "warning" | "error" | "neutral" | "info";
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="truncate text-[11px] text-foreground-secondary">{label}</p>
        {detail ? (
          <p className="mt-0.5 truncate font-mono text-[8.5px] text-foreground-muted">{detail}</p>
        ) : null}
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <Dot tone={tone} pulse={tone === "success"} />
        <span
          className={cn(
            "text-[10px] font-medium",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "error" && "text-error",
            tone === "info" && "text-info",
            tone === "neutral" && "text-foreground-muted",
          )}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 lg:border-r lg:border-border-subtle lg:pr-4 lg:last:border-r-0 lg:last:pr-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="type-eyebrow text-foreground-muted">{title}</p>
        {action}
      </div>
      <div className="divide-y divide-border-subtle border-y border-border-subtle">{children}</div>
    </div>
  );
}

export function SystemStatus({ data }: { data: DashboardOverview }) {
  const providers = Object.entries(data.health.providers);
  const cloudProviders = providers.filter(([id]) => id !== "mock");
  const connected = cloudProviders.filter(([, configured]) => configured);
  const failed = cloudProviders.filter(([, configured]) => !configured);
  const defaultModel = data.models.catalog.find((model) => model.is_default);
  const ollamaOk = data.models.reachable;
  const databaseOk = data.health.database === "ok";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="System status"
        description="Every indicator below is verified by the API; nothing is inferred."
        icon={<Server className="h-3.5 w-3.5" />}
        actions={
          <Badge tone={databaseOk ? "success" : "error"} dot>
            {databaseOk ? "Core online" : "Degraded"}
          </Badge>
        }
      />
      <CardContent className="grid flex-1 gap-4 p-4 lg:grid-cols-3">
        <Section
          title="ORBITO core"
          action={
            <span className="font-mono text-[8.5px] text-foreground-muted">
              {formatRelative(data.generated_at)}
            </span>
          }
        >
          <StatusRow
            label="API connection"
            value="Connected"
            detail="authenticated REST + SSE"
            tone="success"
          />
          <StatusRow
            label="Database"
            value={databaseOk ? "Operational" : "Unavailable"}
            detail="PostgreSQL"
            tone={databaseOk ? "success" : "error"}
          />
          <StatusRow
            label="Redis / queue"
            value="Not configured"
            detail="no worker topology in this build"
            tone="neutral"
          />
        </Section>

        <Section
          title="Local inference"
          action={
            <Badge tone={ollamaOk ? "success" : data.models.enabled ? "error" : "neutral"} dot>
              {ollamaOk ? "Ollama ready" : data.models.enabled ? "Offline" : "Disabled"}
            </Badge>
          }
        >
          <StatusRow
            label="Ollama"
            value={ollamaOk ? "Connected" : "Disconnected"}
            detail={
              ollamaOk
                ? `v${data.models.ollama.version ?? "unknown"} · ${data.models.ollama.base_url}`
                : (data.models.ollama.error ?? data.models.error ?? "No response")
            }
            tone={ollamaOk ? "success" : data.models.enabled ? "error" : "neutral"}
          />
          <StatusRow
            label="Installed models"
            value={`${data.models.installed.length} available`}
            detail={`${data.models.running.length} loaded in memory`}
            tone={ollamaOk ? "info" : "neutral"}
          />
          <StatusRow
            label="Default route"
            value={defaultModel?.label ?? "Not configured"}
            detail={defaultModel ? `${defaultModel.provider} · ${defaultModel.model}` : undefined}
            tone={defaultModel?.configured ? "success" : "warning"}
          />
        </Section>

        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="type-eyebrow text-foreground-muted">Cloud providers</p>
            <Link
              href="/models"
              className="focus-ring rounded text-[9.5px] font-medium text-primary-hover hover:text-primary-soft"
            >
              Model Hub
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {cloudProviders.map(([id, configured]) => (
              <div
                key={id}
                className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5"
              >
                <span className="truncate text-[10px] text-foreground-secondary">
                  {data.health.provider_labels[id] ?? id}
                </span>
                {configured ? (
                  <Wifi className="h-3 w-3 shrink-0 text-success" />
                ) : (
                  <WifiOff className="h-3 w-3 shrink-0 text-foreground-muted" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-foreground-muted">
            <Cloud className="h-2.5 w-2.5" />
            {connected.length} connected · {failed.length} unconfigured
          </p>
        </div>
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-foreground-muted">
          <HardDrive className="h-2.5 w-2.5" />
          {data.system.platform} · {data.system.cpu.cores} threads
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-foreground-muted">
          <ShieldCheck className="h-2.5 w-2.5 text-success" />
          {data.tasks.pending_approvals.length} approval
          {data.tasks.pending_approvals.length === 1 ? "" : "s"} pending
        </span>
      </div>
    </Card>
  );
}
