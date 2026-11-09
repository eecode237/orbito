"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleAlert, Loader2, Power, RefreshCw, ShieldCheck, X } from "lucide-react";

import {
  decideApproval,
  getApprovals,
  getSafetyStatus,
  setKillSwitch,
  setPcControl,
} from "@/lib/api";
import type { Approval, SafetyStatus } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const FILTERS = ["pending", "approved", "rejected", "consumed", "expired"] as const;

function statusTone(status: string): "neutral" | "info" | "warning" | "success" | "error" {
  if (status === "approved") return "info";
  if (status === "consumed") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "error";
  return "neutral";
}

export function ApprovalsView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [safety, setSafety] = useState<SafetyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, status] = await Promise.all([getApprovals(filter), getSafetyStatus()]);
      setApprovals(list.approvals);
      setSafety(status);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load approvals.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [load]);

  async function decide(item: Approval, approved: boolean) {
    setBusyId(item.id);
    setError(null);
    try {
      // The hash echoed back is the one the human saw; the server refuses any mismatch.
      await decideApproval(item.id, approved, item.payload_hash);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Decision failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleKill() {
    if (!safety) return;
    setError(null);
    try {
      await setKillSwitch(!safety.kill_switch.engaged);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the kill switch.");
    }
  }

  async function togglePc() {
    if (!safety) return;
    setError(null);
    try {
      await setPcControl(!safety.pc_control.enabled);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change PC control.");
    }
  }

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-[linear-gradient(145deg,rgba(40,18,24,0.7),rgba(8,10,23,0.96))] p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-error">
          <ShieldCheck className="h-3.5 w-3.5" /> Safety spine
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">
          Approvals
        </h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Sensitive actions run only after you approve the exact payload shown here. Each approval works once, expires, and
          is refused if the payload changes. The model cannot approve its own requests.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[10px] font-medium text-foreground-muted">Kill switch</p>
              <p className={cn("mt-1 text-[14px] font-semibold", safety?.kill_switch.engaged ? "text-error" : "text-success")}>
                {safety ? (safety.kill_switch.engaged ? "Engaged — all sensitive actions denied" : "Released") : "…"}
              </p>
            </div>
            <Button variant={safety?.kill_switch.engaged ? "secondary" : "outline"} size="sm" onClick={() => { void toggleKill(); }} disabled={!safety}>
              <Power className="h-3.5 w-3.5" /> {safety?.kill_switch.engaged ? "Release" : "Engage"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[10px] font-medium text-foreground-muted">PC control</p>
              <p className="mt-1 text-[14px] font-semibold text-foreground">
                {safety ? (safety.pc_control.enabled ? "Enabled (no executors installed yet)" : "Disabled") : "…"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void togglePc(); }} disabled={!safety}>
              {safety?.pc_control.enabled ? "Disable" : "Enable"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-foreground-muted">Pending approvals</p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-foreground">{safety?.pending_approvals ?? "…"}</p>
            <p className="mt-1 text-[9.5px] text-foreground-muted">Loopback only: decisions from other machines are refused.</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setLoading(true); setFilter(item); }}
            className={cn(
              "rounded-full border px-3 py-1 text-[10.5px] capitalize transition",
              filter === item ? "border-primary/40 bg-primary/10 text-primary-hover" : "border-border text-foreground-muted hover:text-foreground",
            )}
          >
            {item}
          </button>
        ))}
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => { void load(); }} aria-label="Refresh approvals">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading && approvals.length === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : approvals.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-[12px] text-foreground-secondary">
          No {filter} approvals. Sensitive actions appear here when they are requested.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((item) => (
            <Card key={item.id}>
              <CardHeader
                title={item.summary}
                description={`${item.action} · requested ${formatRelative(item.created_at)}${item.expires_at ? ` · expires ${formatRelative(item.expires_at)}` : ""}`}
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                actions={<Badge tone={statusTone(item.status)}>{item.status}</Badge>}
              />
              <CardContent>
                <pre className="max-h-48 overflow-auto rounded-lg bg-surface-inset/70 p-3 font-mono text-[10px] leading-relaxed text-foreground-secondary">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
                <p className="mt-2 font-mono text-[9px] text-foreground-muted" title="Payload hash bound to this approval">
                  payload sha256: {item.payload_hash}
                </p>
                {item.decision_note ? <p className="mt-1 text-[10px] text-foreground-secondary">Note: {item.decision_note}</p> : null}
                {item.status === "pending" ? (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { void decide(item, false); }} disabled={busyId === item.id}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => { void decide(item, true); }} disabled={busyId === item.id}>
                      {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve once
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
