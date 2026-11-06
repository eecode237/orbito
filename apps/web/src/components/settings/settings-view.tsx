"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  BrainCircuit,
  Check,
  Coins,
  Gauge,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import { ModelHub } from "@/components/settings/model-hub";
import { apiSend, getMemories, getModels, getTasks, getUsage } from "@/lib/api";
import type { MemoryItem, ModelInfo, ProviderStatus, TaskSummary, UsageSummary } from "@/lib/types";
import { cn, compactNumber, formatCost, formatRelative } from "@/lib/utils";

const tabs = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "models", label: "AI Models", icon: BrainCircuit },
  { id: "hub", label: "Model Hub", icon: Boxes },
  { id: "providers", label: "API Providers", icon: KeyRound },
  { id: "memory", label: "Memory", icon: Layers },
  { id: "usage", label: "Usage & Costs", icon: Coins },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;

type TabId = (typeof tabs)[number]["id"];

const approvalRows = [
  { action: "Search public websites", policy: "Automatic", tone: "mint" },
  { action: "Read a document", policy: "Automatic", tone: "mint" },
  { action: "Generate a CV or plan", policy: "Automatic", tone: "mint" },
  { action: "Prepare a job application", policy: "Automatic", tone: "mint" },
  { action: "Submit an application / send email", policy: "Approval", tone: "amber" },
  { action: "Write or delete a file", policy: "Approval", tone: "amber" },
  { action: "Access an external account", policy: "Explicit auth", tone: "rose" },
  { action: "Execute shell commands", policy: "Restricted sandbox", tone: "rose" },
];

export function SettingsView({ initialTab = "profile" }: { initialTab?: string }) {
  const [tab, setTab] = useState<TabId>(
    (tabs.find((item) => item.id === initialTab)?.id ?? "profile") as TabId,
  );
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Explorer");
  const [profileEmail, setProfileEmail] = useState("you@orbito.local");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("orbito.profile");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { name?: string; email?: string };
        // Reading a browser-only store after mount is the point of this effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.name) setProfileName(parsed.name);
        if (parsed.email) setProfileEmail(parsed.email);
      } catch {
        // ignore malformed local data
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([getModels(), getMemories(), getUsage(), getTasks(12)])
      .then(([modelData, memoryData, usageData, taskData]) => {
        if (!alive) return;
        setModels(modelData.models);
        setProviders(modelData.providers);
        setMemories(memoryData.memories);
        setUsage(usageData);
        setTasks(taskData.tasks);
        setOffline(false);
      })
      .catch(() => {
        if (alive) setOffline(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const liveCount = useMemo(
    () => providers.filter((provider) => provider.configured && provider.id !== "mock").length,
    [providers],
  );

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    window.localStorage.setItem(
      "orbito.profile",
      JSON.stringify({ name: profileName, email: profileEmail }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function addMemory(event: React.FormEvent) {
    event.preventDefault();
    const content = memoryDraft.trim();
    if (!content) return;
    setMemoryError(null);
    try {
      await apiSend<{ id: string }>("/api/v1/memory", "POST", { content, scope: "long_term" });
      setMemoryDraft("");
      const data = await getMemories();
      setMemories(data.memories);
    } catch (err) {
      setMemoryError((err as Error).message);
    }
  }

  async function deleteMemory(id: string) {
    setMemoryError(null);
    try {
      await apiSend(`/api/v1/memory/${id}`, "DELETE");
      setMemories((prev) => prev.filter((memory) => memory.id !== id));
    } catch (err) {
      setMemoryError((err as Error).message);
    }
  }

  return (
    <div className="pt-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">
            Control room
          </span>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.02em] text-white">
            Settings
          </h1>
          <p className="mt-1 text-[12px] text-white/35">
            Models, providers, memory and the guardrails around them.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-[10px] text-white/35">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              offline ? "bg-rose" : "bg-mint shadow-[0_0_8px_#3ddc97]",
            )}
          />
          {offline ? "API offline" : `${liveCount} live provider${liveCount === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium transition",
              tab === item.id
                ? "bg-violet/18 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)]"
                : "text-white/35 hover:bg-white/[0.04] hover:text-white/70",
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-[12px] text-white/35">
            <Loader2 className="h-4 w-4 animate-spin text-violet-soft" /> Loading workspace
            configuration…
          </div>
        ) : null}

        {!loading && tab === "profile" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <form onSubmit={saveProfile} className="glass rounded-2xl p-5">
              <h2 className="font-display text-[14px] font-semibold text-white/90">
                Your profile
              </h2>
              <p className="mt-1 text-[10.5px] text-white/30">
                Foundation v0.1 runs a demo workspace. Better Auth + real accounts land in Phase 1.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Display name
                  </span>
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-[12px] text-white/80 outline-none focus:border-violet/45"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Email
                  </span>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-[12px] text-white/80 outline-none focus:border-violet/45"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Timezone
                  </span>
                  <input
                    defaultValue="UTC"
                    disabled
                    className="mt-1 h-9 w-full rounded-xl border border-white/[0.06] bg-black/15 px-3 text-[12px] text-white/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Plan
                  </span>
                  <input
                    defaultValue="Pro · Demo workspace"
                    disabled
                    className="mt-1 h-9 w-full rounded-xl border border-white/[0.06] bg-black/15 px-3 text-[12px] text-white/30"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 flex h-9 items-center gap-2 rounded-xl bg-violet px-4 text-[11.5px] font-semibold text-white transition hover:bg-[#8b6dff]"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {saved ? "Saved" : "Save changes"}
              </button>
            </form>

            <div className="space-y-4">
              <div className="glass rounded-2xl p-5">
                <h3 className="text-[12px] font-medium text-white/80">Workspace</h3>
                <dl className="mt-3 space-y-2 text-[10.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/30">Name</dt>
                    <dd className="text-white/60">Personal</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/30">Memory scope</dt>
                    <dd className="text-white/60">Long-term + workspace</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/30">Storage</dt>
                    <dd className="text-white/60">Local object store</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-amber/20 bg-amber/[0.04] p-4">
                <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-amber/80">
                  <Lock className="h-3.5 w-3.5" /> Demo mode
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
                  There is no login yet, so every request maps to the local demo user. Do not
                  expose this deployment publicly until Phase 1 auth lands.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && tab === "models" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet/20 bg-violet/[0.05] p-4 text-[10.5px] leading-relaxed text-white/45">
              Models are configuration, not code. Roles are resolved by the gateway and fall back
              in order. API keys stay server-side in <code className="text-white/70">.env</code> —
              they are never sent to this browser.
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {models.map((model) => (
                <div key={model.role} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-violet/20 bg-violet/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-soft">
                          {model.role}
                        </span>
                        {model.is_default ? (
                          <span className="text-[9px] text-mint/70">default</span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-display text-[14px] font-semibold text-white/90">
                        {model.label}
                      </h3>
                      <p className="mt-0.5 text-[10px] text-white/30">
                        {model.provider} · {model.model}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px]",
                        model.configured
                          ? "border-mint/25 bg-mint/[0.07] text-mint"
                          : "border-white/10 bg-white/[0.02] text-white/30",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1 w-1 rounded-full",
                          model.configured ? "bg-mint" : "bg-white/25",
                        )}
                      />
                      {model.configured ? "ready" : "no key"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[9.5px] text-white/30">
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                      Context <span className="text-white/60">{compactNumber(model.context_window)}</span>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                      Cost{" "}
                      <span className="text-white/60">
                        ${model.input_cost}/${model.output_cost}
                      </span>{" "}
                      per 1M
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[9px] text-white/25">
                    <span>fallback</span>
                    {model.fallback_chain.map((item, index) => (
                      <span key={`${item.provider}-${item.model}-${index}`} className="flex items-center gap-1">
                        {index > 0 ? <span className="text-white/10">→</span> : null}
                        <span className="rounded border border-white/[0.06] px-1 py-0.5 text-white/40">
                          {item.role}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="glass rounded-2xl p-4">
              <h3 className="text-[11.5px] font-medium text-white/70">Configure a provider</h3>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#070510] p-3 text-[10px] leading-relaxed text-mint/70">
{`# .env
OPENAI_API_KEY=sk-…
ORBITO_FAST_MODEL=gpt-4.1-mini
ORBITO_REASONING_MODEL=claude-sonnet-4-5
GOOGLE_API_KEY=…
OLLAMA_ENABLED=true`}
              </pre>
            </div>
          </div>
        ) : null}

        {!loading && tab === "hub" ? <ModelHub /> : null}

        {!loading && tab === "providers" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <div key={provider.id} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[13px] font-semibold text-white/85">
                    {provider.label}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[9px]",
                      provider.configured
                        ? "border-mint/25 bg-mint/[0.07] text-mint"
                        : "border-white/10 text-white/30",
                    )}
                  >
                    {provider.configured ? "connected" : "not configured"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {provider.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-white/35"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[9.5px] leading-relaxed text-white/22">
                  {provider.id === "mock"
                    ? "Deterministic offline model. Keeps the full product loop usable without keys."
                    : provider.id === "ollama"
                      ? "Local models via OLLAMA_ENABLED=true. Never leaves your machine."
                      : `Set ${provider.id.toUpperCase()}_API_KEY in .env to activate.`}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && tab === "memory" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[14px] font-semibold text-white/90">
                  Long-term memory
                </h2>
                <span className="text-[9.5px] text-white/25">{memories.length} items</span>
              </div>
              <p className="mt-1 text-[10.5px] text-white/30">
                ORBITO only stores what you tell it to remember, plus explicit task context.
              </p>

              <form onSubmit={addMemory} className="mt-4 flex gap-2">
                <input
                  value={memoryDraft}
                  onChange={(event) => setMemoryDraft(event.target.value)}
                  placeholder="Remember that I prefer concise answers…"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-[11.5px] text-white/80 outline-none placeholder:text-white/22 focus:border-violet/45"
                />
                <button
                  type="submit"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-violet px-3 text-[11px] font-semibold text-white transition hover:bg-[#8b6dff]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </form>
              {memoryError ? (
                <p className="mt-2 text-[10px] text-rose/80">{memoryError}</p>
              ) : null}

              <div className="mt-4 divide-y divide-white/[0.04]">
                {memories.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-white/25">
                    Nothing remembered yet.
                  </p>
                ) : (
                  memories.map((memory) => (
                    <div key={memory.id} className="flex items-start gap-3 py-3">
                      <BrainCircuit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] leading-relaxed text-white/65">
                          {memory.content}
                        </p>
                        <p className="mt-1 text-[9px] text-white/22">
                          {memory.scope} · {formatRelative(memory.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteMemory(memory.id)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/25 transition hover:bg-rose/10 hover:text-rose"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass rounded-2xl p-4">
                <h3 className="text-[11.5px] font-medium text-white/70">Memory levels</h3>
                <ul className="mt-2.5 space-y-2 text-[10px] leading-relaxed text-white/30">
                  <li>
                    <span className="text-white/60">Conversation</span> — the current thread,
                    replayed into context.
                  </li>
                  <li>
                    <span className="text-white/60">Workspace</span> — shared across a project.
                    Landing in Phase 3.
                  </li>
                  <li>
                    <span className="text-white/60">Long-term</span> — explicit facts you add or
                    ask ORBITO to remember.
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-mint/15 bg-mint/[0.03] p-4 text-[10px] leading-relaxed text-white/35">
                Everything here is inspectable and deletable. No hidden profiling.
              </div>
            </div>
          </div>
        ) : null}

        {!loading && tab === "usage" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Requests", value: compactNumber(usage?.requests ?? 0), icon: Gauge },
                {
                  label: "Total tokens",
                  value: compactNumber(usage?.total_tokens ?? 0),
                  icon: BrainCircuit,
                },
                {
                  label: "Completion tokens",
                  value: compactNumber(usage?.completion_tokens ?? 0),
                  icon: Layers,
                },
                { label: "Estimated cost", value: formatCost(usage?.cost_usd ?? 0), icon: Coins },
              ].map((item) => (
                <div key={item.label} className="glass rounded-xl p-4">
                  <item.icon className="h-4 w-4 text-violet-soft/70" />
                  <p className="mt-2 font-display text-[18px] font-semibold text-white/90">
                    {item.value}
                  </p>
                  <p className="text-[9.5px] uppercase tracking-[0.16em] text-white/25">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="glass overflow-hidden rounded-2xl">
              <div className="border-b border-white/[0.06] px-4 py-3 text-[11.5px] font-medium text-white/70">
                Recent tasks
              </div>
              {tasks.length === 0 ? (
                <p className="px-4 py-6 text-[11px] text-white/25">No tasks recorded yet.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-white/55">
                        {task.title}
                      </span>
                      <span className="text-[9px] uppercase text-white/25">{task.status}</span>
                      <span className="w-14 text-right text-[9.5px] text-white/30">
                        {task.cost_usd ? formatCost(task.cost_usd) : "—"}
                      </span>
                      <span className="hidden w-16 text-right text-[9px] text-white/22 sm:block">
                        {formatRelative(task.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[9.5px] leading-relaxed text-white/22">
              Costs are estimates from the gateway rate table. Provider invoices are the source of
              truth. Usage is recorded per task and per model role.
            </p>
          </div>
        ) : null}

        {!loading && tab === "security" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="glass overflow-hidden rounded-2xl">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <h2 className="text-[12px] font-medium text-white/80">Action approval matrix</h2>
                <p className="mt-0.5 text-[9.5px] text-white/25">
                  The model can propose anything; policy decides what runs.
                </p>
              </div>
              <table className="w-full text-left">
                <tbody>
                  {approvalRows.map((row) => (
                    <tr key={row.action} className="border-b border-white/[0.04]">
                      <td className="px-4 py-2.5 text-[10.5px] text-white/55">{row.action}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[9px]",
                            row.tone === "mint" && "border-mint/20 bg-mint/[0.06] text-mint/90",
                            row.tone === "amber" &&
                              "border-amber/20 bg-amber/[0.06] text-amber/90",
                            row.tone === "rose" && "border-rose/20 bg-rose/[0.06] text-rose/90",
                          )}
                        >
                          {row.policy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Secrets",
                  body: "Provider keys live in .env server-side and are never bundled into the frontend.",
                },
                {
                  title: "Network",
                  body: "Scraping validates schemes, resolves DNS and blocks private, loopback and metadata ranges.",
                },
                {
                  title: "Execution",
                  body: "Model-generated shell never runs on the host. Sandboxed runners arrive with the Build agent.",
                },
                {
                  title: "Audit",
                  body: "Sensitive actions are designed to produce an audit record and a usage entry.",
                },
              ].map((item) => (
                <div key={item.title} className="glass rounded-2xl p-4">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-medium text-white/75">
                    <ShieldCheck className="h-3.5 w-3.5 text-mint/70" /> {item.title}
                  </h3>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-white/30">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
