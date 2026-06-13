export type BackboardRequest = {
  prompt: string;
  message: string;
  threadId?: string;
  assistantId?: string;
  metadata?: Record<string, unknown>;
};

export type BackboardResult = {
  provider: "backboard";
  response: string;
  thread_id?: string;
  assistant_id?: string;
  raw?: unknown;
};

type LocalMemoryEvent = {
  type: string;
  question?: string;
  payload?: unknown;
  timestamp: string;
};

const localMemory: LocalMemoryEvent[] = [];

function baseUrl() {
  return (process.env.BACKBOARD_BASE_URL || "https://app.backboard.io/api").replace(/\/$/, "");
}

function apiKey() {
  return process.env.BACKBOARD_API_KEY;
}

function extractText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const data = payload as Record<string, unknown>;
  const candidates = [
    data.content,
    data.response,
    data.answer,
    data.text,
    data.message,
    data.output
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  const nested = data.data || data.result;
  if (nested && typeof nested === "object") return extractText(nested);
  const choices = data.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const text = extractText(choice);
      if (text) return text;
    }
  }
  return undefined;
}

function isGenericBackboardGreeting(text: string) {
  return /^welcome to backboard api\.?$/i.test(text.trim());
}

function extractId(payload: unknown, key: "thread_id" | "assistant_id") {
  if (!payload || typeof payload !== "object") return undefined;
  const data = payload as Record<string, unknown>;
  const direct = data[key] || data[key.replace("_", "")];
  if (typeof direct === "string") return direct;
  const nested = data.data || data.result;
  if (nested && typeof nested === "object") return extractId(nested, key);
  return undefined;
}

async function postJson(url: string, body: Record<string, unknown>) {
  const key = apiKey();
  if (!key) throw new Error("BACKBOARD_API_KEY is not configured");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  }

  return parsed;
}

export async function askBackboard(request: BackboardRequest): Promise<BackboardResult> {
  const assistantId = request.assistantId || process.env.BACKBOARD_ASSISTANT_ID;
  const threadId = request.threadId || process.env.BACKBOARD_THREAD_ID;
  const body = {
    content: request.message,
    system_prompt: request.prompt,
    thread_id: threadId,
    assistant_id: assistantId,
    stream: false,
    memory: "Auto"
  };

  const endpoint = `${baseUrl()}/threads/messages`;
  const payload = await postJson(endpoint, body);
  const responseText = extractText(payload);
  if (!responseText) {
    throw new Error(`${endpoint} -> no response text in ${JSON.stringify(payload)}`);
  }
  if (isGenericBackboardGreeting(responseText)) {
    throw new Error(`${endpoint} -> generic API greeting: ${responseText}`);
  }
  return {
    provider: "backboard",
    response: responseText,
    thread_id: extractId(payload, "thread_id") || threadId,
    assistant_id: extractId(payload, "assistant_id") || assistantId,
    raw: payload
  };
}

export function rememberLocal(event: Omit<LocalMemoryEvent, "timestamp">) {
  const memoryEvent = { ...event, timestamp: new Date().toISOString() };
  localMemory.push(memoryEvent);
  localMemory.splice(0, Math.max(0, localMemory.length - 20));
  return [...localMemory];
}
