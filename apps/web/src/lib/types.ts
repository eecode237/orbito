export type AgentAccent = "violet" | "mint" | "blue" | "amber" | "rose" | "slate";

export type Agent = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent: AgentAccent;
  capabilities: string[];
  tools: string[];
  samples: string[];
  approval_required: string[];
  model_role: string;
};

export type ModelInfo = {
  role: string;
  provider: string;
  model: string;
  label: string;
  context_window: number;
  input_cost: number;
  output_cost: number;
  vision: boolean;
  reasoning: boolean;
  local: boolean;
  configured: boolean;
  is_default: boolean;
  fallback_chain: { role: string; provider: string; model: string }[];
};

export type ProviderStatus = {
  id: string;
  label: string;
  configured: boolean;
  capabilities: string[];
};

export type TaskStep = {
  index: number;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled" | "skipped";
  detail?: string | null;
  tool?: string | null;
};

export type TaskSummary = {
  id: string;
  title: string;
  prompt: string;
  agent: string | null;
  status: string;
  progress: number;
  result?: string | null;
  error?: string | null;
  model?: string | null;
  provider?: string | null;
  cost_usd: number;
  created_at: string;
  steps: TaskStep[];
};

export type UsageSummary = {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type MemoryItem = {
  id: string;
  content: string;
  scope: string;
  key?: string | null;
  workspace_id?: string | null;
  created_at?: string | null;
};

export type ScrapingJob = {
  id: string;
  name: string;
  urls: string[];
  schema: Record<string, unknown>;
  config: Record<string, unknown>;
  status: string;
  progress: number;
  pages_done: number;
  pages_total: number;
  error?: string | null;
  created_at?: string | null;
};

export type ScrapingResult = {
  url: string;
  data: Record<string, unknown>;
};

export type Source = { title: string; url: string };

export type ChatEvent =
  | { type: "conversation"; conversation_id: string | null }
  | {
      type: "task.created";
      task_id: string;
      agent: Agent;
      model_role: string;
      model: { provider: string; name: string; label?: string; offline?: boolean };
      steps: { index: number; title: string; status: TaskStep["status"] }[];
    }
  | {
      type: "step.updated";
      index: number;
      title: string;
      status: TaskStep["status"];
      detail?: string | null;
    }
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | {
      type: "done";
      task_id: string;
      message: string;
      agent: Agent;
      model: { provider: string; name: string; role?: string };
      usage: UsageSummary | null;
      cost_usd: number;
    }
  | { type: "error"; error: string; task_id?: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
  model?: string;
  sources?: Source[];
  pending?: boolean;
};
