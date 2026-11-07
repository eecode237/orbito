"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Database,
  Filter,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { OrbitoBarChart, OrbitoPieChart, type ChartConfig } from "@/components/charts/orbito-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createMemory, deleteMemoryApi, getMemories } from "@/lib/api";
import type { MemoryItem } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

type Scope = "long_term" | "workspace" | "all";

export function MemoryView() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<Scope>("all");
  const [draft, setDraft] = useState("");
  const [draftScope, setDraftScope] = useState<"long_term" | "workspace">("long_term");
  const [draftKey, setDraftKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMemories();
      setMemories(Array.isArray(data.memories) ? data.memories : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (scopeFilter !== "all" && m.scope !== scopeFilter) return false;
      if (!q) return true;
      return [m.content, m.key, m.scope, m.workspace_id].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [memories, query, scopeFilter]);

  const stats = useMemo(() => {
    const longTerm = memories.filter((m) => m.scope === "long_term").length;
    const workspace = memories.filter((m) => m.scope === "workspace").length;
    const other = Math.max(0, memories.length - longTerm - workspace);
    return { total: memories.length, longTerm, workspace, other };
  }, [memories]);

  const scopePie = useMemo(() => {
    const rows = [
      { name: "long_term", value: stats.longTerm, fill: "var(--chart-1)" },
      { name: "workspace", value: stats.workspace, fill: "var(--chart-2)" },
      ...(stats.other ? [{ name: "other", value: stats.other, fill: "var(--chart-4)" }] : []),
    ].filter((r) => r.value > 0);
    return rows;
  }, [stats]);
  const scopePieConfig: ChartConfig = {
    long_term: { label: `Long-term (${stats.longTerm})`, color: "var(--chart-1)" },
    workspace: { label: `Workspace (${stats.workspace})`, color: "var(--chart-2)" },
    other: { label: `Other (${stats.other})`, color: "var(--chart-4)" },
  };

  const scopeBar = useMemo(() => [
    { label: "Long-term", count: stats.longTerm },
    { label: "Workspace", count: stats.workspace },
  ], [stats]);
  const scopeBarConfig: ChartConfig = { count: { label: "Memories", color: "var(--chart-2)" } };

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await createMemory({ content, scope: draftScope, key: draftKey.trim() || null });
      setDraft("");
      setDraftKey("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save memory.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!id || deletingId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this memory? This cannot be undone.")) return;
    setDeletingId(id);
    setFormError(null);
    try {
      await deleteMemoryApi(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete memory.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total memories" value={String(stats.total)} icon={<Database className="h-3.5 w-3.5" />} tone="neutral" />
        <Stat label="Long-term" value={String(stats.longTerm)} icon={<BrainCircuit className="h-3.5 w-3.5" />} tone="primary" />
        <Stat label="Workspace" value={String(stats.workspace)} icon={<Layers className="h-3.5 w-3.5" />} tone="success" />
        <Stat label="Showing" value={loading ? "…" : String(filtered.length)} icon={<Filter className="h-3.5 w-3.5" />} tone="neutral" sub={query || scopeFilter !== "all" ? "Filtered view" : "All memories"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Memory by scope" description="Real distribution of saved memories (Pie chart + tooltip)" icon={<BrainCircuit className="h-3.5 w-3.5" />} />
          <CardContent>
            {loading ? <LoadingBox /> : scopePie.length ? <OrbitoPieChart data={scopePie} config={scopePieConfig} height={220} innerRadius="55%" /> : <EmptyBox text="No memories saved yet. Add one below." />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Scope counts" description="Real counts by memory scope (Bar chart + tooltip)" icon={<Layers className="h-3.5 w-3.5" />} />
          <CardContent>
            {loading ? <LoadingBox /> : stats.total ? <OrbitoBarChart data={scopeBar} config={scopeBarConfig} height={220} /> : <EmptyBox text="No data yet." />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Saved memories"
            description="Real user-controlled memories from the ORBITO database. Nothing is fabricated."
            icon={<Database className="h-3.5 w-3.5" />}
            actions={<Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh</Button>}
          />
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search content, key, scope…"
                  className="h-9 w-full rounded-xl border border-border bg-surface-inset pl-9 pr-3 text-[12px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
                />
              </div>
              <div className="flex rounded-xl border border-border bg-surface-inset p-0.5">
                {(["all", "long_term", "workspace"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScopeFilter(s)}
                    className={cn("rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium transition", scopeFilter === s ? "bg-surface-elevated text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground")}
                  >
                    {s === "all" ? "All" : s === "long_term" ? "Long-term" : "Workspace"}
                  </button>
                ))}
              </div>
            </div>

            {error ? <div className="rounded-xl border border-error/25 bg-error/[0.04] p-3 text-[11px] text-error/90">{error}</div> : null}
            {formError && !loading ? <div className="rounded-xl border border-error/25 bg-error/[0.04] p-3 text-[11px] text-error/90">{formError}</div> : null}

            {loading ? (
              <div className="flex items-center gap-2 py-8 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading memories…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-[12px] text-foreground-muted">
                {memories.length === 0 ? "No memories saved yet. ORBITO only stores what you explicitly save." : "No memories match your filter."}
              </div>
            ) : (
              <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
                {filtered.map((memory) => (
                  <div key={memory.id} className="flex items-start gap-3 px-3 py-3">
                    <BrainCircuit className={cn("mt-0.5 h-4 w-4 shrink-0", memory.scope === "workspace" ? "text-success" : "text-primary")} />
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground">{memory.content}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <Badge tone={memory.scope === "workspace" ? "success" : "neutral"}>{memory.scope || "long_term"}</Badge>
                        {memory.key ? <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-foreground-muted"><KeyRound className="h-2.5 w-2.5" />{memory.key}</span> : null}
                        {memory.workspace_id ? <span className="text-foreground-muted">workspace {memory.workspace_id}</span> : null}
                        <span className="text-foreground-muted">{formatRelative(memory.created_at)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onDelete(memory.id)}
                      disabled={deletingId === memory.id}
                      title="Delete memory"
                      className="shrink-0 text-foreground-muted hover:text-error"
                    >
                      {deletingId === memory.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Add memory" description="Explicitly save something ORBITO should remember." icon={<Plus className="h-3.5 w-3.5" />} />
            <CardContent>
              <form onSubmit={onCreate} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-foreground-muted">Content</label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="e.g. I prefer concise answers and TypeScript for frontend work."
                    rows={4}
                    className="w-full rounded-xl border border-border bg-surface-inset px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-foreground-muted">Scope</label>
                    <select
                      value={draftScope}
                      onChange={(e) => setDraftScope(e.target.value as "long_term" | "workspace")}
                      className="h-9 w-full rounded-xl border border-border bg-surface-inset px-3 text-[12px] text-foreground outline-none focus:border-primary/50"
                    >
                      <option value="long_term">Long-term</option>
                      <option value="workspace">Workspace</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-foreground-muted">Key (optional)</label>
                    <input
                      value={draftKey}
                      onChange={(e) => setDraftKey(e.target.value)}
                      placeholder="preference.style"
                      className="h-9 w-full rounded-xl border border-border bg-surface-inset px-3 font-mono text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={!draft.trim() || busy} className="w-full">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Save memory
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="How memory works" description="Transparency" icon={<BrainCircuit className="h-3.5 w-3.5" />} />
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-foreground-secondary">
              <p><span className="font-medium text-foreground">User-controlled:</span> ORBITO stores memories you explicitly save (and task context where implemented). This page shows real database records only.</p>
              <p><span className="font-medium text-foreground">Scopes:</span> <span className="font-mono">long_term</span> applies broadly; <span className="font-mono">workspace</span> is for project/workspace context.</p>
              <p><span className="font-medium text-foreground">Delete anytime:</span> Removing a memory deletes it from the store. No hidden copies are created by this UI.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone, sub }: { label: string; value: string; icon: React.ReactNode; tone: "neutral" | "primary" | "success"; sub?: string }) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : "text-foreground-muted";
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn("flex items-center gap-1.5 text-[10px]", toneClass)}>{icon}{label}</div>
        <p className="mt-1.5 font-mono text-[20px] font-semibold leading-none tracking-tight text-foreground">{value}</p>
        {sub ? <p className="mt-1 text-[10px] text-foreground-muted">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function LoadingBox() {
  return <div className="flex h-[220px] items-center justify-center text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;
}

function EmptyBox({ text }: { text: string }) {
  return <div className="grid h-[220px] place-items-center rounded-lg border border-dashed border-border px-4 text-center text-[11px] text-foreground-muted">{text}</div>;
}
