"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Boxes, WifiOff } from "lucide-react";

import { getModels } from "@/lib/api";
import type { ModelInfo, ProviderStatus } from "@/lib/types";

export function ModelStrip() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    let alive = true;
    getModels()
      .then((data) => {
        if (!alive) return;
        setModels(data.models);
        setProviders(data.providers);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const primary = models.find((model) => model.is_default) ?? models[0];
  const live = providers.some((provider) => provider.configured && provider.id !== "mock");

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-violet-soft" />
          <h2 className="font-display text-[13.5px] font-semibold text-white/90">
            Model gateway
          </h2>
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/35">
            {live ? "live" : "offline ready"}
          </span>
        </div>
        <Link
          href="/settings?tab=models"
          className="flex items-center gap-1 text-[10.5px] text-white/35 transition hover:text-white/75"
        >
          Configure <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet/25 bg-violet/10">
            <span className="h-2 w-2 rounded-full bg-violet-soft shadow-[0_0_10px_#a78bfa]" />
          </span>
          <div>
            <p className="text-[12px] font-medium text-white/85">
              {primary ? `${primary.label}` : "Resolving models…"}
            </p>
            <p className="text-[10px] text-white/30">
              {primary
                ? `${primary.provider} · ${primary.role} role · ${primary.context_window.toLocaleString()} ctx`
                : "Every call flows through one gateway"}
            </p>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-white/10 sm:block" />

        <div className="flex flex-wrap gap-1.5">
          {models.map((model) => (
            <span
              key={model.role}
              className={`rounded-md border px-2 py-1 text-[9.5px] capitalize ${
                model.configured
                  ? "border-white/10 bg-white/[0.04] text-white/55"
                  : "border-white/[0.05] bg-white/[0.015] text-white/25"
              }`}
            >
              {model.role}
            </span>
          ))}
        </div>

        {!live ? (
          <span className="ml-auto flex items-center gap-1.5 rounded-lg border border-amber/20 bg-amber/[0.06] px-2 py-1 text-[9.5px] text-amber/80">
            <WifiOff className="h-3 w-3" />
            Mock provider active — add a key to go live
          </span>
        ) : null}
      </div>
    </section>
  );
}
