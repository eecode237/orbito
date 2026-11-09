"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  ExternalLink,
  Loader2,
  ListTodo,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import {
  createProjectTask,
  deleteProjectTask,
  getProjectTaskBoard,
  updateProjectTask,
  type ProjectTaskInput,
} from "@/lib/api";
import type { ProjectTask, ProjectTaskBoard, ProjectTaskPriority, ProjectTaskStatus } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const STATUSES: { id: ProjectTaskStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "text-foreground-muted" },
  { id: "todo", label: "To do", color: "text-info" },
  { id: "in_progress", label: "In progress", color: "text-primary" },
  { id: "blocked", label: "Blocked", color: "text-warning" },
  { id: "done", label: "Done", color: "text-success" },
];

const PRIORITIES: { id: ProjectTaskPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

const EMPTY_ITEMS: ProjectTask[] = [];

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, amount: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })
    .format(new Date(year, month - 1, day));
}

function priorityTone(priority: ProjectTaskPriority): "neutral" | "info" | "warning" | "error" {
  if (priority === "urgent") return "error";
  if (priority === "high") return "warning";
  if (priority === "normal") return "info";
  return "neutral";
}

export function TaskManager() {
  const [board, setBoard] = useState<ProjectTaskBoard | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const loadBoard = useCallback(async (dateOverride?: string) => {
    const date = dateOverride || targetDate || localDate(new Date());
    setLoading(true);
    try {
      const data = await getProjectTaskBoard(date, query);
      setBoard(data);
      setTargetDate(date);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the project task board.");
    } finally {
      setLoading(false);
    }
  }, [query, targetDate]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => { void loadBoard(); }, 0);
    return () => window.clearTimeout(kickoff);
  }, [loadBoard]);

  const items = board?.items ?? EMPTY_ITEMS;
  const tomorrow = board?.tomorrow ?? (targetDate ? shiftDate(targetDate, 1) : "");
  const tomorrowItems = useMemo(
    () => items.filter((item) => item.scheduled_for === tomorrow && item.status !== "done"),
    [items, tomorrow],
  );
  const activeCount = items.filter((item) => item.status === "in_progress").length;
  const doneCount = items.filter((item) => item.status === "done").length;
  const backlogCount = items.filter((item) => item.status === "backlog").length;

  function openCreate(date?: string) {
    setEditing(null);
    setFormOpen(true);
    if (date) {
      setFormDefaultDate(date);
    } else {
      setFormDefaultDate("");
    }
  }

  const [formDefaultDate, setFormDefaultDate] = useState("");

  function openEdit(item: ProjectTask) {
    setEditing(item);
    setFormDefaultDate(item.scheduled_for ?? "");
    setFormOpen(true);
  }

  async function saveItem(input: ProjectTaskInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateProjectTask(editing.id, input);
      } else {
        await createProjectTask(input);
      }
      setFormOpen(false);
      setEditing(null);
      await loadBoard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this task.");
    } finally {
      setSaving(false);
    }
  }

  async function moveItem(item: ProjectTask, status: ProjectTaskStatus) {
    if (item.status === status || busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await updateProjectTask(item.id, { status });
      await loadBoard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update task status.");
    } finally {
      setBusyId(null);
      setDraggedId(null);
    }
  }

  async function removeItem(item: ProjectTask) {
    if (!window.confirm(`Delete ${item.key} — ${item.title}? Its execution history will remain in Activity.`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteProjectTask(item.id);
      await loadBoard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this task.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="relative overflow-hidden rounded-[24px] border border-border bg-[linear-gradient(145deg,rgba(26,19,48,0.92),rgba(8,10,23,0.96))] p-5 sm:p-6">
        <div className="halo -right-12 -top-20 h-60 w-60 bg-primary/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-hover">
              <ListTodo className="h-3.5 w-3.5" /> Personal work system
            </span>
            <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">
              Task <span className="text-gradient">Manager</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
              Plan your backlog, decide what to do tomorrow, and track what is active or complete. Project tasks stay separate from ORBITO&apos;s execution logs, but each run can be linked back here.
            </p>
          </div>
          <Button variant="primary" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Backlog" value={String(backlogCount)} detail="Unstarted project work" />
        <Metric label="In progress" value={String(activeCount)} detail="Tracked project items" tone="primary" />
        <Metric label="Tomorrow" value={String(board?.counts.scheduled_tomorrow ?? 0)} detail={tomorrow ? displayDate(tomorrow) : "Next-day plan"} tone="warning" />
        <Metric label="Completed" value={String(doneCount)} detail="Project items marked done" tone="success" />
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      {formOpen ? (
        <TaskForm
          key={editing?.id ?? `new-${formDefaultDate}`}
          item={editing}
          defaultDate={formDefaultDate}
          saving={saving}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
          onSave={saveItem}
        />
      ) : null}

      <Card>
        <CardHeader
          title="Plan tomorrow"
          description={tomorrow ? `Your next-day plan for ${displayDate(tomorrow)}. Schedule items here; unscheduled work stays in the backlog.` : "Choose a planning date to build tomorrow's list."}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          actions={tomorrow ? <Button variant="secondary" size="sm" onClick={() => openCreate(tomorrow)}><Plus className="h-3.5 w-3.5" /> Add to plan</Button> : null}
        />
        <CardContent>
          {loading && !board ? (
            <div className="flex items-center gap-2 py-4 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading your plan…</div>
          ) : tomorrowItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <p className="text-[12px] text-foreground-secondary">Nothing scheduled for tomorrow yet.</p>
              <p className="mt-1 text-[10.5px] text-foreground-muted">Use “Add to plan” to create a task, or edit a backlog card and set its schedule.</p>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {tomorrowItems.map((item) => <CompactTask key={item.id} item={item} onEdit={openEdit} onMove={moveItem} busy={busyId === item.id} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-foreground">Project board</h2>
          <p className="mt-0.5 text-[10.5px] text-foreground-muted">Move cards between columns; drag-and-drop or use the status menu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search tasks</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks"
              className="h-8 w-44 rounded-lg border border-border bg-surface pl-8 pr-2 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
            />
          </label>
          <label className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[10px] text-foreground-muted">
            Plan date
            <input
              type="date"
              value={targetDate}
              onChange={(event) => { setTargetDate(event.target.value); void loadBoard(event.target.value); }}
              className="bg-transparent text-[11px] text-foreground outline-none"
            />
          </label>
          <Button variant="secondary" size="sm" onClick={() => { void loadBoard(); }} disabled={loading} aria-label="Refresh task board">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {board?.truncated ? (
        <p className="text-[10px] text-warning">Showing the first {board.limit} of {board.total} tasks. Search to narrow the board.</p>
      ) : null}

      {loading && !board ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-6 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading board…</div>
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-2 2xl:grid-cols-5">
          {STATUSES.map((status) => {
            const columnItems = items.filter((item) => item.status === status.id);
            return (
              <section
                key={status.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const item = items.find((candidate) => candidate.id === draggedId);
                  if (item) void moveItem(item, status.id);
                }}
                className={cn("min-h-[240px] min-w-[240px] rounded-xl border border-border-subtle bg-surface-inset/60 p-2", draggedId && "border-primary/30")}
              >
                <div className="flex items-center justify-between px-1.5 py-1.5">
                  <h3 className={cn("text-[11px] font-semibold", status.color)}>{status.label}</h3>
                  <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9px] text-foreground-muted">{columnItems.length}</span>
                </div>
                <div className="space-y-2">
                  {columnItems.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      onEdit={openEdit}
                      onDelete={removeItem}
                      onMove={moveItem}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", item.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedId(item.id);
                      }}
                      busy={busyId === item.id}
                    />
                  ))}
                  {columnItems.length === 0 ? <p className="px-2 py-8 text-center text-[10px] text-foreground-muted">Drop a task here</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-foreground-muted">
        Project tasks are stored in the database. ORBITO&apos;s agent runs remain in Activity/Agent Monitor; running a card in Chat links its execution ID here. Mark work done only when the actual work is complete.
      </p>
    </div>
  );
}

function TaskForm({
  item,
  defaultDate,
  saving,
  onCancel,
  onSave,
}: {
  item: ProjectTask | null;
  defaultDate: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: ProjectTaskInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [status, setStatus] = useState<ProjectTaskStatus>(item?.status ?? (defaultDate ? "todo" : "backlog"));
  const [priority, setPriority] = useState<ProjectTaskPriority>(item?.priority ?? "normal");
  const [scheduledFor, setScheduledFor] = useState(item?.scheduled_for ?? defaultDate);
  const [dueDate, setDueDate] = useState(item?.due_date ?? "");
  const [estimate, setEstimate] = useState(item?.estimate_minutes?.toString() ?? "");
  const [labels, setLabels] = useState(item?.labels.join(", ") ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setFormError("Add a task title first.");
      return;
    }
    setFormError(null);
    await onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      scheduled_for: scheduledFor || null,
      due_date: dueDate || null,
      estimate_minutes: estimate ? Number(estimate) : null,
      labels: labels.split(",").map((label) => label.trim()).filter(Boolean),
    });
  }

  return (
    <Card className="border-primary/25">
      <CardHeader title={item ? `Edit ${item.key}` : "Create a project task"} description="Plan actual work. This does not create a fake agent run." icon={<Plus className="h-3.5 w-3.5" />} actions={<Button variant="ghost" size="sm" onClick={onCancel} aria-label="Close form"><X className="h-4 w-4" /></Button>} />
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Title" className="md:col-span-2 xl:col-span-2">
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} placeholder="e.g. Add task board and tomorrow plan" className={inputClass} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectTaskStatus)} className={inputClass}>
              {STATUSES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(event) => setPriority(event.target.value as ProjectTaskPriority)} className={inputClass}>
              {PRIORITIES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Schedule for">
            <input type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Due date">
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Estimate (minutes)">
            <input type="number" min={0} max={100000} value={estimate} onChange={(event) => setEstimate(event.target.value)} placeholder="Optional" className={inputClass} />
          </Field>
          <Field label="Labels (comma-separated)">
            <input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="jarvis, coding" className={inputClass} />
          </Field>
          <Field label="Description" className="md:col-span-2 xl:col-span-4">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={12000} rows={3} placeholder="Context, expected result, or notes for ORBITO…" className={cn(inputClass, "h-auto min-h-20 py-2")} />
          </Field>
          {formError ? <p className="text-[11px] text-error md:col-span-2 xl:col-span-4">{formError}</p> : null}
          <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4">
            <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{item ? "Save changes" : "Create task"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TaskCard({
  item,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  busy,
}: {
  item: ProjectTask;
  onEdit: (item: ProjectTask) => void;
  onDelete: (item: ProjectTask) => void;
  onMove: (item: ProjectTask, status: ProjectTaskStatus) => void;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  busy: boolean;
}) {
  const chatQuery = `Work on ${item.key}: ${item.title}${item.description ? `\n\nContext:\n${item.description}` : ""}`;
  return (
    <article
      draggable
      onDragStart={onDragStart}
      className="group rounded-lg border border-border bg-surface p-3 shadow-sm transition hover:border-border-strong hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 cursor-grab font-mono text-[9px] text-foreground-muted active:cursor-grabbing" title="Drag to move">⠿</span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] text-foreground-muted">{item.key}</p>
          <h4 className="mt-0.5 break-words text-[11.5px] font-semibold leading-snug text-foreground">{item.title}</h4>
        </div>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : null}
      </div>
      {item.description ? <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-foreground-secondary">{item.description}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
        {item.scheduled_for ? <Badge tone="neutral"><CalendarDays className="mr-1 h-2.5 w-2.5" />{displayDate(item.scheduled_for)}</Badge> : null}
        {item.estimate_minutes != null ? <Badge tone="neutral"><Clock3 className="mr-1 h-2.5 w-2.5" />{item.estimate_minutes}m</Badge> : null}
      </div>
      {item.labels.length ? <div className="mt-1.5 flex flex-wrap gap-1">{item.labels.map((label) => <span key={label} className="rounded bg-surface-inset px-1.5 py-0.5 text-[9px] text-foreground-muted">{label}</span>)}</div> : null}
      {item.execution_task_id ? (
        <Link href={`/agents/monitor?task=${encodeURIComponent(item.execution_task_id)}`} className="mt-2 inline-flex items-center gap-1 text-[9.5px] text-info hover:underline">
          <Zap className="h-3 w-3" /> Latest run: {item.execution_status ?? "status unavailable"} <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2">
        {item.status !== "done" ? (
          <Link
            href={`/chat?q=${encodeURIComponent(chatQuery)}&project_task=${encodeURIComponent(item.id)}`}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-[9.5px] font-medium text-primary-hover transition hover:bg-primary/20"
          >
            <Zap className="h-3 w-3" /> Run with ORBITO
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9.5px] text-success"><CircleCheck className="h-3 w-3" /> Completed</span>
        )}
        <select
          value={item.status}
          onChange={(event) => onMove(item, event.target.value as ProjectTaskStatus)}
          aria-label={`Move ${item.key} to status`}
          className="h-7 min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-inset px-1.5 text-[9px] text-foreground-secondary outline-none"
        >
          {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
        </select>
        <button type="button" onClick={() => onEdit(item)} className="grid h-7 w-7 place-items-center rounded-md text-foreground-muted transition hover:bg-foreground/5 hover:text-foreground" title="Edit task" aria-label={`Edit ${item.key}`}><Pencil className="h-3 w-3" /></button>
        <button type="button" onClick={() => onDelete(item)} className="grid h-7 w-7 place-items-center rounded-md text-foreground-muted transition hover:bg-error/10 hover:text-error" title="Delete task" aria-label={`Delete ${item.key}`}><Trash2 className="h-3 w-3" /></button>
      </div>
      <p className="mt-1 text-right text-[8.5px] text-foreground-muted">Updated {formatRelative(item.updated_at)}</p>
    </article>
  );
}

function CompactTask({ item, onEdit, onMove, busy }: { item: ProjectTask; onEdit: (item: ProjectTask) => void; onMove: (item: ProjectTask, status: ProjectTaskStatus) => void; busy: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-inset/50 p-3">
      {busy ? <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-primary" /> : <CalendarDays className="mt-0.5 h-3.5 w-3.5 text-warning" />}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] text-foreground-muted">{item.key} · {item.priority}</p>
        <p className="mt-0.5 text-[11px] font-medium text-foreground">{item.title}</p>
        {item.description ? <p className="mt-0.5 line-clamp-2 text-[10px] text-foreground-secondary">{item.description}</p> : null}
      </div>
      <div className="flex items-center gap-1">
        <select value={item.status} onChange={(event) => onMove(item, event.target.value as ProjectTaskStatus)} aria-label={`Tomorrow task ${item.key} status`} className="h-7 max-w-24 rounded-md border border-border bg-surface px-1 text-[9px] text-foreground">
          {STATUSES.filter((status) => status.id !== "done").map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
        </select>
        <button type="button" onClick={() => onEdit(item)} className="grid h-7 w-7 place-items-center rounded-md text-foreground-muted hover:bg-foreground/5 hover:text-foreground" aria-label={`Edit ${item.key}`}><Pencil className="h-3 w-3" /></button>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "primary" | "warning" | "success" }) {
  const color = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground-muted";
  return (
    <Card>
      <CardContent className="p-3">
        <p className={cn("text-[10px] font-medium", color)}>{label}</p>
        <p className="mt-1 font-mono text-[22px] font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-[9.5px] text-foreground-muted">{detail}</p>
      </CardContent>
    </Card>
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

const inputClass = "h-9 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50";
