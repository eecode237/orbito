"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import { API_URL, apiSend, getScrapingJob, getScrapingJobs } from "@/lib/api";
import type { ScrapingJob, ScrapingResult } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const templates: Record<string, { label: string; value: Record<string, unknown> }> = {
  auto: { label: "Auto detect", value: {} },
  products: {
    label: "Products",
    value: {
      name: { selector: "h1" },
      price: { selector: ".price, [data-price]", attribute: "text" },
      description: { selector: '[name="description"]', attribute: "content" },
      image: { selector: "img", attribute: "src" },
    },
  },
  articles: {
    label: "Articles",
    value: {
      title: { selector: "h1" },
      author: { selector: '[rel="author"], .author' },
      summary: { selector: '[name="description"]', attribute: "content" },
      body: { selector: "article" },
    },
  },
  jobs: {
    label: "Jobs",
    value: {
      title: { selector: "h1, .job-title" },
      company: { selector: ".company, [data-company]" },
      location: { selector: ".location" },
      apply: { selector: "a[href*='apply']", attribute: "href" },
    },
  },
};

function cell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.slice(0, 3).map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value).slice(0, 120);
  const text = String(value);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "completed"
      ? "border-mint/25 bg-mint/10 text-mint"
      : status === "failed"
        ? "border-rose/25 bg-rose/10 text-rose"
        : "border-violet/25 bg-violet/10 text-violet-soft";
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        style,
      )}
    >
      {status}
    </span>
  );
}

export function ScrapingStudio() {
  const [urls, setUrls] = useState("");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("auto");
  const [schemaText, setSchemaText] = useState("{}");
  const [depth, setDepth] = useState(0);
  const [maxPages, setMaxPages] = useState(10);
  const [followLinks, setFollowLinks] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ScrapingJob | null>(null);
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [recent, setRecent] = useState<ScrapingJob[]>([]);

  useEffect(() => {
    getScrapingJobs()
      .then((data) => setRecent(data.jobs))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const data = await getScrapingJob(jobId as string);
        if (!alive) return;
        setJob(data.job);
        setResults(data.results);
        if (data.job.status === "queued" || data.job.status === "running") {
          timer = setTimeout(tick, 1200);
        } else {
          getScrapingJobs()
            .then((list) => {
              if (alive) setRecent(list.jobs);
            })
            .catch(() => undefined);
        }
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    }

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  function chooseTemplate(key: string) {
    setTemplate(key);
    setSchemaText(JSON.stringify(templates[key].value, null, 2));
  }

  async function startJob(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const list = urls
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError("Add at least one URL.");
      return;
    }

    let schema: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(schemaText || "{}");
      if (parsed && typeof parsed === "object") schema = parsed as Record<string, unknown>;
    } catch {
      setError("The extraction schema is not valid JSON.");
      return;
    }

    setCreating(true);
    try {
      const created = await apiSend<{ id: string }>("/api/v1/scraping/jobs", "POST", {
        name: name.trim() || undefined,
        urls: list,
        schema,
        config: {
          depth: Number(depth) || 0,
          max_pages: Number(maxPages) || 10,
          follow_links: followLinks,
        },
      });
      setJobId(created.id);
      setJob(null);
      setResults([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const columns = useMemo(() => {
    const keys: string[] = [];
    for (const result of results) {
      for (const key of Object.keys(result.data ?? {})) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
    return keys.slice(0, 7);
  }, [results]);

  const running = job && (job.status === "queued" || job.status === "running");

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={startJob} className="glass h-fit rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[14px] font-semibold text-white/90">New crawl</h2>
          <span className="rounded-md border border-mint/20 bg-mint/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wide text-mint/80">
            HTTP engine
          </span>
        </div>

        <label className="mt-4 block">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">Target URLs</span>
          <textarea
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            rows={4}
            placeholder={"https://example.com/products\nhttps://example.com/pricing"}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[12px] leading-relaxed text-white/80 outline-none transition placeholder:text-white/20 focus:border-violet/45"
          />
          <span className="mt-1 block text-[9.5px] text-white/22">
            One per line. Public http(s) only — private ranges and metadata endpoints are blocked.
          </span>
        </label>

        <label className="mt-3 block">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">
            Job name <span className="normal-case tracking-normal text-white/20">optional</span>
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Competitor pricing — Nov"
            className="mt-1.5 h-9 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-[12px] text-white/80 outline-none transition placeholder:text-white/20 focus:border-violet/45"
          />
        </label>

        <div className="mt-3">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">
            Extraction schema
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(templates).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseTemplate(key)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[9.5px] transition",
                  template === key
                    ? "border-violet/40 bg-violet/15 text-violet-soft"
                    : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/70",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <textarea
            value={schemaText}
            onChange={(event) => setSchemaText(event.target.value)}
            rows={7}
            spellCheck={false}
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#070510] px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-mint/75 outline-none transition focus:border-violet/45"
          />
          <span className="mt-1 block text-[9.5px] text-white/22">
            CSS selectors per field. Use{" "}
            <code className="text-white/40">{`{"attribute":"href"}`}</code> for attributes,{" "}
            <code className="text-white/40">{`{"multiple":true}`}</code> for lists.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAdvanced((value) => !value)}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10.5px] text-white/40 transition hover:text-white/70"
        >
          Crawl settings
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advanced && "rotate-180")} />
        </button>

        {advanced ? (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <label className="block">
              <span className="text-[9.5px] text-white/35">Depth</span>
              <input
                type="number"
                min={0}
                max={3}
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
                className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-white/75 outline-none focus:border-violet/40"
              />
            </label>
            <label className="block">
              <span className="text-[9.5px] text-white/35">Max pages</span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxPages}
                onChange={(event) => setMaxPages(Number(event.target.value))}
                className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-white/75 outline-none focus:border-violet/40"
              />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-[10px] text-white/45">
              <input
                type="checkbox"
                checked={followLinks}
                onChange={(event) => setFollowLinks(event.target.checked)}
                className="h-3.5 w-3.5 accent-[#7c5cff]"
              />
              Follow same-origin links up to the depth limit
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg border border-rose/25 bg-rose/[0.06] px-3 py-2 text-[10.5px] text-rose/90">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={creating || Boolean(running)}
          className="focus-ring mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet text-[12.5px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(124,92,255,1)] transition hover:bg-[#8b6dff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating || running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {running ? "Crawling…" : "Starting…"}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" /> Start crawl
            </>
          )}
        </button>

        <p className="mt-3 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-white/22">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-mint/50" />
          Respect robots.txt and site terms. ORBITO does not bypass logins, CAPTCHAs or paywalls.
        </p>
      </form>

      <div className="space-y-4">
        {job ? (
          <div className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-[14px] font-semibold text-white/90">
                    {job.name}
                  </h2>
                  <StatusPill status={job.status} />
                </div>
                <p className="mt-1 text-[10px] text-white/30">
                  {job.pages_done} page{job.pages_done === 1 ? "" : "s"} parsed · started{" "}
                  {formatRelative(job.created_at)}
                </p>
              </div>
              <div className="flex gap-1.5">
                <a
                  href={`${API_URL}/api/v1/scraping/jobs/${job.id}/export?format=csv`}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/50 transition hover:border-white/20 hover:text-white/80"
                >
                  <ArrowDownToLine className="h-3 w-3" /> CSV
                </a>
                <a
                  href={`${API_URL}/api/v1/scraping/jobs/${job.id}/export?format=json`}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/50 transition hover:border-white/20 hover:text-white/80"
                >
                  <ArrowDownToLine className="h-3 w-3" /> JSON
                </a>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  job.status === "failed"
                    ? "bg-rose"
                    : "bg-gradient-to-r from-violet via-violet-soft to-mint",
                )}
                style={{ width: `${Math.max(2, job.progress)}%` }}
              />
            </div>
            {job.error ? (
              <p className="mt-2 text-[10px] leading-relaxed text-rose/70">{job.error}</p>
            ) : null}
          </div>
        ) : (
          <div className="glass grid min-h-[240px] place-items-center rounded-2xl p-6 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-mint/20 bg-mint/[0.06]">
                <Globe2 className="h-5 w-5 text-mint" />
              </span>
              <h2 className="mt-3 font-display text-[15px] font-semibold text-white/85">
                Ready to crawl
              </h2>
              <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-white/30">
                Paste one or more public pages, choose an extraction schema, and ORBITO returns
                structured rows with exports.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[9.5px] text-white/25">
                <span className="rounded-md border border-white/[0.06] px-2 py-1">SSRF guard</span>
                <span className="rounded-md border border-white/[0.06] px-2 py-1">
                  CSS schemas
                </span>
                <span className="rounded-md border border-white/[0.06] px-2 py-1">
                  Same-origin depth
                </span>
                <span className="rounded-md border border-white/[0.06] px-2 py-1">CSV / JSON</span>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 ? (
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <h3 className="text-[11.5px] font-medium text-white/70">
                {results.length} structured record{results.length === 1 ? "" : "s"}
              </h3>
              <span className="text-[9.5px] text-white/25">Preview · first 500 rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-[0.14em] text-white/25">
                    <th className="px-3 py-2 font-medium">Source</th>
                    {columns.map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr
                      key={`${result.url}-${index}`}
                      className="border-b border-white/[0.03] text-[10.5px] text-white/55 transition hover:bg-white/[0.02]"
                    >
                      <td className="max-w-[220px] px-3 py-2">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block truncate text-violet-soft/70 hover:text-violet-soft"
                        >
                          {result.url}
                        </a>
                      </td>
                      {columns.map((column) => (
                        <td key={column} className="max-w-[220px] px-3 py-2 align-top">
                          <span className="line-clamp-3">{cell(result.data?.[column])}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11.5px] font-medium text-white/70">Recent jobs</h3>
            <span className="text-[9.5px] text-white/22">{recent.length} total</span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-[10.5px] text-white/25">
              No crawls yet. Your first job will appear here.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-white/[0.04]">
              {recent.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setJobId(item.id);
                    setJob(null);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-2 py-2 text-left transition hover:opacity-80"
                >
                  {item.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-mint" />
                  ) : item.status === "failed" ? (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-soft" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-white/55">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[9px] text-white/22">
                    {item.pages_done} pages · {formatRelative(item.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!job ? (
          <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-soft/60" />
            <p className="text-[9.5px] leading-relaxed text-white/25">
              JavaScript-heavy sites need browser rendering. Playwright lands in Phase 4; the
              current HTTP engine handles static HTML and most server-rendered pages.
            </p>
          </div>
        ) : null}

      </div>
    </div>
  );
}
