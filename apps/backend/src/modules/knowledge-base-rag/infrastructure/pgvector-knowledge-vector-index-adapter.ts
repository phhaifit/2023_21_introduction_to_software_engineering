import { createHash } from "node:crypto";

import type {
  KnowledgeVectorIndexAdapter,
  KnowledgeVectorIndexInput,
  KnowledgeVectorIndexResult,
  KnowledgeVectorQueryInput,
  KnowledgeVectorQueryMatch
} from "../worker/knowledge-vector-index-adapter.ts";

export type PgvectorDistance = "cosine" | "euclidean" | "inner-product";

export type PgvectorKnowledgeVectorConfig = {
  provider: "pgvector";
  dimensions: number;
  distance: PgvectorDistance;
  batchSize: number;
};

export type KnowledgeVectorEnvironment = Partial<
  Record<
    | "KNOWLEDGE_VECTOR_PROVIDER"
    | "KNOWLEDGE_VECTOR_DIMENSIONS"
    | "KNOWLEDGE_VECTOR_DISTANCE"
    | "KNOWLEDGE_VECTOR_BATCH_SIZE",
    string
  >
>;

export type KnowledgeVectorDatabase = {
  $executeRawUnsafe(
    query: string,
    ...values: readonly unknown[]
  ): Promise<number>;
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: readonly unknown[]
  ): Promise<T>;
};

type PgvectorQueryRow = {
  workspaceId: unknown;
  documentId: unknown;
  chunkId: unknown;
  chunkIndex: unknown;
  contentHash: unknown;
  tokenCount: unknown;
  sourceLocator: unknown;
  distance: unknown;
};

export class KnowledgeVectorDatabaseError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeVectorDatabaseError";
    this.errorCode = errorCode;
  }
}

export class PgvectorKnowledgeVectorIndexAdapter
  implements KnowledgeVectorIndexAdapter
{
  private readonly database: KnowledgeVectorDatabase;
  private readonly config: PgvectorKnowledgeVectorConfig;

  constructor(
    database: KnowledgeVectorDatabase,
    config: PgvectorKnowledgeVectorConfig
  ) {
    validateKnowledgeVectorConfig(config);
    this.database = database;
    this.config = config;
  }

  async ensureIndex(): Promise<void> {
    let rows: unknown;
    try {
      rows = await this.database.$queryRawUnsafe(
        `SELECT
          EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
          ) AS "extensionEnabled",
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'knowledge_document_chunks'
              AND column_name = 'embedding'
              AND udt_name = 'vector'
          ) AS "embeddingColumnAvailable"`
      );
    } catch {
      throw databaseUnavailable();
    }

    if (
      !Array.isArray(rows) ||
      rows.length !== 1 ||
      !isRecord(rows[0]) ||
      rows[0].extensionEnabled !== true ||
      rows[0].embeddingColumnAvailable !== true
    ) {
      throw new KnowledgeVectorDatabaseError(
        "knowledge.vector_schema_unavailable",
        "Knowledge vector database schema is unavailable."
      );
    }
  }

  async upsertChunkEmbedding(
    input: KnowledgeVectorIndexInput
  ): Promise<KnowledgeVectorIndexResult> {
    const results = await this.upsertChunkEmbeddings([input]);
    return results[0];
  }

  async upsertChunkEmbeddings(
    inputs: readonly KnowledgeVectorIndexInput[]
  ): Promise<KnowledgeVectorIndexResult[]> {
    if (inputs.length === 0) {
      return [];
    }
    inputs.forEach((input) => this.validateIndexInput(input));

    const results: KnowledgeVectorIndexResult[] = [];
    for (let offset = 0; offset < inputs.length; offset += this.config.batchSize) {
      const batch = inputs.slice(offset, offset + this.config.batchSize);
      const { sql, values, vectorRefs } = createBatchUpsert(batch);
      let updatedCount: number;
      try {
        updatedCount = await this.database.$executeRawUnsafe(sql, ...values);
      } catch {
        throw databaseUnavailable();
      }
      if (updatedCount !== batch.length) {
        throw new KnowledgeVectorDatabaseError(
          "knowledge.vector_upsert_failed",
          "Knowledge chunk vectors could not be persisted."
        );
      }
      results.push(
        ...batch.map((input, index) => ({
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          chunkId: input.chunkId,
          chunkIndex: input.chunkIndex,
          vectorRef: vectorRefs[index]
        }))
      );
    }
    return results;
  }

  async query(
    input: KnowledgeVectorQueryInput
  ): Promise<KnowledgeVectorQueryMatch[]> {
    this.validateQueryInput(input);
    const { sql, values } = createVectorQuery(input, this.config);

    let rows: unknown;
    try {
      rows = await this.database.$queryRawUnsafe(sql, ...values);
    } catch {
      throw databaseUnavailable();
    }
    if (!Array.isArray(rows)) {
      throw malformedDatabaseResult();
    }
    return rows.map((row) => this.toQueryMatch(row, input.workspaceId));
  }

  private validateIndexInput(input: KnowledgeVectorIndexInput): void {
    if (
      !input.workspaceId ||
      !input.documentId ||
      !input.chunkId ||
      !Number.isSafeInteger(input.chunkIndex) ||
      input.chunkIndex < 0
    ) {
      throw invalidInput();
    }
    validateVector(input.embedding, this.config.dimensions);
  }

  private validateQueryInput(input: KnowledgeVectorQueryInput): void {
    if (
      !input.workspaceId ||
      !Number.isSafeInteger(input.topK) ||
      input.topK <= 0 ||
      (input.documentId !== undefined && !input.documentId) ||
      (input.sourceLocator !== undefined && !input.sourceLocator.trim())
    ) {
      throw invalidInput();
    }
    validateVector(input.embedding, this.config.dimensions);
  }

  private toQueryMatch(
    value: unknown,
    workspaceId: KnowledgeVectorQueryInput["workspaceId"]
  ): KnowledgeVectorQueryMatch {
    if (!isQueryRow(value) || value.workspaceId !== workspaceId) {
      throw malformedDatabaseResult();
    }
    const distance = toFiniteNumber(value.distance);
    return {
      workspaceId,
      documentId: value.documentId as KnowledgeVectorQueryMatch["documentId"],
      chunkId: value.chunkId,
      chunkIndex: value.chunkIndex,
      score:
        this.config.distance === "cosine"
          ? 1 - distance
          : -distance,
      metadata: {
        ...(value.contentHash ? { contentHash: value.contentHash } : {}),
        ...(value.tokenCount !== null ? { tokenCount: value.tokenCount } : {}),
        ...(value.sourceLocator ? { sourceLocator: value.sourceLocator } : {})
      }
    };
  }
}

export function readKnowledgeVectorConfig(
  environment: KnowledgeVectorEnvironment
): PgvectorKnowledgeVectorConfig {
  const provider = environment.KNOWLEDGE_VECTOR_PROVIDER?.trim();
  const distance = environment.KNOWLEDGE_VECTOR_DISTANCE?.trim().toLowerCase();
  if (provider !== "pgvector" || !isDistance(distance)) {
    throw invalidConfiguration();
  }

  const config: PgvectorKnowledgeVectorConfig = {
    provider,
    dimensions: parsePositiveInteger(
      environment.KNOWLEDGE_VECTOR_DIMENSIONS,
      "KNOWLEDGE_VECTOR_DIMENSIONS"
    ),
    distance,
    batchSize: parsePositiveInteger(
      environment.KNOWLEDGE_VECTOR_BATCH_SIZE ?? "64",
      "KNOWLEDGE_VECTOR_BATCH_SIZE"
    )
  };
  validateKnowledgeVectorConfig(config);
  return config;
}

export function createKnowledgeVectorIndexAdapterFromEnvironment(
  database: KnowledgeVectorDatabase,
  environment: KnowledgeVectorEnvironment = process.env
): PgvectorKnowledgeVectorIndexAdapter {
  return new PgvectorKnowledgeVectorIndexAdapter(
    database,
    readKnowledgeVectorConfig(environment)
  );
}

function createBatchUpsert(inputs: readonly KnowledgeVectorIndexInput[]): {
  sql: string;
  values: unknown[];
  vectorRefs: string[];
} {
  const values: unknown[] = [];
  const vectorRefs: string[] = [];
  const tuples = inputs.map((input) => {
    const start = values.length + 1;
    const vectorRef = createStableVectorRef(input);
    vectorRefs.push(vectorRef);
    values.push(
      input.workspaceId,
      input.documentId,
      input.chunkId,
      input.chunkIndex,
      toVectorLiteral(input.embedding),
      input.embedding.length,
      vectorRef
    );
    return `($${start}::text, $${start + 1}::text, $${start + 2}::text, $${start + 3}::integer, $${start + 4}::vector, $${start + 5}::integer, $${start + 6}::text)`;
  });

  return {
    sql: `UPDATE "knowledge_document_chunks" AS chunk
      SET "embedding" = input.embedding,
          "embeddingDimensions" = input.dimensions,
          "vectorRef" = input.vector_ref
      FROM (VALUES ${tuples.join(", ")})
        AS input(workspace_id, document_id, chunk_id, chunk_index, embedding, dimensions, vector_ref)
      WHERE chunk."workspaceId" = input.workspace_id
        AND chunk."documentId" = input.document_id
        AND chunk."chunkId" = input.chunk_id
        AND chunk."chunkIndex" = input.chunk_index`,
    values,
    vectorRefs
  };
}

function createVectorQuery(
  input: KnowledgeVectorQueryInput,
  config: PgvectorKnowledgeVectorConfig
): { sql: string; values: unknown[] } {
  const values: unknown[] = [
    toVectorLiteral(input.embedding),
    config.dimensions,
    input.workspaceId
  ];
  const conditions = [
    `chunk."embedding" IS NOT NULL`,
    `chunk."embeddingDimensions" = $2`,
    `chunk."workspaceId" = $3`
  ];
  if (input.documentId) {
    values.push(input.documentId);
    conditions.push(`chunk."documentId" = $${values.length}`);
  }
  if (input.sourceLocator) {
    values.push(input.sourceLocator);
    conditions.push(`chunk."sourceLocator" = $${values.length}`);
  }
  values.push(input.topK);
  const operator = toDistanceOperator(config.distance);

  return {
    sql: `SELECT
        chunk."workspaceId",
        chunk."documentId",
        chunk."chunkId",
        chunk."chunkIndex",
        chunk."contentHash",
        chunk."tokenCount",
        chunk."sourceLocator",
        (chunk."embedding" ${operator} $1::vector) AS distance
      FROM "knowledge_document_chunks" AS chunk
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY chunk."embedding" ${operator} $1::vector ASC
      LIMIT $${values.length}`,
    values
  };
}

function validateKnowledgeVectorConfig(config: PgvectorKnowledgeVectorConfig): void {
  if (
    config.provider !== "pgvector" ||
    !isDistance(config.distance) ||
    !Number.isSafeInteger(config.dimensions) ||
    config.dimensions <= 0 ||
    !Number.isSafeInteger(config.batchSize) ||
    config.batchSize <= 0
  ) {
    throw invalidConfiguration();
  }
}

function validateVector(vector: readonly number[], dimensions: number): void {
  if (
    vector.length !== dimensions ||
    !vector.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new KnowledgeVectorDatabaseError(
      "knowledge.vector_invalid",
      "Knowledge vector has an invalid dimension or value."
    );
  }
}

function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

function toDistanceOperator(distance: PgvectorDistance): string {
  if (distance === "cosine") {
    return "<=>";
  }
  if (distance === "euclidean") {
    return "<->";
  }
  return "<#>";
}

function createStableVectorRef(input: KnowledgeVectorIndexInput): string {
  return createHash("sha256")
    .update(`${input.workspaceId}\0${input.documentId}\0${input.chunkId}`)
    .digest("hex");
}

function isQueryRow(value: unknown): value is PgvectorQueryRow & {
  workspaceId: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  contentHash: string | null;
  tokenCount: number | null;
  sourceLocator: string | null;
} {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.workspaceId === "string" &&
    typeof value.documentId === "string" &&
    Boolean(value.documentId) &&
    typeof value.chunkId === "string" &&
    Boolean(value.chunkId) &&
    Number.isSafeInteger(value.chunkIndex) &&
    (value.chunkIndex as number) >= 0 &&
    isNullableString(value.contentHash) &&
    isNullableInteger(value.tokenCount) &&
    isNullableString(value.sourceLocator)
  );
}

function toFiniteNumber(value: unknown): number {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numberValue)) {
    throw malformedDatabaseResult();
  }
  return numberValue;
}

function parsePositiveInteger(value: string | undefined, field: string): number {
  if (!value || !/^\d+$/.test(value.trim())) {
    throw new KnowledgeVectorDatabaseError(
      "knowledge.vector_config_invalid",
      `${field} must be a positive integer.`
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new KnowledgeVectorDatabaseError(
      "knowledge.vector_config_invalid",
      `${field} must be a positive integer.`
    );
  }
  return parsed;
}

function isDistance(value: unknown): value is PgvectorDistance {
  return (
    value === "cosine" ||
    value === "euclidean" ||
    value === "inner-product"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || Number.isSafeInteger(value);
}

function invalidConfiguration(): KnowledgeVectorDatabaseError {
  return new KnowledgeVectorDatabaseError(
    "knowledge.vector_config_invalid",
    "Knowledge vector database configuration is invalid."
  );
}

function invalidInput(): KnowledgeVectorDatabaseError {
  return new KnowledgeVectorDatabaseError(
    "knowledge.vector_input_invalid",
    "Knowledge vector database input is invalid."
  );
}

function databaseUnavailable(): KnowledgeVectorDatabaseError {
  return new KnowledgeVectorDatabaseError(
    "knowledge.vector_database_unavailable",
    "Knowledge vector database is unavailable."
  );
}

function malformedDatabaseResult(): KnowledgeVectorDatabaseError {
  return new KnowledgeVectorDatabaseError(
    "knowledge.vector_database_result_invalid",
    "Knowledge vector database returned an invalid result."
  );
}
