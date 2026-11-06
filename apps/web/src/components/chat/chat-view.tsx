"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import { AgentGlyph } from "@/components/agent-glyph";
import { Mascot } from "@/components/brand/mascot";
import { ExecutionTrace } from "@/components/chat/execution-trace";
import { fallbackAgents } from "@/lib/agents";
import { getAgents, getModels, streamChat } from "@/lib/api";
import type {
  Agent,
  ChatEvent,
  ChatMessage,
  ModelInfo,
  Source,
  TaskStep,
  UsageSummary,
} from "@/lib/types";
import { cn, formatCost } from "@/lib/utils";

const starterPrompts = [
  {
    agent: "career",
    title: "Find my next role",
    prompt: "Find 20 senior AI engineering jobs in Canada and score them against my CV.",
  },
  {
    agent: "research",
    title: "Research competitors",
    prompt: "Analyze the pricing pages of three competitors and build a comparison brief.",
  },
  {
    agent: "study",
    title: "Build a study plan",
    prompt: "Create a 7-day study plan for my machine learning exam with daily practice.",
  },
  {
    agent: "coding",
    title: "Ship something",
    prompt: "Plan a landing page for my business, then write the first component.",
  },
];

type RunMeta = {
  model?: string;
  provider?: string;
  usage?: UsageSummary | null;
  cost?: number;
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatView({
  initialQuery = "",
  initialAgent = "auto",
}: {
  initialQuery?: string;
  initialAgent?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [agentSlug, setAgentSlug] = useState(initialAgent || "auto");
  const [modelRole, setModelRole] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getAgents(), getModels()])
      .then(([agentData, modelData]) => {
        if (!alive) return;
        if (agentData.agents.length) setAgents(agentData.agents);
        setModels(modelData.models);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, steps, streaming]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;

      setInput("");
      setError(null);
      setSteps([]);
      setRunMeta(null);
      setTaskId(null);

      const userMessage: ChatMessage = { id: newId(), role: "user", content: text };
      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const collectedSources: Source[] = [];

      try {
        await streamChat(
          {
            message: text,
            conversation_id: conversationId,
            agent: agentSlug,
            model_role: modelRole || null,
          },
          (event: ChatEvent) => {
            if (event.type === "conversation") {
              setConversationId(event.conversation_id);
              return;
            }
            if (event.type === "task.created") {
              setTaskId(event.task_id);
              setSteps(event.steps.map((step) => ({ ...step, detail: null })));
              setActiveAgent(event.agent);
              setRunMeta({
                model: event.model.label ?? event.model.name,
                provider: event.model.provider,
              });
              return;
            }
            if (event.type === "step.updated") {
              setSteps((prev) =>
                prev.map((step) =>
                  step.index === event.index
                    ? { ...step, status: event.status, detail: event.detail ?? null }
                    : step,
                ),
              );
              return;
            }
            if (event.type === "sources") {
              event.sources.forEach((source) => {
                if (!collectedSources.some((item) => item.url === source.url)) {
                  collectedSources.push(source);
                }
              });
              return;
            }
            if (event.type === "delta") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + event.text }
                    : message,
                ),
              );
              return;
            }
            if (event.type === "done") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: event.message,
                        pending: false,
                        agent: event.agent.name,
                        model: event.model.name,
                        sources: [...collectedSources],
                      }
                    : message,
                ),
              );
              setSteps((prev) =>
                prev.map((step) =>
                  step.status === "running" ? { ...step, status: "done" as const } : step,
                ),
              );
              setRunMeta({
                model: event.model.name,
                provider: event.model.provider,
                usage: event.usage,
                cost: event.cost_usd,
              });
              return;
            }
            if (event.type === "error") {
              setError(event.error);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId ? { ...message, pending: false } : message,
                ),
              );
            }
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setError((err as Error)?.message ?? "ORBITO could not complete that request.");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        setMessages((prev) =>
          prev.map((message) =>
            message.pending && message.id === assistantId
              ? { ...message, pending: false }
              : message,
          ),
        );
      }
    },
    [agentSlug, conversationId, modelRole, streaming],
  );

  useEffect(() => {
    if (!initialQuery || autoSentRef.current) return;
    autoSentRef.current = true;
    void send(initialQuery);
    // The query is consumed exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setSteps([]);
    setRunMeta(null);
    setTaskId(null);
    setConversationId(null);
    setError(null);
    setStreaming(false);
    setInput("");
    textareaRef.current?.focus();
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Clipboard permissions vary; ignore.
    }
  }

  const selectedAgent = agents.find((agent) => agent.slug === agentSlug);
  const headerAgent = selectedAgent ?? activeAgent;
  const liveProvider = models.some(
    (model) => model.configured && model.provider !== "mock",
  );
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="-mb-24 flex h-[calc(100dvh-68px)] flex-col lg:-mb-10">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.06] py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet/25 bg-violet/10">
            <AgentGlyph
              slug={agentSlug === "auto" ? "core" : agentSlug}
              className="h-[17px] w-[17px] text-violet-soft"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white/90">
              {agentSlug === "auto" ? "ORBITO Auto" : headerAgent?.name ?? "ORBITO"}
            </p>
            <p className="truncate text-[10px] text-white/30">
              {agentSlug === "auto"
                ? "Routes to the right specialist automatically"
                : headerAgent?.tagline ?? "Specialist agent"}
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Agent</span>
            <select
              value={agentSlug}
              onChange={(event) => setAgentSlug(event.target.value)}
              disabled={streaming}
              className="h-8 appearance-none rounded-lg border border-white/10 bg-[#0c0818] pl-2.5 pr-7 text-[11px] text-white/65 outline-none transition hover:border-white/20 focus:border-violet/45"
            >
              <option value="auto">Auto agent</option>
              {agents.map((agent) => (
                <option key={agent.slug} value={agent.slug}>
                  {agent.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
          </label>

          <label className="relative hidden sm:block">
            <span className="sr-only">Model role</span>
            <select
              value={modelRole}
              onChange={(event) => setModelRole(event.target.value)}
              disabled={streaming}
              className="h-8 appearance-none rounded-lg border border-white/10 bg-[#0c0818] pl-2.5 pr-7 text-[11px] text-white/65 outline-none transition hover:border-white/20 focus:border-violet/45"
            >
              <option value="">Auto model</option>
              {models.map((model) => (
                <option key={model.role} value={model.role}>
                  {model.role} · {model.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
          </label>

          <button
            type="button"
            onClick={reset}
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/45 transition hover:border-white/20 hover:text-white/80"
            aria-label="New conversation"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-5">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center pb-6 pt-6 text-center sm:pt-12">
              <Mascot className="h-28 w-28 animate-float sm:h-36 sm:w-36" />
              <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-violet/20 bg-violet/[0.08] px-2.5 py-1 text-[9.5px] uppercase tracking-[0.2em] text-violet-soft">
                <Sparkles className="h-3 w-3" /> {liveProvider ? "Live models ready" : "Offline-ready demo"}
              </span>
              <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[32px]">
                What should we <span className="text-gradient">get done?</span>
              </h1>
              <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-white/38">
                One prompt. ORBITO plans the work, picks an agent and a model, runs the tools,
                and streams every step back to you.
              </p>

              <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-2">
                {starterPrompts.map((item) => {
                  return (
                    <button
                      key={item.prompt}
                      type="button"
                      onClick={() => {
                        setAgentSlug(item.agent);
                        void send(item.prompt);
                      }}
                      className="card-hover group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet/20 bg-violet/[0.08]">
                        <AgentGlyph slug={item.agent} className="h-4 w-4 text-violet-soft" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-white/80">
                          {item.title}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[10.5px] leading-snug text-white/30">
                          {item.prompt}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 flex items-center gap-1.5 text-[10px] text-white/22">
                <ShieldCheck className="h-3 w-3" /> Sensitive actions pause for your approval.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md border border-violet/20 bg-violet/[0.12] px-3.5 py-2.5 text-[13px] leading-relaxed text-white/90">
                    {message.content}
                  </div>
                </div>
              );
            }

            const isLast = message.id === lastAssistantId;
            return (
              <div key={message.id} className="flex flex-col gap-3">
                {isLast ? (
                  <ExecutionTrace
                    key={taskId ?? "trace"}
                    steps={steps}
                    agent={activeAgent ?? headerAgent ?? null}
                    streaming={streaming}
                  />
                ) : null}

                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet/25 bg-violet/10">
                    <Sparkles className="h-3.5 w-3.5 text-violet-soft" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-medium text-white/70">
                        {message.agent ?? "ORBITO"}
                      </span>
                      {message.pending ? (
                        <span className="flex items-center gap-1 text-[9.5px] text-violet-soft/70">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> working
                        </span>
                      ) : null}
                    </div>

                    {message.content ? (
                      <div className="markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noreferrer noopener">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : message.pending ? (
                      <div className="flex items-center gap-1.5 py-2">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-soft [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-soft [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-soft" />
                      </div>
                    ) : null}

                    {message.sources?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {message.sources.slice(0, 5).map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex max-w-[260px] items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9.5px] text-white/40 transition hover:border-violet/30 hover:text-white/70"
                          >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{source.title || source.url}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {!message.pending && message.content ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[9.5px] text-white/22">
                        {message.model ? <span>{message.model}</span> : null}
                        {isLast && runMeta?.usage ? (
                          <>
                            <span className="text-white/10">·</span>
                            <span>{runMeta.usage.total_tokens.toLocaleString()} tokens</span>
                          </>
                        ) : null}
                        {isLast && runMeta?.cost ? (
                          <>
                            <span className="text-white/10">·</span>
                            <span>{formatCost(runMeta.cost)}</span>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => copyMessage(message)}
                          className="ml-1 flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-white/5 hover:text-white/60"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="h-2.5 w-2.5" /> copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5" /> copy
                            </>
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-[#06040f]/85 pt-3 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[900px]">
          {error ? (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-rose/25 bg-rose/[0.06] px-3 py-2 text-[11px] text-rose/90">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
                <X className="h-3 w-3 text-rose/50" />
              </button>
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#0b0818] p-2 transition focus-within:border-violet/45 focus-within:shadow-[0_0_0_3px_rgba(124,92,255,0.08)]"
          >
            <button
              type="button"
              disabled
              title="File uploads ship with the documents workspace"
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/25"
              aria-label="Attach a file"
            >
              <Paperclip className="h-[17px] w-[17px]" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask ORBITO anything…"
              className="max-h-36 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-[13px] leading-relaxed text-white/90 outline-none placeholder:text-white/28"
            />

            <button
              type="button"
              disabled
              title="Voice conversations arrive with ORBITO Voice (Phase 6)"
              className="mb-0.5 hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-white/25 sm:grid"
              aria-label="Voice input"
            >
              <Mic className="h-[17px] w-[17px]" />
            </button>

            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose/30 bg-rose/10 text-rose transition hover:bg-rose/20"
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="focus-ring mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet text-white shadow-[0_8px_22px_-8px_rgba(124,92,255,1)] transition hover:bg-[#8b6dff] disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Send message"
              >
                <ArrowUp className="h-4.5 w-4.5" />
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 pt-1.5 text-[9.5px] text-white/22">
            <span>
              Enter to send · Shift + Enter for a new line
              {conversationId ? " · conversation saved" : ""}
            </span>
            <span className={cn(!liveProvider && "text-amber/50")}>
              {liveProvider
                ? "Live provider connected"
                : "Offline mock model — add a key in Settings → AI Models"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
