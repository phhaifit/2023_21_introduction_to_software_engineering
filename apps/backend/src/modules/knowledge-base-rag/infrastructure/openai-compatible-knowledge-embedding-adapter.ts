import type {
  KnowledgeEmbeddingAdapter,
  KnowledgeEmbeddingInput,
  KnowledgeEmbeddingResult,
  KnowledgeQueryEmbeddingInput,
  KnowledgeQueryEmbeddingResult
} from "../worker/knowledge-embedding-adapter.ts";

export type OpenAICompatibleKnowledgeEmbeddingConfig = {
  provider: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  batchSize: number;
  timeoutMs: number;
};

export type KnowledgeEmbeddingEnvironment = Partial<
  Record<
    | "KNOWLEDGE_EMBEDDING_PROVIDER"
    | "KNOWLEDGE_EMBEDDING_BASE_URL"
    | "KNOWLEDGE_EMBEDDING_API_KEY"
    | "KNOWLEDGE_EMBEDDING_MODEL"
    | "KNOWLEDGE_EMBEDDING_DIMENSIONS"
    | "KNOWLEDGE_EMBEDDING_BATCH_SIZE"
    | "KNOWLEDGE_EMBEDDING_TIMEOUT_MS",
    string
  >
>;

export type KnowledgeEmbeddingFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export class KnowledgeEmbeddingProviderError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeEmbeddingProviderError";
    this.errorCode = errorCode;
  }
}

export class OpenAICompatibleKnowledgeEmbeddingAdapter
  implements KnowledgeEmbeddingAdapter
{
  private readonly config: OpenAICompatibleKnowledgeEmbeddingConfig;
  private readonly fetchImplementation: KnowledgeEmbeddingFetch;
  private readonly endpoint: URL;

  constructor(
    config: OpenAICompatibleKnowledgeEmbeddingConfig,
    fetchImplementation: KnowledgeEmbeddingFetch = fetch
  ) {
    validateKnowledgeEmbeddingConfig(config);
    this.config = config;
    this.fetchImplementation = fetchImplementation;
    this.endpoint = new URL("embeddings", ensureTrailingSlash(config.baseUrl));
  }

  async generateEmbedding(
    input: KnowledgeEmbeddingInput
  ): Promise<KnowledgeEmbeddingResult> {
    const results = await this.generateEmbeddings([input]);
    return results[0];
  }

  async generateEmbeddings(
    inputs: readonly KnowledgeEmbeddingInput[]
  ): Promise<KnowledgeEmbeddingResult[]> {
    if (inputs.length === 0) {
      return [];
    }
    for (const input of inputs) {
      if (!input.chunkText.trim()) {
        throw new KnowledgeEmbeddingProviderError(
          "knowledge.embedding_input_invalid",
          "Knowledge embedding input must contain text."
        );
      }
    }

    const results: KnowledgeEmbeddingResult[] = [];
    for (let offset = 0; offset < inputs.length; offset += this.config.batchSize) {
      const batch = inputs.slice(offset, offset + this.config.batchSize);
      const embeddings = await this.requestBatch(batch.map((input) => input.chunkText));
      results.push(
        ...batch.map((input, index) => ({
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          embedding: embeddings[index]
        }))
      );
    }
    return results;
  }

  async generateQueryEmbedding(
    input: KnowledgeQueryEmbeddingInput
  ): Promise<KnowledgeQueryEmbeddingResult> {
    const query = input.query.trim();
    if (!input.workspaceId || !query) {
      throw new KnowledgeEmbeddingProviderError(
        "knowledge.embedding_input_invalid",
        "Knowledge embedding input must contain text."
      );
    }
    const [embedding] = await this.requestBatch([query]);
    return {
      workspaceId: input.workspaceId,
      embedding
    };
  }

  private async requestBatch(texts: readonly string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImplementation(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
          dimensions: this.config.dimensions
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new KnowledgeEmbeddingProviderError(
          "knowledge.embedding_provider_failed",
          "Knowledge embedding provider request failed."
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw malformedProviderResponse();
      }
      return parseEmbeddingResponse(payload, texts.length, this.config.dimensions);
    } catch (error) {
      if (error instanceof KnowledgeEmbeddingProviderError) {
        throw error;
      }
      throw new KnowledgeEmbeddingProviderError(
        "knowledge.embedding_provider_unavailable",
        "Knowledge embedding provider is unavailable."
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function readKnowledgeEmbeddingConfig(
  environment: KnowledgeEmbeddingEnvironment
): OpenAICompatibleKnowledgeEmbeddingConfig {
  const provider = environment.KNOWLEDGE_EMBEDDING_PROVIDER?.trim();
  const config = {
    provider,
    baseUrl: environment.KNOWLEDGE_EMBEDDING_BASE_URL?.trim() ?? "",
    apiKey: environment.KNOWLEDGE_EMBEDDING_API_KEY?.trim() ?? "",
    model: environment.KNOWLEDGE_EMBEDDING_MODEL?.trim() ?? "",
    dimensions: parsePositiveInteger(
      environment.KNOWLEDGE_EMBEDDING_DIMENSIONS,
      "KNOWLEDGE_EMBEDDING_DIMENSIONS"
    ),
    batchSize: parsePositiveInteger(
      environment.KNOWLEDGE_EMBEDDING_BATCH_SIZE ?? "32",
      "KNOWLEDGE_EMBEDDING_BATCH_SIZE"
    ),
    timeoutMs: parsePositiveInteger(
      environment.KNOWLEDGE_EMBEDDING_TIMEOUT_MS ?? "30000",
      "KNOWLEDGE_EMBEDDING_TIMEOUT_MS"
    )
  };

  if (provider !== "openai-compatible") {
    throw invalidConfiguration();
  }
  const typedConfig: OpenAICompatibleKnowledgeEmbeddingConfig = {
    ...config,
    provider
  };
  validateKnowledgeEmbeddingConfig(typedConfig);
  return typedConfig;
}

export function createKnowledgeEmbeddingAdapterFromEnvironment(
  environment: KnowledgeEmbeddingEnvironment = process.env,
  fetchImplementation: KnowledgeEmbeddingFetch = fetch
): OpenAICompatibleKnowledgeEmbeddingAdapter {
  return new OpenAICompatibleKnowledgeEmbeddingAdapter(
    readKnowledgeEmbeddingConfig(environment),
    fetchImplementation
  );
}

function validateKnowledgeEmbeddingConfig(
  config: OpenAICompatibleKnowledgeEmbeddingConfig
): void {
  if (
    config.provider !== "openai-compatible" ||
    !config.apiKey ||
    !config.model ||
    !Number.isSafeInteger(config.dimensions) ||
    config.dimensions <= 0 ||
    !Number.isSafeInteger(config.batchSize) ||
    config.batchSize <= 0 ||
    !Number.isSafeInteger(config.timeoutMs) ||
    config.timeoutMs <= 0
  ) {
    throw invalidConfiguration();
  }

  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw invalidConfiguration();
    }
  } catch {
    throw invalidConfiguration();
  }
}

function parsePositiveInteger(value: string | undefined, field: string): number {
  if (!value || !/^\d+$/.test(value.trim())) {
    throw new KnowledgeEmbeddingProviderError(
      "knowledge.embedding_config_invalid",
      `${field} must be a positive integer.`
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new KnowledgeEmbeddingProviderError(
      "knowledge.embedding_config_invalid",
      `${field} must be a positive integer.`
    );
  }
  return parsed;
}

function parseEmbeddingResponse(
  payload: unknown,
  expectedCount: number,
  expectedDimensions: number
): number[][] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw malformedProviderResponse();
  }
  if (payload.data.length !== expectedCount) {
    throw new KnowledgeEmbeddingProviderError(
      "knowledge.embedding_count_mismatch",
      "Knowledge embedding provider returned an unexpected result count."
    );
  }

  const ordered = new Array<number[]>(expectedCount);
  for (const item of payload.data) {
    if (
      !isRecord(item) ||
      !Number.isSafeInteger(item.index) ||
      (item.index as number) < 0 ||
      (item.index as number) >= expectedCount ||
      ordered[item.index as number] !== undefined ||
      !Array.isArray(item.embedding)
    ) {
      throw malformedProviderResponse();
    }
    if (item.embedding.length !== expectedDimensions) {
      throw new KnowledgeEmbeddingProviderError(
        "knowledge.embedding_dimension_mismatch",
        "Knowledge embedding provider returned an unexpected vector dimension."
      );
    }
    if (
      !item.embedding.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
    ) {
      throw malformedProviderResponse();
    }
    ordered[item.index as number] = [...item.embedding] as number[];
  }

  if (ordered.some((embedding) => embedding === undefined)) {
    throw malformedProviderResponse();
  }
  return ordered;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function invalidConfiguration(): KnowledgeEmbeddingProviderError {
  return new KnowledgeEmbeddingProviderError(
    "knowledge.embedding_config_invalid",
    "Knowledge embedding provider configuration is invalid."
  );
}

function malformedProviderResponse(): KnowledgeEmbeddingProviderError {
  return new KnowledgeEmbeddingProviderError(
    "knowledge.embedding_response_invalid",
    "Knowledge embedding provider returned an invalid response."
  );
}
