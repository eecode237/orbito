"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlTask } from "@/lib/api";
import type { PendingApproval } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

function riskFor(request: string | null) {
  const text = (request ?? "").toLowerCase();
  if (/(delete|remove|terminate|destroy|wipe)/.test(text)) {
    return { label: "Destructive", tone: "error" as const };
  }
  if (/(submit|send|publish|transaction|payment|apply|post|upload)/.test(text)) {
    return { label: "External", tone: "warning" as const };
  }
  return { label: "Sensitive", tone: "warning" as const };
}

export function PendingApprovals({
  approvals,
  onChanged,
}: {
  approvals: PendingApproval[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(`${id}:${action}`);
    setError(null);
    try {
      await controlTask(id, action);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The decision could not be recorded.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Pending approvals"
        description="Sensitive actions waiting for a human decision"
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        actions={
          <Badge tone={approvals.length ? "warning" : "success"} dot>
            {approvals.length ? `${approvals.length} waiting` : "Clear"}
          </Badge>
        }
      />
      <CardContent className="flex-1 p-0">
        {!approvals.length ? (
          <EmptyState
            compact
            icon={ShieldCheck}
            title="No approvals waiting"
            description="Agents cannot perform sensitive external actions without your explicit consent."
            action={
              <Link href="/approvals" className="text-[11px] font-medium text-primary-hover">
                Approval history
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border-subtle">
            {approvals.map((approval) => {
              const risk = riskFor(approval.request);
              const approving = busy === `${approval.task_id}:approve`;
              const rejecting = busy === `${approval.task_id}:reject`;
              return (
                <div key={approval.task_id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-foreground">
                        {approval.title || "Sensitive action"}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[8.5px] text-foreground-muted">
                        {approval.agent ?? "core"} · {formatRelative(approval.created_at)}
                      </p>
                    </div>
                    <Badge tone={risk.tone}>{risk.label}</Badge>
                  </div>

                  <p className="mt-1.5 line-clamp-2 rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5 text-[10px] leading-relaxed text-foreground-secondary">
                    {approval.request ?? "The agent requested permission to continue."}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="success"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={busy !== null}
                      onClick={() => void decide(approval.task_id, "approve")}
                    >
                      {approving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={busy !== null}
                      onClick={() => void decide(approval.task_id, "reject")}
                    >
                      {rejecting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      Reject
                    </Button>
                    <Link
                      href={`/agents/monitor?task=${approval.task_id}`}
                      className="focus-ring rounded px-1 text-[10px] font-medium text-foreground-muted hover:text-foreground"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error ? (
          <p className="border-t border-error/20 bg-error/[0.04] px-3 py-1.5 text-[9.5px] text-error">
            {error}
          </p>
        ) : null}
      </CardContent>
      <div className="border-t border-border-subtle px-4 py-2 font-mono text-[9px] text-foreground-muted">
        Every decision is written to the task event stream.
      </div>
    </Card>
  );
}
