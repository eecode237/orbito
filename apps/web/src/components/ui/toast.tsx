"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "error";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
};

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  for (const listener of listeners) listener();
}

function dismiss(id: string) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function toast(input: { title: string; description?: string; tone?: Tone; duration?: number }) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item: ToastItem = {
    id,
    title: input.title,
    description: input.description,
    tone: input.tone ?? "info",
  };
  items = [item, ...items].slice(0, 5);
  emit();
  const duration = input.duration ?? 4200;
  if (duration > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

const styles: Record<Tone, { border: string; icon: string }> = {
  info: { border: "border-info/30", icon: "text-info" },
  success: { border: "border-success/30", icon: "text-success" },
  warning: { border: "border-warning/30", icon: "text-warning" },
  error: { border: "border-error/30", icon: "text-error" },
};

function ToneIcon({ tone }: { tone: Tone }) {
  const className = cn("h-4 w-4", styles[tone].icon);
  if (tone === "success") return <CheckCircle2 className={className} />;
  if (tone === "warning") return <AlertTriangle className={className} />;
  if (tone === "error") return <XCircle className={className} />;
  return <Info className={className} />;
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface-elevated px-3.5 py-3 shadow-[var(--shadow-lg)] animate-rise",
            styles[item.tone].border,
          )}
        >
          <span className="mt-0.5 shrink-0">
            <ToneIcon tone={item.tone} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-foreground">{item.title}</p>
            {item.description ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-muted">
                {item.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss notification"
            className="focus-ring grid h-5 w-5 shrink-0 place-items-center rounded text-foreground-muted transition hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
