"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, CircleAlert, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { createApplication, deleteApplication, getApplications, updateApplication } from "@/lib/api";
import type { ApplicationStatus, JobApplication } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const COLUMNS: { id: ApplicationStatus; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
];

const inputClass = "h-9 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50";

export function JobsView() {
  const [items, setItems] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getApplications();
      setItems(data.applications);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !role.trim()) {
      setError("Company and role are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createApplication({ company: company.trim(), role: role.trim(), url: url.trim() || null });
      setCompany("");
      setRole("");
      setUrl("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add application.");
    } finally {
      setSaving(false);
    }
  }

  async function move(item: JobApplication, status: ApplicationStatus) {
    try {
      await updateApplication(item.id, { status });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update status.");
    }
  }

  async function remove(item: JobApplication) {
    if (!window.confirm(`Remove ${item.role} at ${item.company} from the tracker? This does not affect the employer.`)) return;
    try {
      await deleteApplication(item.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove application.");
    }
  }

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-success">
          <Briefcase className="h-3.5 w-3.5" /> Application tracker
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Jobs</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Track where you applied and where each application stands. ORBITO records your entries here; it does not submit applications to employers.
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Add application" icon={<Plus className="h-3.5 w-3.5" />} />
        <CardContent>
          <form onSubmit={add} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" maxLength={200} className={inputClass} />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" maxLength={200} className={inputClass} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Posting URL (optional)" maxLength={1000} className={inputClass} />
            <Button variant="primary" type="submit" disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add</Button>
          </form>
        </CardContent>
      </Card>

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-3 2xl:grid-cols-6">
          {COLUMNS.map((column) => {
            const rows = items.filter((item) => item.status === column.id);
            return (
              <section key={column.id} className="min-h-[160px] min-w-[200px] rounded-xl border border-border-subtle bg-surface-inset/60 p-2">
                <div className="flex items-center justify-between px-1.5 py-1.5">
                  <h3 className="text-[11px] font-semibold text-foreground-secondary">{column.label}</h3>
                  <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9px] text-foreground-muted">{rows.length}</span>
                </div>
                <div className="space-y-2">
                  {rows.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-surface p-2.5">
                      <p className="text-[11.5px] font-semibold text-foreground">{item.role}</p>
                      <p className="text-[10.5px] text-foreground-secondary">{item.company}</p>
                      {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[9.5px] text-info hover:underline">{item.url}</a> : null}
                      <p className="mt-1 text-[9px] text-foreground-muted">Updated {formatRelative(item.updated_at)}</p>
                      <div className="mt-2 flex items-center gap-1">
                        <select value={item.status} onChange={(e) => { void move(item, e.target.value as ApplicationStatus); }} aria-label={`Status for ${item.role}`} className="h-7 min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-inset px-1 text-[9px] text-foreground-secondary outline-none">
                          {COLUMNS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                        <button type="button" onClick={() => { void remove(item); }} className={cn("grid h-7 w-7 place-items-center rounded-md text-foreground-muted hover:bg-error/10 hover:text-error")} aria-label={`Remove ${item.role} at ${item.company}`}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={() => { void load(); }}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
    </div>
  );
}
