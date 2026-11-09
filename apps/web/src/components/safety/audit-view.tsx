"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Loader2, RefreshCw, ScrollText, Search } from "lucide-react";

import { getAuditEvents } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const PAGE = 50;
const OUTCOMES = ["all", "allowed", "denied", "approved", "rejected", "pending", "completed", "failed", "engaged", "released", "enabled", "disabled"];

function outcomeTone(outcome: string): "neutral" | "info" | "warning" | "success" | "error" {
  if (["allowed", "approved", "completed", "enabled", "released"].includes(outcome)) return "success";
  if (["denied", "rejected", "failed", "engaged", "hash_mismatch"].includes(outcome)) return "error";
  if (["pending", "disabled"].includes(outcome)) return "warning";
  return "neutral";
}

export function AuditView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditEvents({ action, outcome, limit: PAGE, offset });
      setEvents(data.events);
      setTotal(data.total);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load audit events.");
    } finally {
      setLoading(false);
    }
  }, [action, outcome, offset]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const current = Math.floor(offset / PAGE) + 1;

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-info">
          <ScrollText className="h-3.5 w-3.5" /> Audit trail
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Audit logs</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Every safety decision, approval, kill-switch change and workflow run is recorded here as it happened. Rows are never
          edited by the UI.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Filter by action</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
          <input
            value={action}
            onChange={(event) => { setOffset(0); setAction(event.target.value); }}
            placeholder="Action (e.g. approval)"
            className="h-8 w-56 rounded-lg border border-border bg-surface pl-8 pr-2 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
          />
        </label>
        <select
          value={outcome}
          onChange={(event) => { setOffset(0); setOutcome(event.target.value); }}
          className="h-8 rounded-lg border border-border bg-surface px-2 text-[11px] text-foreground outline-none"
          aria-label="Filter by outcome"
        >
          {OUTCOMES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={() => { void load(); }} aria-label="Refresh audit log">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
        <span className="ml-auto text-[10px] text-foreground-muted">{total} event{total === 1 ? "" : "s"}</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Events" description="Newest first" icon={<ScrollText className="h-3.5 w-3.5" />} />
        <CardContent>
          {loading && events.length === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-foreground-secondary">No audit events match these filters yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead className="text-[9.5px] uppercase tracking-wide text-foreground-muted">
                  <tr>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">Resource</th>
                    <th className="py-2 pr-3 font-medium">Outcome</th>
                    <th className="py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-border-subtle align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-foreground-muted">{formatRelative(event.created_at)}</td>
                      <td className="py-2 pr-3 font-mono text-[10px] text-foreground">{event.action}</td>
                      <td className="py-2 pr-3 font-mono text-[10px] text-foreground-secondary">{event.resource ?? "—"}</td>
                      <td className="py-2 pr-3"><Badge tone={outcomeTone(event.outcome)}>{event.outcome}</Badge></td>
                      <td className="py-2 font-mono text-[9.5px] text-foreground-muted break-all">
                        {Object.keys(event.detail ?? {}).length ? JSON.stringify(event.detail) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-[10.5px] text-foreground-muted">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              <ChevronLeft className="h-3.5 w-3.5" /> Newer
            </Button>
            <span>Page {current} of {pages}</span>
            <Button variant="outline" size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
              Older <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
