"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, CircleAlert, Loader2, RefreshCw } from "lucide-react";

import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function kindTone(kind: string): "neutral" | "info" | "warning" | "success" | "error" {
  if (kind === "approval") return "warning";
  if (kind === "safety") return "error";
  if (kind === "workflow") return "info";
  return "neutral";
}

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications(unreadOnly);
      setItems(data.notifications);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [load]);

  async function markOne(id: string) {
    try {
      await markNotificationRead(id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark as read.");
    }
  }

  async function markAll() {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark all as read.");
    }
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-warning">
          <Bell className="h-3.5 w-3.5" /> Inbox
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Notifications</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Approval requests, safety changes and failed workflow runs, written by the server when they happen.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setLoading(true); setUnreadOnly(false); }}
          className={cn("rounded-full border px-3 py-1 text-[10.5px] transition", !unreadOnly ? "border-primary/40 bg-primary/10 text-primary-hover" : "border-border text-foreground-muted")}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => { setLoading(true); setUnreadOnly(true); }}
          className={cn("rounded-full border px-3 py-1 text-[10.5px] transition", unreadOnly ? "border-primary/40 bg-primary/10 text-primary-hover" : "border-border text-foreground-muted")}
        >
          Unread
        </button>
        <span className="text-[10px] text-foreground-muted">{unread} unread in this view</span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { void markAll(); }} disabled={unread === 0 && !unreadOnly}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { void load(); }} aria-label="Refresh notifications">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Inbox" description="Newest first" icon={<Bell className="h-3.5 w-3.5" />} />
        <CardContent className="space-y-2">
          {loading && items.length === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-foreground-secondary">Nothing here. Approval requests, safety changes and failed runs will appear here.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", item.read ? "border-border-subtle bg-surface-inset/30" : "border-primary/25 bg-primary/[0.04]")}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={kindTone(item.kind)}>{item.kind}</Badge>
                    <p className={cn("text-[12px]", item.read ? "text-foreground-secondary" : "font-semibold text-foreground")}>{item.title}</p>
                  </div>
                  {item.body ? <p className="mt-1 line-clamp-3 text-[10.5px] text-foreground-muted">{item.body}</p> : null}
                  <p className="mt-1 text-[9.5px] text-foreground-muted">{formatRelative(item.created_at)}</p>
                </div>
                {!item.read ? (
                  <Button variant="ghost" size="sm" onClick={() => { void markOne(item.id); }}>Mark read</Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
