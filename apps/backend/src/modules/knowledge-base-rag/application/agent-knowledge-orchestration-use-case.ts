import type {
  AgentKnowledgeAskRequest,
  AgentKnowledgeAskResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE,
  explainKnowledgeEvidenceAnswerability,
  type KnowledgeAnswerabilityExplanation,
  selectMostRelevantEvidenceSentence
} from "./knowledge-answerability.ts";
import type {
  AgentKnowledgeRetrievalTool,
  AgentKnowledgeRetrievalToolEvidence
} from "./agent-knowledge-retrieval-tool.ts";

export const AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER =
  "I could not find enough information in this agent's assigned knowledge documents to answer reliably.";
export const KB_RAG_RELEVANCE_GATE_VERSION = "clean-base-ui-align-v2";
export const MAX_AGENT_ORCHESTRATION_ANSWER_LENGTH = 1_200;
export const MIN_AGENT_KNOWLEDGE_EVIDENCE_SCORE =
  DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE;

export type AgentKnowledgeAssignedDocumentSummary = {
  documentId: EntityId<"documentId">;
  documentTitle: string;
};

export type AgentKnowledgeAskDebugResult = {
  version: typeof KB_RAG_RELEVANCE_GATE_VERSION;
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
  query: string;
  assignedDocuments: AgentKnowledgeAssignedDocumentSummary[];
  retrievalStatus: "found" | "empty" | "unauthorized" | "invalid_request" | "error";
  retrievedEvidence: Array<{
    citationId: string;
    documentId: EntityId<"documentId">;
    documentTitle: string;
    score: number;
    sourceType: string;
    snippetPreview: string;
  }>;
  answerability: Array<{
    citationId: string;
    documentId: EntityId<"documentId">;
    documentTitle: string;
    answerable: boolean;
    reason: string;
    score: number;
    minScore: number;
    overlapTerms: string[];
    overlapCount: number;
    overlapRatio: number;
  }>;
  filteredEvidence: Array<{
    citationId: string;
    documentId: EntityId<"documentId">;
    documentTitle: string;
    score: number;
    snippetPreview: string;
  }>;
  finalAnswer: Pick<AgentKnowledgeAskResponse, "status" | "answer" | "warnings">;
  citations: Array<{
    documentId: EntityId<"documentId">;
    documentTitle: string;
  }>;
};

export type AgentGroundedResponseComposer = {
  compose(input: {
    message: string;
    evidence: readonly AgentKnowledgeRetrievalToolEvidence[];
  }): Promise<string>;
};

export type AgentKnowledgeOrchestrationDependencies = {
  knowledgeRetrievalTool: Pick<AgentKnowledgeRetrievalTool, "execute">;
  responseComposer?: AgentGroundedResponseComposer;
  diagnostics?: {
    listAssignedDocuments(
      workspaceId: EntityId<"workspaceId">,
      agentId: EntityId<"agentId">
    ): Promise<AgentKnowledgeAssignedDocumentSummary[]>;
  };
};

export class AgentKnowledgeOrchestrationUseCase {
  private readonly dependencies: AgentKnowledgeOrchestrationDependencies;

  constructor(dependencies: AgentKnowledgeOrchestrationDependencies) {
    this.dependencies = dependencies;
  }

  async ask(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    request: AgentKnowledgeAskRequest
  ): Promise<AgentKnowledgeAskResponse> {
    const result = await this.askWithDebug(workspaceId, agentId, request);
    if (isKbRagTraceEnabled()) {
      logKbRagTrace(result.debug);
    }
    return result.response;
  }

  async debugAsk(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    request: AgentKnowledgeAskRequest
  ): Promise<AgentKnowledgeAskDebugResult> {
    return (await this.askWithDebug(workspaceId, agentId, request)).debug;
  }

  private async askWithDebug(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    request: AgentKnowledgeAskRequest
  ): Promise<{
    response: AgentKnowledgeAskResponse;
    debug: AgentKnowledgeAskDebugResult;
  }> {
    const assignedDocuments = await this.listAssignedDocuments(workspaceId, agentId);
    const retrieval = await this.dependencies.knowledgeRetrievalTool.execute({
      workspaceId,
      agentId,
      query: request.message,
      topK: request.topK,
      filters: request.filters
    });

    if (retrieval.status !== "found") {
      const response = {
        status:
          retrieval.status === "empty"
            ? "insufficient_evidence"
            : retrieval.status,
        answer:
          retrieval.status === "empty"
            ? AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER
            : "",
        citations: [],
        warnings:
          retrieval.status === "empty"
            ? ["insufficient_evidence"]
            : retrieval.warnings
      };
      return {
        response,
        debug: createDebugResult({
          workspaceId,
          agentId,
          query: request.message,
          assignedDocuments,
          retrieval,
          answerability: [],
          relevantEvidence: [],
          response
        })
      };
    }

    const answerability = retrieval.evidence.map((item) => ({
      item,
      explanation: explainKnowledgeEvidenceAnswerability({
        query: request.message,
        evidenceTitle: item.documentTitle,
        evidenceText: item.snippet,
        score: item.score,
        minScore: MIN_AGENT_KNOWLEDGE_EVIDENCE_SCORE
      })
    }));
    const relevantEvidence = answerability
      .filter(({ explanation }) => explanation.answerable)
      .map(({ item }) => item);
    if (relevantEvidence.length === 0) {
      const response = insufficientEvidenceResponse();
      return {
        response,
        debug: createDebugResult({
          workspaceId,
          agentId,
          query: request.message,
          assignedDocuments,
          retrieval,
          answerability,
          relevantEvidence,
          response
        })
      };
    }

    try {
      const composer =
        this.dependencies.responseComposer ??
        new DeterministicAgentGroundedResponseComposer();
      const answer = normalizeAnswer(
        await composer.compose({
          message: request.message,
          evidence: relevantEvidence
        })
      );
      if (!answer) {
        const response = insufficientEvidenceResponse();
        return {
          response,
          debug: createDebugResult({
            workspaceId,
            agentId,
            query: request.message,
            assignedDocuments,
            retrieval,
            answerability,
            relevantEvidence,
            response
          })
        };
      }

      const response = {
        status: "answered",
        answer,
        citations: relevantEvidence.map((item) => ({
          citationId: item.citationId,
          documentId: item.documentId,
          documentTitle: item.documentTitle,
          snippet: item.snippet,
          sourceType: item.sourceType,
          ...(item.sourceLocator
            ? { sourceLocator: item.sourceLocator }
            : {})
        })),
        warnings: retrieval.warnings
      };
      return {
        response,
        debug: createDebugResult({
          workspaceId,
          agentId,
          query: request.message,
          assignedDocuments,
          retrieval,
          answerability,
          relevantEvidence,
          response
        })
      };
    } catch {
      const response = safeError();
      return {
        response,
        debug: createDebugResult({
          workspaceId,
          agentId,
          query: request.message,
          assignedDocuments,
          retrieval,
          answerability,
          relevantEvidence,
          response
        })
      };
    }
  }

  private async listAssignedDocuments(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentKnowledgeAssignedDocumentSummary[]> {
    if (!this.dependencies.diagnostics) {
      return [];
    }
    try {
      return await this.dependencies.diagnostics.listAssignedDocuments(
        workspaceId,
        agentId
      );
    } catch {
      return [];
    }
  }
}

export class DeterministicAgentGroundedResponseComposer
  implements AgentGroundedResponseComposer
{
  async compose(input: {
    message: string;
    evidence: readonly AgentKnowledgeRetrievalToolEvidence[];
  }): Promise<string> {
    const statements = input.evidence
      .map((item) => selectMostRelevantEvidenceSentence(input.message, item.snippet))
      .filter(Boolean);
    return statements.join(" ");
  }
}

function normalizeAnswer(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= MAX_AGENT_ORCHESTRATION_ANSWER_LENGTH
    ? normalized
    : `${normalized
        .slice(0, MAX_AGENT_ORCHESTRATION_ANSWER_LENGTH - 3)
        .trimEnd()}...`;
}

function safeError(): AgentKnowledgeAskResponse {
  return {
    status: "error",
    answer: "",
    citations: [],
    warnings: ["Agent grounded response is unavailable."]
  };
}

function insufficientEvidenceResponse(): AgentKnowledgeAskResponse {
  return {
    status: "insufficient_evidence",
    answer: AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER,
    citations: [],
    warnings: ["insufficient_evidence"]
  };
}

function createDebugResult(input: {
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
  query: string;
  assignedDocuments: AgentKnowledgeAssignedDocumentSummary[];
  retrieval: Awaited<ReturnType<AgentKnowledgeRetrievalTool["execute"]>>;
  answerability: Array<{
    item: AgentKnowledgeRetrievalToolEvidence;
    explanation: KnowledgeAnswerabilityExplanation;
  }>;
  relevantEvidence: readonly AgentKnowledgeRetrievalToolEvidence[];
  response: AgentKnowledgeAskResponse;
}): AgentKnowledgeAskDebugResult {
  return {
    version: KB_RAG_RELEVANCE_GATE_VERSION,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    query: input.query,
    assignedDocuments: input.assignedDocuments,
    retrievalStatus: input.retrieval.status,
    retrievedEvidence: input.retrieval.evidence.map((item) => ({
      citationId: item.citationId,
      documentId: item.documentId,
      documentTitle: item.documentTitle,
      score: item.score,
      sourceType: item.sourceType,
      snippetPreview: previewSnippet(item.snippet)
    })),
    answerability: input.answerability.map(({ item, explanation }) => ({
      citationId: item.citationId,
      documentId: item.documentId,
      documentTitle: item.documentTitle,
      answerable: explanation.answerable,
      reason: explanation.reason,
      score: explanation.score,
      minScore: explanation.minScore,
      overlapTerms: explanation.overlapTerms,
      overlapCount: explanation.overlapCount,
      overlapRatio: Number(explanation.overlapRatio.toFixed(3))
    })),
    filteredEvidence: input.relevantEvidence.map((item) => ({
      citationId: item.citationId,
      documentId: item.documentId,
      documentTitle: item.documentTitle,
      score: item.score,
      snippetPreview: previewSnippet(item.snippet)
    })),
    finalAnswer: {
      status: input.response.status,
      answer: input.response.answer,
      warnings: input.response.warnings
    },
    citations: input.response.citations.map((citation) => ({
      documentId: citation.documentId,
      documentTitle: citation.documentTitle
    }))
  };
}

function previewSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function isKbRagTraceEnabled(): boolean {
  return process.env.KB_RAG_TRACE === "1";
}

function logKbRagTrace(debug: AgentKnowledgeAskDebugResult): void {
  console.info("[KB/RAG trace]", JSON.stringify(debug));
}
