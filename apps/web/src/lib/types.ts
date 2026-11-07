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

export type TaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStep = {
  index: number;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled" | "skipped";
  detail?: string | null;
  tool?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
};

export type TaskUsage = {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type TaskSummary = {
  id: string;
  title: string;
  prompt: string;
  agent: string | null;
  status: TaskStatus | string;
  progress: number;
  result?: string | null;
  error?: string | null;
  model?: string | null;
  provider?: string | null;
  cost_usd: number;
  conversation_id?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  meta?: Record<string, unknown>;
  sources?: Source[];
  approval_request?: string | null;
  steps: TaskStep[];
  usage?: TaskUsage;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  kind: string;
  level: "info" | "success" | "warning" | "error" | "tool" | "model" | "agent";
  message: string;
  detail?: string | null;
  step_index?: number | null;
  data: Record<string, unknown>;
  created_at: string | null;
};

export type TaskMetrics = {
  counts: {
    all: number;
    active: number;
    running: number;
    paused: number;
    queued: number;
    completed: number;
    failed: number;
    cancelled: number;
    completed_today: number;
    failed_today: number;
  };
  average_duration_seconds: number | null;
  active_agents: { agent: string; running: number }[];
  generated_at: string;
};

export type TaskList = {
  tasks: TaskSummary[];
  total: number;
  limit: number;
  offset: number;
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

export type LocalModel = {
  name: string;
  size: number;
  digest?: string | null;
  modified_at?: string | null;
  family?: string | null;
  parameter_size?: string | null;
  quantization?: string | null;
  format?: string | null;
};

export type RunningModel = LocalModel & {
  size_vram: number;
  processor: "gpu" | "partial" | "cpu";
  expires_at?: string | null;
  context_length?: number | null;
};

export type HardwareInfo = {
  platform: string;
  cpu_model?: string | null;
  cpu_threads?: number | null;
  memory_total_bytes: number;
  memory_available_bytes: number;
  gpus: { name: string }[];
  disk: { path: string; total_bytes: number; free_bytes: number };
};

export type ModelSuggestion = {
  name: string;
  role: string;
  note: string;
  installed: boolean;
};

export type ModelHubOverview = {
  ollama: {
    reachable: boolean;
    version?: string | null;
    base_url: string;
    error?: string | null;
  };
  installed: LocalModel[];
  running: RunningModel[];
  hardware: HardwareInfo;
  suggestions: ModelSuggestion[];
  enabled: boolean;
};

export type PullEvent =
  | {
      type: "progress";
      model: string;
      status: string;
      digest?: string | null;
      total: number;
      completed: number;
      percent: number | null;
    }
  | { type: "done"; model: string }
  | { type: "error"; model: string; error: string };

export type ModelLibraryResult = {
  name: string;
  description?: string;
  pulls?: number | string | null;
  tags?: unknown;
  updated_at?: string | null;
  installed: boolean;
};

export type ModelLibrarySearch = {
  reachable: boolean;
  query: string;
  results: ModelLibraryResult[];
  error: string | null;
};

export type SystemAlert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
  value: string;
  href?: string | null;
};

export type SystemStats = {
  timestamp: string;
  platform: string;
  uptime_seconds: number;
  cpu: {
    percent: number;
    per_core: number[];
    cores: number;
    model?: string | null;
    load?: { one: number; five: number; fifteen: number } | null;
  };
  memory: {
    total_bytes: number;
    available_bytes: number;
    used_bytes: number;
    percent: number;
    swap_total_bytes: number;
    swap_used_bytes: number;
    swap_percent: number;
  };
  disk: {
    path: string;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    percent: number;
  };
  temperature_c?: number | null;
  battery?: {
    percent: number;
    status: string;
    plugged: boolean;
  } | null;
  ollama: {
    reachable: boolean;
    version?: string | null;
    base_url: string;
    error?: string | null;
  };
};

export type SystemAlerts = {
  alerts: SystemAlert[];
  generated_at: string;
};

export type WorkspaceRoot = {
  name: string;
  path: string;
  exists: boolean;
  files: number;
  size_bytes: number;
  updated_at?: string | null;
};

export type WorkspaceOverview = {
  roots: WorkspaceRoot[];
  default: string | null;
};

export type WorkspaceEntry = {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number;
  language?: string | null;
  sensitive: boolean;
  modified_at: string;
};

export type WorkspaceTree = {
  root: string;
  path: string;
  parent: string | null;
  entries: WorkspaceEntry[];
};

export type WorkspaceFile = {
  root: string;
  path: string;
  name: string;
  language?: string | null;
  size_bytes: number;
  modified_at: string;
  truncated: boolean;
  content: string;
  lines: number;
};

export type WorkspaceMatch = {
  path: string;
  line: number;
  text: string;
  language?: string | null;
};

export type WorkspaceSearch = {
  root: string;
  query: string;
  matches: WorkspaceMatch[];
  scanned: number;
  limit_reached: boolean;
};

export type NewsLocation = { lat: number; lon: number; label?: string };

export type NewsArticle = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  category: string;
  published_at: string | null;
  location?: NewsLocation | null;
};

export type NewsSourceStatus = {
  name: string;
  category: string;
  reachable: boolean;
  error: string | null;
  count: number;
};

export type NewsFeed = {
  category: string;
  articles: NewsArticle[];
  sources: NewsSourceStatus[];
  reachable: boolean;
  generated_at: string;
  notice: string;
};

export type CryptoAsset = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  rank: number | null;
  volume_24h_usd: number | null;
  change_24h_percent: number | null;
  sparkline: number[];
  last_updated: string | null;
};

export type CryptoMarket = {
  reachable: boolean;
  error: string | null;
  currency: string;
  assets: CryptoAsset[];
  generated_at: string;
  provider: string;
  stale?: boolean;
};

export type CryptoChartPoint = {
  t: number;
  price: number;
};

export type CryptoChart = {
  reachable: boolean;
  error: string | null;
  coin: string;
  days: number;
  currency: string;
  points: CryptoChartPoint[];
  generated_at: string;
  stale?: boolean;
};

export type StockAsset = {
  id: string;
  symbol: string;
  name: string;
  exchange?: string | null;
  currency?: string;
  price: number | null;
  previous_close?: number | null;
  change_percent: number | null;
  market_cap?: number | null;
  sparkline: number[];
  market_state?: string | null;
  regular_market_time?: number | null;
};

export type StockMarket = {
  reachable: boolean;
  error: string | null;
  currency: string;
  assets: StockAsset[];
  generated_at: string;
  provider: string;
  stale?: boolean;
};

export type StockChart = {
  reachable: boolean;
  error: string | null;
  symbol: string;
  days: number;
  currency: string;
  points: CryptoChartPoint[];
  generated_at: string;
  stale?: boolean;
};

export type UsagePoint = {
  date: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export type UsageBreakdown = {
  name: string;
  requests: number;
  tokens: number;
  cost_usd: number;
};

export type PendingApproval = {
  task_id: string;
  title: string;
  agent: string | null;
  request: string | null;
  created_at: string | null;
};

export type DashboardModels = {
  enabled: boolean;
  reachable: boolean;
  error: string | null;
  ollama: {
    reachable: boolean;
    version?: string | null;
    base_url: string;
    error?: string | null;
  };
  installed: LocalModel[];
  running: RunningModel[];
  catalog: ModelInfo[];
};

export type DashboardOverview = {
  generated_at: string;
  health: {
    database: string;
    providers: Record<string, boolean>;
    provider_labels: Record<string, string>;
    live_provider: boolean;
  };
  system: SystemStats;
  tasks: {
    metrics: TaskMetrics;
    recent: TaskSummary[];
    active: TaskSummary[];
    pending_approvals: PendingApproval[];
  };
  usage: {
    summary: UsageSummary;
    series: UsagePoint[];
    breakdown: {
      providers: UsageBreakdown[];
      models: UsageBreakdown[];
    };
  };
  activity: TaskEvent[];
  models: DashboardModels;
  agents: Agent[];
};
