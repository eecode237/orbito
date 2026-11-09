"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Sparkles, Square } from "lucide-react";

import { streamChat } from "@/lib/api";
import type { ChatEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const KINDS: { id: string; label: string; brief: string }[] = [
  { id: "cv", label: "CV / resume", brief: "Write a concise, factual CV in Markdown. Use only the facts the user provides; mark missing facts as [TO CONFIRM]." },
  { id: "cover", label: "Cover letter", brief: "Write a short cover letter in Markdown for the role described. Use only facts the user provides." },
  { id: "brief", label: "Briefing", brief: "Write a structured briefing in Markdown with headings and bullet points based only on the material given." },
  { id: "plan", label: "Study plan", brief: "Write a day-by-day study plan in Markdown for the topic and time available." },
];

export function DocumentsView() {
  const [kind, setKind] = useState(KINDS[0].id);
  const [request, setRequest] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request.trim() || running) return;
    const brief = KINDS.find((item) => item.id === kind)?.brief ?? "";
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setError(null);
    setOutput("");
    setModel(null);
    try {
      await streamChat(
        { message: `${brief}\n\nRequest:\n${request.trim()}`, agent: "core" },
        (ev: ChatEvent) => {
          if (ev.type === "delta") setOutput((prev) => prev + ev.text);
          if (ev.type === "done") setModel(`${ev.model.provider}/${ev.model.name}`);
          if (ev.type === "error") setError(ev.error);
        },
        controller.signal,
      );
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "Generation failed.");
      }
    } finally {
      setRunning(false);
      controllerRef.current = null;
    }
  }

  function download() {
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kind}-document.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-info">
          <FileText className="h-3.5 w-3.5" /> Document studio
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Documents</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Drafts are written by your local model through the normal chat path. Review every draft before you use it; the model does not know facts you have not given it.
        </p>
      </header>

      <Card>
        <CardHeader title="New draft" icon={<Sparkles className="h-3.5 w-3.5" />} />
        <CardContent>
          <form onSubmit={generate} className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((item) => (
                <button key={item.id} type="button" onClick={() => setKind(item.id)} className={`rounded-full border px-3 py-1 text-[10.5px] transition ${kind === item.id ? "border-primary/40 bg-primary/10 text-primary-hover" : "border-border text-foreground-muted"}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={5} maxLength={12000} placeholder="Paste the facts, the role, or the material to work from…" className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-[11.5px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50" />
            <div className="flex justify-end gap-2">
              {running ? (
                <Button variant="outline" type="button" onClick={() => controllerRef.current?.abort()}><Square className="h-3.5 w-3.5" /> Stop</Button>
              ) : null}
              <Button variant="primary" type="submit" disabled={running || !request.trim()}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate draft
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <p role="alert" className="text-[11px] text-error">{error}</p> : null}

      {output ? (
        <Card>
          <CardHeader
            title="Draft"
            description={model ? `Generated by ${model}` : "Streaming…"}
            actions={<Button variant="secondary" size="sm" onClick={download} disabled={running}><Download className="h-3.5 w-3.5" /> Download .md</Button>}
          />
          <CardContent>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-inset/60 p-4 font-mono text-[11px] leading-relaxed text-foreground">{output}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
