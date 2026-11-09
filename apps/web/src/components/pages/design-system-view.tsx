"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TOKENS = [
  "background",
  "surface",
  "surface-elevated",
  "surface-inset",
  "border",
  "primary",
  "secondary",
  "foreground",
  "foreground-secondary",
  "foreground-muted",
  "success",
  "warning",
  "error",
  "info",
];

export function DesignSystemView() {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const read: Record<string, string> = {};
    for (const token of TOKENS) {
      read[token] = style.getPropertyValue(`--${token}`).trim();
    }
    const timer = window.setTimeout(() => setValues(read), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-hover">
          <Palette className="h-3.5 w-3.5" /> Design tokens
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Design system</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Values below are read live from the stylesheet (<code className="rounded bg-surface-inset px-1">globals.css</code>), so this page always matches the app.
        </p>
      </header>

      <Card>
        <CardHeader title="Color tokens" />
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TOKENS.map((token) => (
            <div key={token} className="flex items-center gap-3 rounded-lg border border-border-subtle p-2.5">
              <span className="h-9 w-9 shrink-0 rounded-md border border-border" style={{ background: `var(--${token})` }} aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground">--{token}</p>
                <p className="truncate font-mono text-[10px] text-foreground-muted">{values[token] || "…"}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Components" />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">neutral</Badge>
            <Badge tone="info">info</Badge>
            <Badge tone="warning">warning</Badge>
            <Badge tone="success">success</Badge>
            <Badge tone="error">error</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
