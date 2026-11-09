"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, ShieldAlert } from "lucide-react";

import { getModels } from "@/lib/api";
import type { ProviderStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ImageView() {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getModels()
      .then((data) => { if (alive) setProviders(data.providers); })
      .catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load providers."); });
    return () => { alive = false; };
  }, []);

  const imageProviders = providers?.filter((p) => p.configured && p.capabilities.includes("image")) ?? [];

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-hover">
          <ImageIcon className="h-3.5 w-3.5" /> Image studio
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Images</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Image generation runs only through a configured provider in the Model Gateway. This page shows what is actually available.
        </p>
      </header>

      {error ? <p role="alert" className="text-[11px] text-error">{error}</p> : null}

      <Card>
        <CardHeader title="Image providers" icon={<ImageIcon className="h-3.5 w-3.5" />} />
        <CardContent>
          {!providers && !error ? (
            <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Checking providers…</div>
          ) : imageProviders.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/[0.05] p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="text-[12px] font-semibold text-foreground">No image-generation provider is configured.</p>
                <p className="text-[11px] text-foreground-secondary">
                  Local Ollama in this build provides text models only. Add an image-capable provider key in Settings to enable generation; nothing is generated or faked until then.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {imageProviders.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-inset/40 px-3 py-2 text-[11.5px]">
                  <span className="text-foreground">{p.label}</span>
                  <Badge tone="success">configured</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
