"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Braces,
  CalendarClock,
  Check,
  CircleAlert,
  GitBranch,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Webhook,
  X,
  Zap,
} from "lucide-react";

import {
  createWorkflow,
  createWorkflowRun,
  deleteWorkflow,
  getWorkflow,
  getWorkflows,
  updateWorkflow,
  type WorkflowInput,
} from "@/lib/api";
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowRun, WorkflowStatus } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const STATUSES: { id: WorkflowStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "archived", label: "Archived" },
];

const TRIGGERS = [
  { id: "manual", label: "Manual", icon: Play, help: "Runs when you press Run now." },
  { id: "schedule", label: "Schedule", icon: CalendarClock, help: "Saved only. Automatic schedules are not running yet." },
  { id: "webhook", label: "Webhook", icon: Webhook, help: "Saved only. Incoming webhooks are not listening yet." },
  { id: "event", label: "System event", icon: Zap, help: "Saved only. Internal event triggers are not wired yet." },
  { id: "chat", label: "Chat command", icon: MessageSquare, help: "Saved only. Chat-triggered workflows are not wired yet." },
] as const;

const NODE_TYPES = [
  { id: "trigger.manual", label: "Manual trigger", ready: true },
  { id: "trigger.schedule", label: "Schedule trigger (saved only)", ready: true },
  { id: "trigger.webhook", label: "Webhook trigger (saved only)", ready: true },
  { id: "trigger.event", label: "System event trigger (saved only)", ready: true },
  { id: "action.chat", label: "Chat / model action", ready: true },
  { id: "transform", label: "Transform text", ready: true },
  { id: "condition", label: "Condition (true / false edges)", ready: true },
  { id: "delay", label: "Delay (0–60 s)", ready: true },
  { id: "action.http", label: "HTTP request (approval required)", ready: true },
  { id: "action.notify", label: "In-app notification", ready: true },
  { id: "action.task", label: "Project task write — not available yet", ready: false },
];

const ACTIVE_RUN = new Set(["queued", "running", "awaiting_approval"]);
type RunNode = {
  id: string;
  type: string;
  label: string;
  status: string;
  approval_id?: string | null;
  output?: { text?: unknown; offline?: boolean } | null;
  error?: string | null;
};

function runNodes(run: WorkflowRun): RunNode[] {
  const raw = run.output?.nodes;
  return Array.isArray(raw) ? (raw as RunNode[]) : [];
}

function nid() {
  return `n_${Math.random().toString(36).slice(2, 8)}`;
}
function eid() {
  return `e_${Math.random().toString(36).slice(2, 8)}`;
}

function statusTone(status: string): "neutral" | "info" | "warning" | "success" | "error" {
  if (status === "active" || status === "completed") return "success";
  if (status === "paused" || status === "blocked" || status === "queued" || status === "awaiting_approval") return "warning";
  if (status === "failed") return "error";
  if (status === "draft" || status === "running") return "info";
  return "neutral";
}

function defaultDefinition(triggerType: string): Workflow["definition"] {
  const triggerNode: WorkflowNode = {
    id: "trigger",
    type: `trigger.${triggerType}`,
    label: TRIGGERS.find((t) => t.id === triggerType)?.label ?? "Trigger",
    config: triggerType === "schedule" ? { cron: "0 8 * * *" } : {},
  };
  return { nodes: [triggerNode], edges: [], version: 1 };
}

export function WorkflowManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<{ workflow: Workflow; runs: WorkflowRun[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWorkflows(query);
      setWorkflows(data.workflows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workflows.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function openDetail(id: string) {
    setBusyId(id);
    try {
      const data = await getWorkflow(id);
      setDetail(data);
      setEditing(data.workflow);
      setCreating(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workflow.");
    } finally {
      setBusyId(null);
    }
  }

  function startCreate() {
    setDetail(null);
    setEditing(null);
    setCreating(true);
  }

  async function save(input: WorkflowInput, id?: string) {
    setSaving(true);
    setError(null);
    try {
      if (id) {
        const workflow = await updateWorkflow(id, input);
        setDetail((prev) => (prev ? { ...prev, workflow } : prev));
        setEditing(workflow);
      } else {
        const workflow = await createWorkflow(input);
        setCreating(false);
        setEditing(workflow);
        setDetail({ workflow, runs: [] });
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save workflow.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(workflow: Workflow) {
    if (!window.confirm(`Delete workflow "${workflow.name}"? Definitions and run records will be removed.`)) return;
    setBusyId(workflow.id);
    try {
      await deleteWorkflow(workflow.id);
      if (detail?.workflow.id === workflow.id) { setDetail(null); setEditing(null); }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete workflow.");
    } finally {
      setBusyId(null);
    }
  }

  async function refreshDetail(id: string) {
    try {
      const data = await getWorkflow(id);
      setDetail(data);
      setEditing((prev) => (prev && prev.id === id ? data.workflow : prev));
      if (data.runs.every((r) => !ACTIVE_RUN.has(r.status))) void load();
    } catch {
      /* transient; the next poll retries */
    }
  }

  async function run(workflow: Workflow) {
    setBusyId(workflow.id);
    setError(null);
    try {
      await createWorkflowRun(workflow.id);
      if (editing?.id === workflow.id) {
        await refreshDetail(workflow.id);
      } else {
        await openDetail(workflow.id);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start workflow run.");
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = workflows.filter((w) => w.status === "active" && w.enabled).length;

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="relative overflow-hidden rounded-[24px] border border-border bg-[linear-gradient(145deg,rgba(20,18,45,0.92),rgba(8,10,23,0.96))] p-5 sm:p-6">
        <div className="halo -right-16 -top-20 h-60 w-60 bg-info/15" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-info">
              <Zap className="h-3.5 w-3.5" /> Automation engine
            </span>
            <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">
              Work<span className="text-gradient">flows</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
              Create n8n-style automation definitions: triggers, action nodes, conditions and external integrations. Definitions are stored in the database. Manual runs create real records; autonomous execution requires the workflow runner and approved integrations.
            </p>
          </div>
          <Button variant="primary" onClick={startCreate}><Plus className="h-4 w-4" /> New workflow</Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Workflows" value={String(workflows.length)} detail="Stored definitions" />
        <Metric label="Active" value={String(activeCount)} detail="Enabled + active status" tone="success" />
        <Metric label="Total runs" value={String(workflows.reduce((n, w) => n + (w.run_count || 0), 0))} detail="Recorded run attempts" tone="warning" />
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      {creating ? (
        <WorkflowEditor
          key="new"
          saving={saving}
          onCancel={() => setCreating(false)}
          onSave={(input) => save(input)}
        />
      ) : null}

      {editing && detail ? (
        <WorkflowEditor
          key={editing.id}
          workflow={editing}
          runs={detail.runs}
          saving={saving}
          busy={busyId === editing.id}
          onCancel={() => { setEditing(null); setDetail(null); }}
          onSave={(input) => save(input, editing.id)}
          onRun={() => run(editing)}
          onRefresh={() => refreshDetail(editing.id)}
          onDelete={() => remove(editing)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold text-foreground">Your workflows</h2>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search workflows</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-8 w-44 rounded-lg border border-border bg-surface pl-8 pr-2 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50" />
          </label>
          <Button variant="secondary" size="sm" onClick={() => { void load(); }} disabled={loading} aria-label="Refresh workflows"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
      </div>

      {loading && workflows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-6 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading workflows…</div>
      ) : workflows.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Zap className="mx-auto h-8 w-8 text-foreground-muted/50" />
          <p className="mt-3 text-[12px] text-foreground-secondary">No workflows yet.</p>
          <p className="mt-1 text-[10.5px] text-foreground-muted">Create one to define triggers, agent actions, conditions and external integrations.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={startCreate}><Plus className="h-3.5 w-3.5" /> Create workflow</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <article key={workflow.id} className="group rounded-xl border border-border bg-surface p-4 transition hover:border-border-strong hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(workflow.status)}>{workflow.status}</Badge>
                    {!workflow.enabled ? <Badge tone="neutral">disabled</Badge> : null}
                    <Badge tone="info">{workflow.trigger?.type ?? "manual"}</Badge>
                  </div>
                  <h3 className="mt-2 truncate text-[13px] font-semibold text-foreground">{workflow.name}</h3>
                  {workflow.description ? <p className="mt-1 line-clamp-2 text-[10.5px] text-foreground-secondary">{workflow.description}</p> : null}
                </div>
                {busyId === workflow.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Zap className="h-4 w-4 text-foreground-muted/40" />}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[9.5px] text-foreground-muted">
                <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{workflow.definition?.nodes?.length ?? 0} nodes</span>
                <span>{workflow.run_count ?? 0} runs</span>
                <span>Updated {formatRelative(workflow.updated_at)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
                <Button variant="secondary" size="sm" onClick={() => { void openDetail(workflow.id); }}><Pencil className="h-3 w-3" /> Edit</Button>
                <Button variant="secondary" size="sm" onClick={() => { void run(workflow); }} disabled={!workflow.enabled || busyId === workflow.id}><Play className="h-3 w-3" /> Run now</Button>
                <button type="button" onClick={() => { void remove(workflow); }} className="ml-auto grid h-7 w-7 place-items-center rounded-md text-foreground-muted hover:bg-error/10 hover:text-error" aria-label={`Delete ${workflow.name}`}><Trash2 className="h-3 w-3" /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-[10px] text-foreground-muted">
          Definitions and run records are stored in the database. &ldquo;Run now&rdquo; executes manual runs on the local workflow runner: model steps use the Model Gateway (local Ollama first), and each node records its real status and output. Schedules, webhooks and event triggers are saved but not firing yet. HTTP requests pause for an explicit approval bound to the exact request; in-app notifications are audited automatically. Blocked/unavailable nodes are never shown as done.
      </p>
    </div>
  );
}

function WorkflowEditor({
  workflow,
  runs = [],
  saving,
  busy,
  onCancel,
  onSave,
  onRun,
  onRefresh,
  onDelete,
}: {
  workflow?: Workflow;
  runs?: WorkflowRun[];
  saving: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSave: (input: WorkflowInput) => Promise<void>;
  onRun?: () => void;
  onRefresh?: () => void;
  onDelete?: () => void;
}) {
  const hasActiveRun = runs.some((r) => ACTIVE_RUN.has(r.status));
  useEffect(() => {
    if (!hasActiveRun || !onRefresh) return;
    const timer = window.setInterval(() => onRefresh(), 1500);
    return () => window.clearInterval(timer);
  }, [hasActiveRun, onRefresh]);

  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [status, setStatus] = useState<WorkflowStatus>(workflow?.status ?? "draft");
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [triggerType, setTriggerType] = useState(workflow?.trigger?.type ?? "manual");
  const [triggerConfig, setTriggerConfig] = useState(JSON.stringify(workflow?.trigger?.config ?? {}, null, 2));
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow?.definition?.nodes ?? defaultDefinition("manual").nodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(workflow?.definition?.edges ?? []);
  const [defJson, setDefJson] = useState(JSON.stringify(workflow?.definition ?? defaultDefinition("manual"), null, 2));
  const [jsonMode, setJsonMode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function syncJson(nextNodes = nodes, nextEdges = edges) {
    const def = { nodes: nextNodes, edges: nextEdges, version: 1 };
    setDefJson(JSON.stringify(def, null, 2));
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(defJson) as Workflow["definition"];
      const nextNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const nextEdges = Array.isArray(parsed?.edges) ? parsed.edges : [];
      setNodes(nextNodes);
      setEdges(nextEdges);
      setFormError(null);
    } catch {
      setFormError("Definition JSON is invalid.");
    }
  }

  function addNode() {
    const node: WorkflowNode = { id: nid(), type: "action.chat", label: "Model step", config: { model_role: "fast", prompt: "{{previous}}" } };
    const next = [...nodes, node];
    setNodes(next);
    syncJson(next, edges);
  }

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    const next = nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    setNodes(next);
    syncJson(next, edges);
  }

  function removeNode(id: string) {
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextEdges = edges.filter((e) => e.source !== id && e.target !== id);
    setNodes(nextNodes);
    setEdges(nextEdges);
    syncJson(nextNodes, nextEdges);
  }

  function addEdge() {
    if (nodes.length < 2) return;
    const source = nodes[nodes.length - 2]?.id ?? nodes[0].id;
    const target = nodes[nodes.length - 1]?.id ?? nodes[0].id;
    const next = [...edges, { id: eid(), source, target }];
    setEdges(next);
    syncJson(nodes, next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setFormError("Workflow name is required."); return; }
    let triggerCfg: Record<string, unknown> = {};
    try { triggerCfg = JSON.parse(triggerConfig || "{}") as Record<string, unknown>; } catch { setFormError("Trigger config must be valid JSON."); return; }
    let definition: Workflow["definition"];
    try {
      definition = jsonMode ? (JSON.parse(defJson) as Workflow["definition"]) : { nodes, edges, version: 1 };
    } catch { setFormError("Definition JSON is invalid."); return; }
    setFormError(null);
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      status,
      enabled,
      trigger: { type: triggerType, config: triggerCfg },
      definition,
    });
  }

  const TriggerIcon = TRIGGERS.find((t) => t.id === triggerType)?.icon ?? Zap;

  return (
    <Card className="border-info/25">
      <CardHeader
        title={workflow ? `Edit workflow` : "Create workflow"}
        description="Define a real automation graph. Node execution/integrations are wired incrementally; runs are recorded honestly."
        icon={<Zap className="h-3.5 w-3.5" />}
        actions={<Button variant="ghost" size="sm" onClick={onCancel} aria-label="Close editor"><X className="h-4 w-4" /></Button>}
      />
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Name" className="md:col-span-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="e.g. Morning briefing" className={inputClass} /></Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as WorkflowStatus)} className={inputClass}>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            </Field>
            <Field label="Enabled">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-inset px-2.5 text-[11px] text-foreground">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {enabled ? "Enabled" : "Disabled"}
              </label>
            </Field>
            <Field label="Description" className="md:col-span-2 xl:col-span-4"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={8000} placeholder="What this workflow does, what data it uses, and what approvals it needs." className={cn(inputClass, "h-auto min-h-16 py-2")} /></Field>
          </div>

          <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-inset/40 p-3">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground"><TriggerIcon className="h-3.5 w-3.5 text-info" /> Trigger</h3>
              <Field label="Type">
                <select value={triggerType} onChange={(e) => { setTriggerType(e.target.value); const next = [...nodes]; if (next[0]?.id === "trigger" || next[0]?.type.startsWith("trigger.")) next[0] = { ...next[0], type: `trigger.${e.target.value}`, label: TRIGGERS.find(t=>t.id===e.target.value)?.label ?? "Trigger" }; else next.unshift({ id: "trigger", type: `trigger.${e.target.value}`, label: "Trigger", config: {} }); setNodes(next); syncJson(next, edges); }} className={inputClass}>
                  {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
              <p className="text-[9.5px] text-foreground-muted">{TRIGGERS.find((t) => t.id === triggerType)?.help}</p>
              <Field label="Trigger config (JSON)">
                <textarea value={triggerConfig} onChange={(e) => setTriggerConfig(e.target.value)} rows={5} className={cn(inputClass, "h-auto font-mono text-[10px]")} spellCheck={false} />
              </Field>
            </div>

            <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-inset/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground"><GitBranch className="h-3.5 w-3.5 text-primary" /> Nodes & connections</h3>
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" type="button" onClick={addNode}><Plus className="h-3 w-3" /> Node</Button>
                  <Button variant="secondary" size="sm" type="button" onClick={addEdge} disabled={nodes.length < 2}><ArrowRight className="h-3 w-3" /> Edge</Button>
                  <Button variant={jsonMode ? "primary" : "secondary"} size="sm" type="button" onClick={() => { if (jsonMode) applyJson(); setJsonMode(!jsonMode); }}><Braces className="h-3 w-3" /> JSON</Button>
                </div>
              </div>

              {jsonMode ? (
                <Field label="Definition JSON">
                  <textarea value={defJson} onChange={(e) => setDefJson(e.target.value)} rows={14} className={cn(inputClass, "h-auto font-mono text-[10px]")} spellCheck={false} />
                </Field>
              ) : (
                <>
                  <div className="space-y-2">
                    {nodes.map((node, i) => (
                      <div key={node.id} className="rounded-lg border border-border bg-surface p-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-1 font-mono text-[9px] text-foreground-muted">{i + 1}</span>
                          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                            <input value={node.label} onChange={(e) => updateNode(node.id, { label: e.target.value })} placeholder="Label" className={cn(inputClass, "h-8")} />
                            <select value={node.type} onChange={(e) => updateNode(node.id, { type: e.target.value })} className={cn(inputClass, "h-8")}>{NODE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                            <textarea value={JSON.stringify(node.config ?? {}, null, 0)} onChange={(e) => { try { updateNode(node.id, { config: JSON.parse(e.target.value) as Record<string, unknown> }); } catch { /* keep typing */ } }} rows={2} spellCheck={false} placeholder='{"key":"value"}' className={cn(inputClass, "h-auto font-mono text-[10px] sm:col-span-2")} />
                          </div>
                          <button type="button" onClick={() => removeNode(node.id)} className="grid h-7 w-7 place-items-center rounded-md text-foreground-muted hover:bg-error/10 hover:text-error" aria-label={`Remove node ${node.label}`}><X className="h-3.5 w-3.5" /></button>
                        </div>
                        <p className="mt-1 pl-5 font-mono text-[8.5px] text-foreground-muted">{node.id}</p>
                      </div>
                    ))}
                    {nodes.length === 0 ? <p className="py-6 text-center text-[10px] text-foreground-muted">Add a trigger or action node.</p> : null}
                  </div>
                  {edges.length ? (
                    <div className="space-y-1">
                      <p className="text-[9.5px] font-medium uppercase tracking-wide text-foreground-muted">Edges</p>
                      {edges.map((edge) => (
                        <div key={edge.id} className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-[10px]">
                          <select value={edge.source} onChange={(e) => { const next = edges.map(x=>x.id===edge.id?{...x,source:e.target.value}:x); setEdges(next); syncJson(nodes,next); }} className="min-w-0 flex-1 rounded bg-transparent text-foreground outline-none">{nodes.map(n => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}</select>
                          <ArrowRight className="h-3 w-3 shrink-0 text-foreground-muted" />
                          <select value={edge.target} onChange={(e) => { const next = edges.map(x=>x.id===edge.id?{...x,target:e.target.value}:x); setEdges(next); syncJson(nodes,next); }} className="min-w-0 flex-1 rounded bg-transparent text-foreground outline-none">{nodes.map(n => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}</select>
                          <select value={edge.label ?? ""} onChange={(e) => { const next = edges.map(x=>x.id===edge.id?{...x,label:e.target.value || undefined}:x); setEdges(next); syncJson(nodes,next); }} aria-label="Edge label" className="w-20 rounded bg-transparent text-[9.5px] text-foreground-secondary outline-none"><option value="">always</option><option value="true">if true</option><option value="false">if false</option></select>
                          <button type="button" onClick={() => { const next = edges.filter(x=>x.id!==edge.id); setEdges(next); syncJson(nodes,next); }} className="text-foreground-muted hover:text-error" aria-label="Remove edge"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {formError ? <p className="text-[11px] text-error">{formError}</p> : null}
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            {workflow && onRun ? <Button variant="secondary" type="button" onClick={onRun} disabled={busy || !workflow.enabled}><Play className="h-3.5 w-3.5" /> Run now</Button> : null}
            {workflow && onDelete ? <Button variant="outline" type="button" onClick={onDelete} className="text-error hover:border-error/40"><Trash2 className="h-3.5 w-3.5" /> Delete</Button> : null}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{workflow ? "Save workflow" : "Create workflow"}</Button>
            </div>
          </div>
        </form>

        {runs.length ? (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <h4 className="text-[11px] font-semibold text-foreground">Recent run records</h4>
            <div className="mt-2 space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-border-subtle bg-surface-inset/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                    <span className="text-[9.5px] text-foreground-muted">{run.triggered_by} · {formatRelative(run.created_at)}</span>
                    <span className="font-mono text-[8.5px] text-foreground-muted">{run.id.slice(0, 8)}</span>
                    {run.status === "awaiting_approval" ? <Link href="/approvals" className="text-[10px] text-info hover:underline">Review approval</Link> : null}
                  </div>
                  {run.error ? <p className="mt-1 text-[10px] text-error">{run.error}</p> : null}
                  {runNodes(run).length ? (
                    <ol className="mt-2 space-y-1">
                      {runNodes(run).map((node) => (
                        <li key={node.id} className="rounded-md bg-surface px-2 py-1.5 text-[10px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={statusTone(node.status)}>{node.status}</Badge>
                            <span className="font-medium text-foreground">{node.label}</span>
                            <span className="font-mono text-[8.5px] text-foreground-muted">{node.type}</span>
                            {node.output?.offline ? <Badge tone="warning">offline model</Badge> : null}
                            {node.status === "awaiting_approval" ? <Link href="/approvals" className="text-[9.5px] text-info hover:underline">Review approval</Link> : null}
                          </div>
                          {node.output?.text ? <p className="mt-1 whitespace-pre-wrap text-foreground-secondary">{String(node.output.text).slice(0, 600)}</p> : null}
                          {node.error ? <p className="mt-1 text-error">{node.error}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {run.log ? <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-surface-inset/60 p-2 font-mono text-[9px] text-foreground-muted">{run.log}</pre> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "warning" | "success" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground-muted";
  return (
    <Card><CardContent className="p-3">
      <p className={cn("text-[10px] font-medium", color)}>{label}</p>
      <p className="mt-1 font-mono text-[22px] font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[9.5px] text-foreground-muted">{detail}</p>
    </CardContent></Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="block text-[9.5px] font-medium uppercase tracking-wide text-foreground-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50";
