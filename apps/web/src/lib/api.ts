import type {
  Agent,
  ChatEvent,
  MemoryItem,
  ModelInfo,
  ProviderStatus,
  ScrapingJob,
  ScrapingResult,
  TaskSummary,
  UsageSummary,
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
 * POST /chat and consume its SSE stream. Parsing is buffered so a chunk boundary
 * can never split an event.
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
          onEvent(JSON.parse(data) as ChatEvent);
        } catch {
          // A malformed event should never take down the stream.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
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

export async function getTasks(limit = 20): Promise<{ tasks: TaskSummary[] }> {
  return apiGet(`/api/v1/tasks?limit=${limit}`);
}

export async function getUsage(): Promise<UsageSummary> {
  return apiGet("/api/v1/usage");
}

export async function getMemories(): Promise<{ memories: MemoryItem[] }> {
  return apiGet("/api/v1/memory");
}

export async function getScrapingJobs(): Promise<{ jobs: ScrapingJob[] }> {
  return apiGet("/api/v1/scraping/jobs");
}

export async function getScrapingJob(
  id: string,
): Promise<{ job: ScrapingJob; results: ScrapingResult[] }> {
  return apiGet(`/api/v1/scraping/jobs/${id}`);
}
