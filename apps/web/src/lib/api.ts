import type {
  Agent,
  ChatEvent,
  CryptoChart,
  CryptoMarket,
  DashboardOverview,
  MemoryItem,
  ModelHubOverview,
  ModelInfo,
  LocationInfo,
  ModelLibrarySearch,
  NewsFeed,
  ProviderStatus,
  PullEvent,
  ScrapingJob,
  ScrapingResult,
  StockChart,
  StockMarket,
  SystemAlerts,
  SystemStats,
  TaskEvent,
  TaskList,
  TaskMetrics,
  TaskSummary,
  TaskUsage,
  UsageSummary,
  WorkspaceFile,
  WorkspaceOverview,
  WorkspaceSearch,
  WorkspaceTree,
} from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error?.message ?? payload?.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(await parseError(response), response.status);
  return (await response.json()) as T;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "DELETE" | "PATCH",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(await parseError(response), response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type ChatInput = {
  message: string;
  conversation_id?: string | null;
  agent?: string;
  model_role?: string | null;
  workspace_id?: string | null;
};

/**
 * Consume an SSE response. Parsing is buffered so a chunk boundary can never
 * split an event.
 */
async function readSse<T>(response: Response, onEvent: (event: T) => void): Promise<void> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data) {
        try {
          onEvent(JSON.parse(data) as T);
        } catch {
          // A malformed event should never take down the stream.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

/**
 * POST /chat and consume its SSE stream.
 */
export async function streamChat(
  input: ChatInput,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, stream: true }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(await parseError(response), response.status);
  }

  await readSse<ChatEvent>(response, onEvent);
}

export type Health = {
  status: string;
  app: string;
  version: string;
  env: string;
  database: string;
  providers: Record<string, boolean>;
  live_provider: boolean;
};

export async function getHealth(): Promise<Health> {
  return apiGet("/api/v1/health");
}

export async function getAgents(): Promise<{ agents: Agent[]; tools: unknown[] }> {
  return apiGet("/api/v1/agents");
}

export async function getModels(): Promise<{
  models: ModelInfo[];
  providers: ProviderStatus[];
  default_role: string;
}> {
  return apiGet("/api/v1/models");
}

export async function getTasks(
  optionsOrLimit:
    | number
    | {
        limit?: number;
        offset?: number;
        status?: string;
        q?: string;
      } = {},
): Promise<TaskList> {
  const options =
    typeof optionsOrLimit === "number" ? { limit: optionsOrLimit } : optionsOrLimit;
  const params = new URLSearchParams({
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
  });
  if (options.status && options.status !== "all") params.set("status", options.status);
  if (options.q?.trim()) params.set("q", options.q.trim());
  return apiGet(`/api/v1/tasks?${params.toString()}`);
}

export async function getTask(id: string): Promise<TaskSummary> {
  return apiGet(`/api/v1/tasks/${id}`);
}

export async function getTaskMetrics(): Promise<TaskMetrics> {
  return apiGet("/api/v1/tasks/metrics");
}

export async function getTaskEvents(id: string): Promise<{ task_id: string; events: TaskEvent[] }> {
  return apiGet(`/api/v1/tasks/${id}/events`);
}

export function taskEventsUrl(id: string): string {
  return `${API_URL}/api/v1/tasks/${id}/events/stream`;
}

export async function getTaskUsage(id: string): Promise<TaskUsage> {
  const task = await getTask(id);
  return (
    task.usage ?? {
      requests: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
    }
  );
}

export type TaskAction = "pause" | "resume" | "cancel" | "retry" | "approve" | "reject";

export async function controlTask(
  id: string,
  action: TaskAction,
): Promise<Record<string, unknown>> {
  return apiSend(`/api/v1/tasks/${id}/${action}`, "POST");
}

export async function getUsage(): Promise<UsageSummary> {
  return apiGet("/api/v1/usage");
}

export async function getMemories(): Promise<{ memories: MemoryItem[] }> {
  return apiGet("/api/v1/memory");
}

export async function createMemory(payload: {
  content: string;
  scope?: "long_term" | "workspace";
  key?: string | null;
  workspace_id?: string | null;
}): Promise<{ id: string }> {
  return apiSend("/api/v1/memory", "POST", payload);
}

export async function deleteMemoryApi(memoryId: string): Promise<void> {
  await apiSend(`/api/v1/memory/${encodeURIComponent(memoryId)}`, "DELETE");
}

export async function getScrapingJobs(): Promise<{ jobs: ScrapingJob[] }> {
  return apiGet("/api/v1/scraping/jobs");
}

export async function getScrapingJob(
  id: string,
): Promise<{ job: ScrapingJob; results: ScrapingResult[] }> {
  return apiGet(`/api/v1/scraping/jobs/${id}`);
}

export async function getModelHub(): Promise<ModelHubOverview> {
  return apiGet("/api/v1/model-hub/overview");
}

export async function deleteLocalModel(name: string): Promise<void> {
  await apiSend(
    `/api/v1/model-hub/models?name=${encodeURIComponent(name)}`,
    "DELETE",
  );
}

/**
 * POST /model-hub/pull and consume its SSE progress stream. The request stays
 * open for as long as the download takes, so callers can abort it.
 */
export async function pullModel(
  name: string,
  onEvent: (event: PullEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/model-hub/pull`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(await parseError(response), response.status);
  }

  await readSse<PullEvent>(response, onEvent);
}

export async function searchModelLibrary(query: string, limit = 20): Promise<ModelLibrarySearch> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiGet(`/api/v1/model-hub/search?${params.toString()}`);
}

export async function getSystemStats(): Promise<SystemStats> {
  return apiGet("/api/v1/system/stats");
}

export async function getSystemAlerts(): Promise<SystemAlerts> {
  return apiGet("/api/v1/system/alerts");
}

export async function getSystemLogs(limit = 80): Promise<{ events: TaskEvent[]; count: number; limit: number }> {
  return apiGet(`/api/v1/system/logs?limit=${limit}`);
}

export async function getWorkspaces(): Promise<WorkspaceOverview> {
  return apiGet("/api/v1/workspaces");
}

export async function getWorkspaceTree(
  root?: string | null,
  path = "",
): Promise<WorkspaceTree> {
  const params = new URLSearchParams({ path });
  if (root) params.set("root", root);
  return apiGet(`/api/v1/workspaces/tree?${params.toString()}`);
}

export async function getWorkspaceFile(
  path: string,
  root?: string | null,
): Promise<WorkspaceFile> {
  const params = new URLSearchParams({ path });
  if (root) params.set("root", root);
  return apiGet(`/api/v1/workspaces/file?${params.toString()}`);
}

export async function searchWorkspace(
  query: string,
  root?: string | null,
  limit = 40,
): Promise<WorkspaceSearch> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (root) params.set("root", root);
  return apiGet(`/api/v1/workspaces/search?${params.toString()}`);
}

export async function getNews(category = "all", limit = 30): Promise<NewsFeed> {
  const params = new URLSearchParams({ category, limit: String(limit) });
  return apiGet(`/api/v1/intel/news?${params.toString()}`);
}

export async function getNewsSources(): Promise<{
  sources: { name: string; url: string; category: string }[];
  method: string;
}> {
  return apiGet("/api/v1/intel/sources");
}

export async function getCryptoMarket(): Promise<CryptoMarket> {
  return apiGet("/api/v1/intel/markets/crypto");
}

export async function getCryptoChart(
  coin: string,
  days = 7,
): Promise<CryptoChart> {
  return apiGet(`/api/v1/intel/markets/crypto/${coin}/chart?days=${days}`);
}

export async function getStockMarket(symbols?: string): Promise<StockMarket> {
  const q = symbols ? `?symbols=${encodeURIComponent(symbols)}` : "";
  return apiGet(`/api/v1/intel/markets/stocks${q}`);
}

export async function getStockChart(symbol: string, days = 30): Promise<StockChart> {
  return apiGet(`/api/v1/intel/markets/stocks/${encodeURIComponent(symbol)}/chart?days=${days}`);
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return apiGet("/api/v1/dashboard/overview");
}

export type ConversationSummary = {
  id: string;
  title: string | null;
  agent: string | null;
  model_role?: string | null;
  updated_at: string | null;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent?: string | null;
  model?: string | null;
  created_at?: string | null;
};

export async function getConversations(limit = 40): Promise<{ conversations: ConversationSummary[] }> {
  return apiGet(`/api/v1/conversations?limit=${limit}`);
}

export async function getConversationMessages(
  conversationId: string,
): Promise<{ conversation: ConversationSummary & { messages?: ConversationMessage[] }; messages?: ConversationMessage[] }> {
  return apiGet(`/api/v1/conversations/${conversationId}/messages`);
}

export async function deleteConversation(conversationId: string): Promise<{ deleted: boolean; id: string }> {
  return apiSend(`/api/v1/conversations/${conversationId}`, "DELETE");
}

export async function clearConversations(): Promise<{ deleted: boolean; count: number }> {
  return apiSend("/api/v1/conversations", "DELETE");
}

export async function getSystemHistory(range = "15m", points = 120): Promise<{
  range: string;
  seconds: number;
  points: Array<{
    timestamp: string;
    cpu_percent: number;
    memory_percent: number;
    swap_percent: number;
    disk_percent: number;
    temperature_c: number | null;
    battery_percent: number | null;
    read_bytes_per_sec: number | null;
    write_bytes_per_sec: number | null;
    recv_bytes_per_sec: number | null;
    sent_bytes_per_sec: number | null;
    gpu_percent: number | null;
  }>;
  count: number;
  generated_at: string;
}> {
  return apiGet(`/api/v1/system/history?range=${encodeURIComponent(range)}&points=${points}`);
}

export async function getSystemOverview(): Promise<Record<string, unknown>> {
  return apiGet("/api/v1/system/overview");
}

/**
 * Nearest real place description for a point on the globe (Wikipedia, cached server-side).
 */
export async function getLocationInfo(lat: number, lon: number): Promise<LocationInfo> {
  return apiGet(`/api/v1/intel/geo/describe?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
}
