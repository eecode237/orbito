"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, FileText, FolderOpen, Loader2, RefreshCw, Upload } from "lucide-react";

import { getFiles, uploadFile } from "@/lib/api";
import type { StoredFile } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesView() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFiles();
      setFiles(data.files);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load files.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFile(file);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-info">
            <FolderOpen className="h-3.5 w-3.5" /> Uploads
          </span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Files</h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
            Files you upload are stored in ORBITO&apos;s upload folder (25 MB limit). They are not read by the model unless you attach them in a chat.
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} type="file" className="hidden" onChange={(event) => { void onPick(event); }} />
          <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload file
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { void load(); }} aria-label="Refresh files"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Uploaded files" description={`${files.length} file${files.length === 1 ? "" : "s"}`} icon={<FileText className="h-3.5 w-3.5" />} />
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : files.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-foreground-secondary">No files uploaded yet.</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="text-[9.5px] uppercase tracking-wide text-foreground-muted">
                <tr><th className="py-2 font-medium">Name</th><th className="py-2 font-medium">Type</th><th className="py-2 font-medium">Size</th><th className="py-2 font-medium">Uploaded</th></tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-t border-border-subtle">
                    <td className="py-2 text-foreground">{file.name}</td>
                    <td className="py-2 font-mono text-[10px] text-foreground-muted">{file.mime ?? "—"}</td>
                    <td className="py-2">{formatBytes(file.size)}</td>
                    <td className="py-2 text-foreground-muted">{formatRelative(file.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
