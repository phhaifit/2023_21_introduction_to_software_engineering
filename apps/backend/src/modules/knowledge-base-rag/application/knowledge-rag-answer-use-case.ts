import type {
  KnowledgeEvidenceDto,
  KnowledgeRagAnswerCitationDto,
  KnowledgeRagAnswerRequest,
  KnowledgeRagAnswerResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeRetrievalSearchUseCase } from "./knowledge-retrieval-search-use-case.ts";
import {
  DEFAULT_RETRIEVAL_TOP_K,
  MAX_RETRIEVAL_QUERY_LENGTH,
  MAX_RETRIEVAL_TOP_K
} from "./knowledge-retrieval-search-use-case.ts";
import type { KnowledgeRagAnswerProvider } from "./knowledge-rag-answer-provider.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeRagAnswerError
} from "./knowledge-base-rag-errors.ts";

export const DEFAULT_RAG_MAX_ANSWER_LENGTH = 1_200;
export const MIN_RAG_MAX_ANSWER_LENGTH = 100;
export const MAX_RAG_MAX_ANSWER_LENGTH = 4_000;
export const MIN_RAG_EVIDENCE_SCORE = 0.5;

const INSUFFICIENT_EVIDENCE_ANSWER =
  "I could not find enough information in the workspace knowledge base to answer this reliably.";
const PROVIDER_ERROR_ANSWER =
  "I could not generate a reliable answer from the available workspace evidence.";

export type KnowledgeRagAnswerDependencies = {
  retrievalSearchUseCase: Pick<KnowledgeRetrievalSearchUseCase, "search">;
  answerProvider: KnowledgeRagAnswerProvider;
  generateAnswerId: () => string;
};

type NormalizedRequest = {
  query: string;
  topK: number;
  filters: KnowledgeRagAnswerRequest["filters"];
  maxAnswerLength: number;
  includeCitations: boolean;
};

export class KnowledgeRagAnswerUseCase {
  private readonly dependencies: KnowledgeRagAnswerDependencies;

  constructor(dependencies: KnowledgeRagAnswerDependencies) {
    this.dependencies = dependencies;
  }

  async answer(
    workspaceId: EntityId<"workspaceId">,
    request: KnowledgeRagAnswerRequest
  ): Promise<KnowledgeRagAnswerResponse> {
    if (!workspaceId) {
      throw new KnowledgeBaseRagValidationError(["workspaceId is required"]);
    }
    const normalized = normalizeRequest(request);
    const answerId = this.dependencies.generateAnswerId();
    if (!answerId || typeof answerId !== "string") {
      throw new KnowledgeRagAnswerError(
        "knowledge.rag_answer_id_failed",
        "Knowledge answer generation is temporarily unavailable."
      );
    }

    let retrieval;
    try {
      retrieval = await this.dependencies.retrievalSearchUseCase.search(workspaceId, {
        query: normalized.query,
        topK: normalized.topK,
        filters: normalized.filters
      });
    } catch {
      throw new KnowledgeRagAnswerError(
        "knowledge.rag_retrieval_failed",
        "Knowledge evidence retrieval failed."
      );
    }

    const evidence = retrieval.results.filter(isSufficientEvidence);
    if (evidence.length === 0) {
      return createFallback(
        answerId,
        "insufficient_evidence",
        INSUFFICIENT_EVIDENCE_ANSWER,
        "insufficient_evidence"
      );
    }

    const providerEvidence = evidence.map((item, index) => ({
      citationId: `E${index + 1}`,
      evidenceId: item.evidenceId,
      documentTitle: item.documentTitle,
      snippet: item.snippet,
      rank: item.rank,
      source: item.source
    }));

    let generated;
    try {
      generated = await this.dependencies.answerProvider.generateAnswer({
        query: normalized.query,
        evidence: providerEvidence,
        maxAnswerLength: normalized.maxAnswerLength
      });
    } catch {
      return {
        ...createFallback(
          answerId,
          "provider_error",
          PROVIDER_ERROR_ANSWER,
          "provider_error"
        ),
        evidence
      };
    }

    const answer = normalizeAnswer(generated?.answer, normalized.maxAnswerLength);
    if (
      !answer ||
      !Array.isArray(generated?.citationIds) ||
      !generated.citationIds.every((citationId) => typeof citationId === "string")
    ) {
      return {
        ...createFallback(
          answerId,
          "provider_error",
          PROVIDER_ERROR_ANSWER,
          "provider_response_invalid"
        ),
        evidence
      };
    }

    const requestedCitationIds = new Set(generated.citationIds);
    const evidenceByCitationId = new Map(
      providerEvidence.map((item, index) => [item.citationId, evidence[index]])
    );
    let citations = providerEvidence
      .filter((item) => requestedCitationIds.has(item.citationId))
      .map((item) => toCitation(item.citationId, evidenceByCitationId.get(item.citationId)!));
    const warnings: string[] = [];
    let status: KnowledgeRagAnswerResponse["status"] = "answered";

    if (citations.length === 0) {
      citations = [toCitation("E1", evidence[0])];
      status = "answered_with_caution";
      warnings.push("citations_attached_from_evidence");
    }
    if (!normalized.includeCitations) {
      citations = [];
    }

    return {
      answerId,
      status,
      answer,
      citations,
      evidence,
      warnings
    };
  }
}

function normalizeRequest(request: KnowledgeRagAnswerRequest): NormalizedRequest {
  const issues: string[] = [];
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

  const maxAnswerLength =
    request?.answerOptions?.maxAnswerLength ?? DEFAULT_RAG_MAX_ANSWER_LENGTH;
  if (
    !Number.isSafeInteger(maxAnswerLength) ||
    maxAnswerLength < MIN_RAG_MAX_ANSWER_LENGTH ||
    maxAnswerLength > MAX_RAG_MAX_ANSWER_LENGTH
  ) {
    issues.push(
      `answerOptions.maxAnswerLength must be an integer between ${MIN_RAG_MAX_ANSWER_LENGTH} and ${MAX_RAG_MAX_ANSWER_LENGTH}`
    );
  }
  const includeCitations = request?.answerOptions?.includeCitations ?? true;
  if (typeof includeCitations !== "boolean") {
    issues.push("answerOptions.includeCitations must be a boolean");
  }
  if (issues.length > 0) {
    throw new KnowledgeBaseRagValidationError(issues);
  }

  return {
    query,
    topK,
    filters: request.filters,
    maxAnswerLength,
    includeCitations
  };
}

function isSufficientEvidence(evidence: KnowledgeEvidenceDto): boolean {
  return (
    Boolean(evidence.evidenceId) &&
    Boolean(evidence.documentId) &&
    Boolean(evidence.chunkId) &&
    Boolean(evidence.snippet.trim()) &&
    Number.isFinite(evidence.score) &&
    evidence.score >= MIN_RAG_EVIDENCE_SCORE
  );
}

function normalizeAnswer(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function toCitation(
  citationId: string,
  evidence: KnowledgeEvidenceDto
): KnowledgeRagAnswerCitationDto {
  return {
    citationId,
    evidenceId: evidence.evidenceId,
    documentId: evidence.documentId,
    chunkId: evidence.chunkId,
    rank: evidence.rank,
    snippet: evidence.snippet
  };
}

function createFallback(
  answerId: string,
  status: "insufficient_evidence" | "provider_error",
  answer: string,
  warning: string
): KnowledgeRagAnswerResponse {
  return {
    answerId,
    status,
    answer,
    citations: [],
    evidence: [],
    warnings: [warning]
  };
}
