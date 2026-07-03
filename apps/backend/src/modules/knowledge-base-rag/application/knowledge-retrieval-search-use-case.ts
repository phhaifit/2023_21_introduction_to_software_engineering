import {
  KNOWLEDGE_DOCUMENT_SOURCES,
  type KnowledgeEvidenceDto,
  type KnowledgeRetrievalSearchRequest,
  type KnowledgeRetrievalSearchResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { KnowledgeDocumentRepository } from "./knowledge-document-repository.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeRetrievalError
} from "./knowledge-base-rag-errors.ts";

export const MAX_RETRIEVAL_QUERY_LENGTH = 2_000;
export const MAX_RETRIEVAL_TOP_K = 20;
export const DEFAULT_RETRIEVAL_TOP_K = 5;
export const MAX_RETRIEVAL_FILTER_VALUES = 20;
export const MAX_EVIDENCE_SNIPPET_LENGTH = 500;

export type KnowledgeRetrievalQueryEmbeddingPort = {
  generateQueryEmbedding(input: {
    workspaceId: EntityId<"workspaceId">;
    query: string;
  }): Promise<{
    workspaceId: EntityId<"workspaceId">;
    embedding: readonly number[];
  }>;
};

export type KnowledgeRetrievalVectorMatch = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkId: string;
  chunkIndex: number;
  score: number;
  metadata: {
    sourceLocator?: string;
  };
};

export type KnowledgeRetrievalVectorQueryPort = {
  query(input: {
    workspaceId: EntityId<"workspaceId">;
    embedding: readonly number[];
    topK: number;
    documentIds?: readonly EntityId<"documentId">[];
    sourceLocators?: readonly string[];
    sourceTypes?: readonly string[];
    statuses?: readonly string[];
  }): Promise<KnowledgeRetrievalVectorMatch[]>;
};

export type KnowledgeRetrievalSearchDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  queryEmbeddingAdapter: KnowledgeRetrievalQueryEmbeddingPort;
  vectorQueryAdapter: KnowledgeRetrievalVectorQueryPort;
};

type NormalizedRetrievalRequest = {
  query: string;
  topK: number;
  filters: {
    documentIds?: EntityId<"documentId">[];
    sourceTypes?: string[];
    sourceLocators?: string[];
    statuses?: string[];
  };
};

export class KnowledgeRetrievalSearchUseCase {
  private readonly dependencies: KnowledgeRetrievalSearchDependencies;

  constructor(dependencies: KnowledgeRetrievalSearchDependencies) {
    this.dependencies = dependencies;
  }

  async search(
    workspaceId: EntityId<"workspaceId">,
    request: KnowledgeRetrievalSearchRequest
  ): Promise<KnowledgeRetrievalSearchResponse> {
    if (!workspaceId) {
      throw new KnowledgeBaseRagValidationError(["workspaceId is required"]);
    }
    const normalized = normalizeRequest(request);
    const embedding = await this.generateQueryEmbedding(
      workspaceId,
      normalized.query
    );
    const matches = await this.queryVectors(workspaceId, embedding, normalized);
    const results = await this.hydrateEvidence(workspaceId, matches, normalized);

    return {
      results,
      total: results.length
    };
  }

  private async generateQueryEmbedding(
    workspaceId: EntityId<"workspaceId">,
    query: string
  ): Promise<readonly number[]> {
    let result;
    try {
      result = await this.dependencies.queryEmbeddingAdapter.generateQueryEmbedding({
        workspaceId,
        query
      });
    } catch {
      throw new KnowledgeRetrievalError(
        "knowledge.retrieval_embedding_failed",
        "Knowledge retrieval query embedding failed."
      );
    }
    if (
      result.workspaceId !== workspaceId ||
      result.embedding.length === 0 ||
      !result.embedding.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
    ) {
      throw new KnowledgeRetrievalError(
        "knowledge.retrieval_embedding_invalid",
        "Knowledge retrieval query embedding is invalid."
      );
    }
    return result.embedding;
  }

  private async queryVectors(
    workspaceId: EntityId<"workspaceId">,
    embedding: readonly number[],
    request: NormalizedRetrievalRequest
  ): Promise<KnowledgeRetrievalVectorMatch[]> {
    try {
      return await this.dependencies.vectorQueryAdapter.query({
        workspaceId,
        embedding,
        topK: request.topK,
        documentIds: request.filters.documentIds,
        sourceLocators: request.filters.sourceLocators,
        sourceTypes: request.filters.sourceTypes,
        statuses: request.filters.statuses
      });
    } catch {
      throw new KnowledgeRetrievalError(
        "knowledge.retrieval_vector_failed",
        "Knowledge retrieval search failed."
      );
    }
  }

  private async hydrateEvidence(
    workspaceId: EntityId<"workspaceId">,
    matches: readonly KnowledgeRetrievalVectorMatch[],
    request: NormalizedRetrievalRequest
  ): Promise<KnowledgeEvidenceDto[]> {
    const documents = new Map<string, KnowledgeDocument | null>();
    const chunks = new Map<string, KnowledgeDocumentChunk[]>();
    const seenChunks = new Set<string>();
    const evidence: KnowledgeEvidenceDto[] = [];

    try {
      const rankedMatches = [...matches]
        .filter(
          (match) =>
            match.workspaceId === workspaceId &&
            Number.isFinite(match.score) &&
            match.chunkId &&
            Number.isSafeInteger(match.chunkIndex) &&
            match.chunkIndex >= 0
        )
        .sort((left, right) => right.score - left.score);

      for (const match of rankedMatches) {
        if (evidence.length >= request.topK || seenChunks.has(match.chunkId)) {
          continue;
        }
        seenChunks.add(match.chunkId);

        let document = documents.get(match.documentId);
        if (document === undefined) {
          document = await this.dependencies.documentRepository.getDocumentById(
            workspaceId,
            match.documentId
          );
          documents.set(match.documentId, document);
        }
        if (!document || !isEligibleDocument(document, request)) {
          continue;
        }

        let documentChunks = chunks.get(match.documentId);
        if (!documentChunks) {
          const result =
            await this.dependencies.documentRepository.listDocumentChunks(
              workspaceId,
              match.documentId
            );
          documentChunks = result.items;
          chunks.set(match.documentId, documentChunks);
        }
        const chunk = documentChunks.find(
          (candidate) =>
            candidate.chunkId === match.chunkId &&
            candidate.chunkIndex === match.chunkIndex &&
            candidate.workspaceId === workspaceId &&
            candidate.embeddingStatus === "ready"
        );
        if (!chunk || !matchesSourceLocator(chunk, request)) {
          continue;
        }

        const snippet = createSnippet(chunk.contentText);
        if (!snippet) {
          continue;
        }
        const locator = toSafeSourceLocator(chunk.sourceLocator);
        evidence.push({
          evidenceId: `evidence:${document.documentId}:${chunk.chunkId}`,
          rank: evidence.length + 1,
          score: match.score,
          documentId: document.documentId,
          chunkId: chunk.chunkId,
          documentTitle: document.displayName,
          snippet,
          source: {
            type: document.sourceType,
            ...(locator ? { locator } : {})
          },
          metadata: {
            chunkIndex: chunk.chunkIndex
          }
        });
      }
    } catch (error) {
      if (error instanceof KnowledgeRetrievalError) {
        throw error;
      }
      throw new KnowledgeRetrievalError(
        "knowledge.retrieval_hydration_failed",
        "Knowledge retrieval evidence could not be loaded."
      );
    }
    return evidence;
  }
}

function normalizeRequest(
  request: KnowledgeRetrievalSearchRequest
): NormalizedRetrievalRequest {
  const issues: string[] = [];
  if (!request || typeof request.query !== "string") {
    issues.push("query must be a string");
  }
  const query = typeof request?.query === "string" ? request.query.trim() : "";
  if (!query) {
    issues.push("query is required");
  } else if (query.length > MAX_RETRIEVAL_QUERY_LENGTH) {
    issues.push(`query must be at most ${MAX_RETRIEVAL_QUERY_LENGTH} characters`);
  }

  const topK = request?.topK ?? DEFAULT_RETRIEVAL_TOP_K;
  if (!Number.isSafeInteger(topK) || topK < 1 || topK > MAX_RETRIEVAL_TOP_K) {
    issues.push(`topK must be an integer between 1 and ${MAX_RETRIEVAL_TOP_K}`);
  }

  const documentIds = normalizeFilterValues(
    request?.filters?.documentIds,
    "filters.documentIds",
    issues
  ) as EntityId<"documentId">[] | undefined;
  const sourceTypes = normalizeFilterValues(
    request?.filters?.sourceTypes,
    "filters.sourceTypes",
    issues
  );
  if (
    sourceTypes?.some(
      (sourceType) => !KNOWLEDGE_DOCUMENT_SOURCES.includes(sourceType as any)
    )
  ) {
    issues.push("filters.sourceTypes contains an unsupported source type");
  }
  const sourceLocators = normalizeFilterValues(
    request?.filters?.sourceLocators,
    "filters.sourceLocators",
    issues
  );
  if (sourceLocators?.some((locator) => !toSafeSourceLocator(locator))) {
    issues.push("filters.sourceLocators contains an unsafe locator");
  }
  const statuses = normalizeFilterValues(
    request?.filters?.statuses,
    "filters.statuses",
    issues
  );
  if (statuses?.some((status) => status !== "ready")) {
    issues.push("filters.statuses supports only ready");
  }

  if (issues.length > 0) {
    throw new KnowledgeBaseRagValidationError(issues);
  }
  return {
    query,
    topK,
    filters: {
      documentIds,
      sourceTypes,
      sourceLocators,
      statuses: statuses ?? ["ready"]
    }
  };
}

function normalizeFilterValues(
  values: readonly string[] | undefined,
  path: string,
  issues: string[]
): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > MAX_RETRIEVAL_FILTER_VALUES ||
    !values.every((value) => typeof value === "string")
  ) {
    issues.push(
      `${path} must contain between 1 and ${MAX_RETRIEVAL_FILTER_VALUES} values`
    );
    return undefined;
  }
  const normalized = [...new Set(values.map((value) => value.trim()))];
  if (
    normalized.some((value) => !value || value.length > 200) ||
    normalized.length === 0
  ) {
    issues.push(`${path} contains an invalid value`);
    return undefined;
  }
  return normalized;
}

function isEligibleDocument(
  document: KnowledgeDocument,
  request: NormalizedRetrievalRequest
): boolean {
  return (
    !document.deletedAt &&
    document.status === "ready" &&
    document.indexingStatus === "ready" &&
    (!request.filters.documentIds ||
      request.filters.documentIds.includes(document.documentId)) &&
    (!request.filters.sourceTypes ||
      request.filters.sourceTypes.includes(document.sourceType)) &&
    (!request.filters.statuses ||
      request.filters.statuses.includes(document.indexingStatus))
  );
}

function matchesSourceLocator(
  chunk: KnowledgeDocumentChunk,
  request: NormalizedRetrievalRequest
): boolean {
  return (
    !request.filters.sourceLocators ||
    Boolean(
      chunk.sourceLocator &&
        request.filters.sourceLocators.includes(chunk.sourceLocator)
    )
  );
}

function createSnippet(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= MAX_EVIDENCE_SNIPPET_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_EVIDENCE_SNIPPET_LENGTH - 3).trimEnd()}...`;
}

function toSafeSourceLocator(value: string | undefined): string | undefined {
  const locator = value?.trim();
  if (
    !locator ||
    locator.length > 200 ||
    locator.includes("..") ||
    locator.includes("\\") ||
    locator.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(locator) ||
    /^file:/i.test(locator)
  ) {
    return undefined;
  }
  return locator;
}
