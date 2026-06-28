import {
  LlmAgentDraftingService,
  LlmProviderFailure,
  type LlmAgentDraftProvider,
  type LlmAgentDraftingPort,
  type LlmAgentDraftingProviderInput
} from "../application/llm-agent-drafting-port.ts";

export const DEFAULT_GEMINI_MODEL_ID = "gemini-2.5-flash";
export const DEFAULT_OPENROUTER_MODEL_ID = "openrouter/owl-alpha";

type FetchImplementation = typeof fetch;

export type LlmProviderAdapterOptions = {
  apiKey?: string;
  modelId?: string;
  endpoint?: string;
  requestTimeoutMs?: number;
  fetchImplementation?: FetchImplementation;
};

export class GeminiAgentDraftProvider implements LlmAgentDraftProvider {
  readonly providerId = "gemini";
  readonly modelId: string;
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: LlmProviderAdapterOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.modelId = options.modelId?.trim() || DEFAULT_GEMINI_MODEL_ID;
    this.endpoint =
      options.endpoint?.trim() || "https://generativelanguage.googleapis.com/v1beta/models";
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  }

  async generateStructuredDraft(input: LlmAgentDraftingProviderInput): Promise<unknown> {
    if (!this.apiKey) {
      throw new LlmProviderFailure("missing_api_key");
    }

    const prompt = buildAgentDraftPrompt(input);
    const url = `${this.endpoint}/${encodeURIComponent(this.modelId)}:generateContent?key=${encodeURIComponent(
      this.apiKey
    )}`;
    const response = await safeFetch(this.fetchImplementation, url, this.requestTimeoutMs, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const payload = await readJsonResponse(response);
    const text = readGeminiText(payload);
    return parseStructuredJsonText(text);
  }
}

export class OpenRouterAgentDraftProvider implements LlmAgentDraftProvider {
  readonly providerId = "openrouter";
  readonly modelId: string;
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: LlmProviderAdapterOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.modelId = options.modelId?.trim() || DEFAULT_OPENROUTER_MODEL_ID;
    this.endpoint = options.endpoint?.trim() || "https://openrouter.ai/api/v1/chat/completions";
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  }

  async generateStructuredDraft(input: LlmAgentDraftingProviderInput): Promise<unknown> {
    if (!this.apiKey) {
      throw new LlmProviderFailure("missing_api_key");
    }

    const prompt = buildAgentDraftPrompt(input);
    const response = await safeFetch(this.fetchImplementation, this.endpoint, this.requestTimeoutMs, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [
          {
            role: "system",
            content: "Return only valid JSON that matches the requested agent draft schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const payload = await readJsonResponse(response);
    const text = readOpenRouterText(payload);
    return parseStructuredJsonText(text);
  }
}

export function createProductionLlmAgentDraftingService(
  options: {
    env?: Record<string, string | undefined>;
    fetchImplementation?: FetchImplementation;
    requestTimeoutMs?: number;
  } = {}
): LlmAgentDraftingPort {
  const env = options.env ?? getProcessEnv();
  const providers: LlmAgentDraftProvider[] = [
    new GeminiAgentDraftProvider({
      apiKey: env.GEMINI_API_KEY,
      modelId: env.GEMINI_MODEL_ID || DEFAULT_GEMINI_MODEL_ID,
      fetchImplementation: options.fetchImplementation,
      requestTimeoutMs: options.requestTimeoutMs
    }),
    new OpenRouterAgentDraftProvider({
      apiKey: env.OPENROUTER_API_KEY,
      modelId: env.OPENROUTER_MODEL_ID || DEFAULT_OPENROUTER_MODEL_ID,
      fetchImplementation: options.fetchImplementation,
      requestTimeoutMs: options.requestTimeoutMs
    })
  ];

  return new LlmAgentDraftingService(providers);
}

export function buildAgentDraftPrompt(input: LlmAgentDraftingProviderInput): string {
  const schema = `{
  "draft": {
    "name": "string",
    "role": "string",
    "model": "string",
    "instructions": "string",
    "responsibilities": ["string"],
    "operatingContext": "string",
    "requestedTools": [{ "toolId": "string optional", "name": "string", "reason": "string optional" }],
    "requestedKnowledge": [{ "documentId": "string optional", "title": "string", "reason": "string optional" }],
    "constraints": ["string"],
    "escalationRules": ["string"],
    "exampleTasks": ["string"],
    "warnings": [{ "code": "string", "message": "string", "severity": "blocking|advisory", "field": "string optional" }],
    "clarifyingQuestions": ["string"]
  },
  "warnings": [{ "code": "string", "message": "string", "severity": "blocking|advisory", "field": "string optional" }],
  "clarifyingQuestions": ["string"]
}`;

  if (input.source === "skill-import") {
    return [
      "Extract an agent creation draft from this skill.md Markdown artifact.",
      "Use only information present in the Markdown. Add advisory or blocking warnings for missing or ambiguous fields.",
      "Return JSON matching this schema:",
      schema,
      `Workspace: ${input.workspaceId}`,
      `File name: ${input.fileName ?? "skill.md"}`,
      "Markdown:",
      input.markdown
    ].join("\n\n");
  }

  return [
    "Create an agent creation draft from the user's request.",
    "Prefer model gemini-2.5-flash unless the request explicitly needs another enabled model.",
    "Do not invent connected tool IDs or knowledge document IDs. Use names without IDs when unsure and add warnings.",
    "Return JSON matching this schema:",
    schema,
    `Workspace: ${input.workspaceId}`,
    "User request:",
    input.prompt
  ].join("\n\n");
}

export function parseStructuredJsonText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new LlmProviderFailure("empty_provider_response");
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        throw new LlmProviderFailure("invalid_json_response");
      }
    }

    throw new LlmProviderFailure("invalid_json_response");
  }
}

async function safeFetch(
  fetchImplementation: FetchImplementation,
  url: string,
  requestTimeoutMs: number,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetchImplementation(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new LlmProviderFailure("provider_http_error");
    }

    return response;
  } catch (error) {
    if (error instanceof LlmProviderFailure) {
      throw error;
    }

    throw new LlmProviderFailure(controller.signal.aborted ? "provider_timeout" : "provider_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new LlmProviderFailure("invalid_provider_json");
  }
}

function readGeminiText(payload: unknown): string {
  const object = readObject(payload);
  const candidates = object.candidates;
  if (!Array.isArray(candidates)) {
    throw new LlmProviderFailure("missing_provider_text");
  }

  const firstCandidate = readObject(candidates[0]);
  const content = readObject(firstCandidate.content);
  const parts = content.parts;
  if (!Array.isArray(parts)) {
    throw new LlmProviderFailure("missing_provider_text");
  }

  return parts
    .map((part) => {
      const partObject = readObject(part);
      return typeof partObject.text === "string" ? partObject.text : "";
    })
    .join("")
    .trim();
}

function readOpenRouterText(payload: unknown): string {
  const object = readObject(payload);
  const choices = object.choices;
  if (!Array.isArray(choices)) {
    throw new LlmProviderFailure("missing_provider_text");
  }

  const firstChoice = readObject(choices[0]);
  const message = readObject(firstChoice.message);
  if (typeof message.content !== "string") {
    throw new LlmProviderFailure("missing_provider_text");
  }

  return message.content;
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LlmProviderFailure("malformed_provider_response");
  }

  return value as Record<string, unknown>;
}

function getProcessEnv(): Record<string, string | undefined> {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};
}
