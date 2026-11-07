"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Lock,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  getWorkspaceFile,
  getWorkspaceTree,
  getWorkspaces,
  searchWorkspace,
} from "@/lib/api";
import type {
  WorkspaceFile,
  WorkspaceMatch,
  WorkspaceOverview,
  WorkspaceTree,
} from "@/lib/types";
import { cn, formatBytes, formatRelative } from "@/lib/utils";

export function WorkspaceExplorer() {
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [root, setRoot] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<WorkspaceMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<{ scanned: number; capped: boolean } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    getWorkspaces()
      .then((data) => {
        if (!alive) return;
        setOverview(data);
        setRoot(data.default);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Could not read the workspace.");
          setLoadingTree(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!root) return;
    let alive = true;
    const kickoff = setTimeout(() => {
      if (alive) setLoadingTree(true);
    }, 0);
    getWorkspaceTree(root, path)
      .then((data) => {
        if (!alive) return;
        setTree(data);
        setError(null);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not open the folder.");
      })
      .finally(() => {
        if (alive) setLoadingTree(false);
      });
    return () => {
      alive = false;
      clearTimeout(kickoff);
    };
  }, [root, path]);

  const openFile = useCallback(
    async (target: string) => {
      if (!root) return;
      setLoadingFile(true);
      setError(null);
      try {
        setFile(await getWorkspaceFile(target, root));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read the file.");
      } finally {
        setLoadingFile(false);
      }
    },
    [root],
  );

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!root || term.length < 2) return;

    setSearching(true);
    setError(null);
    try {
      const data = await searchWorkspace(term, root, 50);
      setMatches(data.matches);
      setSearchMeta({ scanned: data.scanned, capped: data.limit_reached });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setMatches(null);
    setSearchMeta(null);
  }

  function openDir(target: string) {
    clearSearch();
    setFile(null);
    setPath(target);
  }

  const active = overview?.roots.find((item) => item.name === root) ?? null;
  const segments = path.split("/").filter(Boolean);
  const chatHref =
    file && root
      ? `/chat?q=${encodeURIComponent(
          `Explain the file ${file.path}. Cover what it does, how it fits the project, and anything risky or unfinished.`,
        )}&file=${encodeURIComponent(file.path)}&root=${encodeURIComponent(root)}`
      : "/chat";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-[13.5px] font-semibold text-white/90">
                Current work
              </h2>
              <p className="mt-0.5 truncate text-[9.5px] text-white/30" title={active?.path}>
                {active?.path ?? "Reading workspace…"}
              </p>
            </div>
            {overview && overview.roots.length > 1 ? (
              <select
                value={root ?? ""}
                onChange={(event) => {
                  setRoot(event.target.value);
                  setPath("");
                  setFile(null);
                  clearSearch();
                }}
                className="h-7 rounded-lg border border-white/10 bg-black/30 px-2 text-[10px] text-white/70 outline-none"
              >
                {overview.roots.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <form onSubmit={runSearch} className="mt-3 flex gap-1.5">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 focus-within:border-violet/40">
              <Search className="h-3 w-3 shrink-0 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this repo…"
                className="min-w-0 flex-1 bg-transparent text-[10.5px] text-white/75 outline-none placeholder:text-white/25"
              />
              {query ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="text-white/25 hover:text-white/60"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={query.trim().length < 2 || searching}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet px-2.5 text-[10px] font-medium text-white transition hover:bg-[#8b6dff] disabled:opacity-40"
            >
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Find"}
            </button>
          </form>
        </div>

        {matches ? (
          <div className="max-h-[520px] overflow-y-auto p-2">
            <div className="flex items-center justify-between px-1 py-1 text-[9px] uppercase tracking-wide text-white/25">
              <span>
                {matches.length} match{matches.length === 1 ? "" : "es"}
                {searchMeta?.capped ? " (capped)" : ""}
              </span>
              <span>{searchMeta?.scanned ?? 0} files scanned</span>
            </div>
            {matches.length === 0 ? (
              <p className="px-1 py-6 text-center text-[10.5px] text-white/30">
                Nothing matched “{query}”.
              </p>
            ) : (
              matches.map((match) => (
                <button
                  key={`${match.path}:${match.line}`}
                  type="button"
                  onClick={() => {
                    setPath(match.path.split("/").slice(0, -1).join("/"));
                    void openFile(match.path);
                  }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
                >
                  <p className="truncate font-mono text-[10px] text-violet-soft/80">
                    {match.path}:{match.line}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9.5px] text-white/35">
                    {match.text}
                  </p>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.05] px-3 py-2 text-[9.5px] text-white/35">
              <button
                type="button"
                onClick={() => openDir("")}
                className="shrink-0 rounded px-1 py-0.5 hover:bg-white/[0.05] hover:text-white/70"
              >
                {root ?? "root"}
              </button>
              {segments.map((segment, index) => {
                const target = segments.slice(0, index + 1).join("/");
                return (
                  <span key={target} className="flex shrink-0 items-center gap-1">
                    <ChevronRight className="h-2.5 w-2.5 text-white/20" />
                    <button
                      type="button"
                      onClick={() => openDir(target)}
                      className="rounded px-1 py-0.5 hover:bg-white/[0.05] hover:text-white/70"
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
            </div>

            <div className="max-h-[520px] overflow-y-auto p-1.5">
              {path ? (
                <button
                  type="button"
                  onClick={() => openDir(tree?.parent ?? "")}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10.5px] text-white/35 transition hover:bg-white/[0.04] hover:text-white/70"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              ) : null}

              {loadingTree && !tree ? (
                <p className="flex items-center gap-2 px-2 py-6 text-[10.5px] text-white/30">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the tree…
                </p>
              ) : null}

              {tree?.entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  disabled={entry.sensitive}
                  title={entry.sensitive ? "Hidden because it may contain secrets" : entry.path}
                  onClick={() =>
                    entry.type === "dir" ? openDir(entry.path) : void openFile(entry.path)
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
                    file?.path === entry.path
                      ? "bg-violet/12 text-white"
                      : "text-white/55 hover:bg-white/[0.04] hover:text-white/85",
                    entry.sensitive && "cursor-not-allowed opacity-40",
                  )}
                >
                  {entry.type === "dir" ? (
                    <Folder className="h-3.5 w-3.5 shrink-0 text-violet-soft/70" />
                  ) : entry.sensitive ? (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-amber/60" />
                  ) : entry.language ? (
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-sky/60" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-white/30" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px]">
                    {entry.name}
                  </span>
                  {entry.type === "file" && !entry.sensitive ? (
                    <span className="shrink-0 text-[8.5px] text-white/20">
                      {formatBytes(entry.size)}
                    </span>
                  ) : null}
                </button>
              ))}

              {tree && tree.entries.length === 0 && !loadingTree ? (
                <p className="px-2 py-6 text-center text-[10.5px] text-white/25">
                  This folder is empty.
                </p>
              ) : null}
            </div>
          </>
        )}

        {error ? (
          <p className="border-t border-rose/15 bg-rose/[0.04] px-3 py-2 text-[9.5px] text-rose/80">
            {error}
          </p>
        ) : null}

        <div className="border-t border-white/[0.05] px-3 py-2 text-[9px] leading-relaxed text-white/20">
          Read-only. Dependency folders, binaries and secret files are skipped.
        </div>
      </section>

      <section className="glass flex min-h-[420px] flex-col overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {file ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-violet-soft/70" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-soft/70" />
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] text-white/80">
                {file?.path ?? "Select a file"}
              </p>
              <p className="mt-0.5 truncate text-[9px] text-white/25">
                {file
                  ? `${file.language ?? "Text"} · ${file.lines} lines · ${formatBytes(
                      file.size_bytes,
                    )} · edited ${formatRelative(file.modified_at)}`
                  : "Browse or search the repository on the left."}
              </p>
            </div>
          </div>
          {file ? (
            <Link
              href={chatHref}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-violet/30 bg-violet/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-soft transition hover:bg-violet/20"
            >
              Ask ORBITO <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loadingFile ? (
            <p className="flex items-center gap-2 p-4 text-[11px] text-white/35">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading file…
            </p>
          ) : file ? (
            <pre className="min-w-full p-4 font-mono text-[10.5px] leading-[1.6] text-white/65">
              {file.content}
            </pre>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <FolderOpen className="mx-auto h-7 w-7 text-white/15" />
                <p className="mt-2 text-[11px] text-white/35">
                  Pick a file to preview it here.
                </p>
                <p className="mt-1 text-[10px] text-white/20">
                  Then ask ORBITO to explain it with the file attached as context.
                </p>
              </div>
            </div>
          )}
        </div>

        {file?.truncated ? (
          <p className="border-t border-amber/15 bg-amber/[0.04] px-4 py-2 text-[9.5px] text-amber/80">
            Preview truncated at the workspace read limit. The file is larger on disk.
          </p>
        ) : null}
      </section>
    </div>
  );
}
