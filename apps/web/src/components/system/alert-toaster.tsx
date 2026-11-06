"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, BellRing, CircleAlert, X } from "lucide-react";

import { getSystemAlerts } from "@/lib/api";
import type { SystemAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

type Toast = SystemAlert & { key: string };

const POLL_MS = 15_000;
const DISMISS_MS = 9_000;

export function AlertToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const seen = useRef<Set<string>>(new Set());
  const firstRun = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      // Browser permission is only readable after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const dismiss = useCallback((key: string) => {
    setToasts((previous) => previous.filter((toast) => toast.key !== key));
  }, []);

  const check = useCallback(async () => {
    try {
      const data = await getSystemAlerts();
      const current = new Set(data.alerts.map((alert) => alert.id));

      // First poll only records the baseline: do not fire a burst of toasts
      // for conditions that were already true before the tab opened.
      if (!firstRun.current) {
        const fresh = data.alerts.filter((alert) => !seen.current.has(alert.id));
        if (fresh.length) {
          const stamped = fresh.map((alert) => ({
            ...alert,
            key: `${alert.id}-${Date.now()}`,
          }));
          setToasts((previous) => [...previous, ...stamped].slice(-4));

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            for (const alert of fresh) {
              try {
                new Notification(`ORBITO · ${alert.title}`, {
                  body: `${alert.value} — ${alert.detail}`,
                  tag: alert.id,
                });
              } catch {
                // Some browsers require a service worker; the toast remains.
              }
            }
          }
        }
      }

      firstRun.current = false;
      seen.current = current;
    } catch {
      // The API being down is expected while the stack boots; stay quiet.
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, [check]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => dismiss(toast.key), DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
      {permission === "default" ? (
        <button
          type="button"
          onClick={() => void enableNotifications()}
          className="pointer-events-auto flex items-center gap-2 self-end rounded-full border border-white/10 bg-[#0b0718]/95 px-3 py-1.5 text-[10px] text-white/50 shadow-lg backdrop-blur transition hover:border-violet/30 hover:text-white/80"
        >
          <Bell className="h-3 w-3" />
          Enable desktop alerts
        </button>
      ) : null}

      {toasts.map((toast) => (
        <div
          key={toast.key}
          className={cn(
            "pointer-events-auto overflow-hidden rounded-xl border bg-[#0b0718]/95 p-3 shadow-2xl backdrop-blur",
            toast.level === "critical" ? "border-rose/35" : "border-amber/30",
          )}
        >
          <div className="flex items-start gap-2">
            <CircleAlert
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                toast.level === "critical" ? "text-rose" : "text-amber",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] font-medium text-white/85">{toast.title}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.key)}
                  className="shrink-0 text-white/30 transition hover:text-white/70"
                  aria-label="Dismiss alert"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-white/40">{toast.detail}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-[9.5px] text-white/35">{toast.value}</span>
                {toast.href ? (
                  <Link
                    href={toast.href}
                    onClick={() => dismiss(toast.key)}
                    className="inline-flex items-center gap-0.5 text-[9.5px] text-violet-soft/80 transition hover:text-violet-soft"
                  >
                    Open <ArrowUpRight className="h-2.5 w-2.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}

      {permission === "granted" && toasts.length ? (
        <span className="pointer-events-none flex items-center gap-1 self-end text-[9px] text-white/25">
          <BellRing className="h-2.5 w-2.5" /> desktop alerts on
        </span>
      ) : null}
    </div>
  );
}
