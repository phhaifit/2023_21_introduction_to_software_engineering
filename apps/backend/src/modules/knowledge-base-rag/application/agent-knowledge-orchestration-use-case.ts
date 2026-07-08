import type {
  AgentKnowledgeAskRequest,
  AgentKnowledgeAskResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE,
  isKnowledgeEvidenceAnswerable,
  selectMostRelevantEvidenceSentence
} from "./knowledge-answerability.ts";
import type {
  AgentKnowledgeRetrievalTool,
  AgentKnowledgeRetrievalToolEvidence
} from "./agent-knowledge-retrieval-tool.ts";

export const AGENT_KNOWLEDGE_INSUFFICIENT_EVIDENCE_ANSWER =
  "I could not find enough information in this agent's assigned knowledge documents to answer reliably.";
export const MAX_AGENT_ORCHESTRATION_ANSWER_LENGTH = 1_200;
export const MIN_AGENT_KNOWLEDGE_EVIDENCE_SCORE =
  DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE;

export type AgentGroundedResponseComposer = {
  compose(input: {
    message: string;
    evidence: readonly AgentKnowledgeRetrievalToolEvidence[];
  }): Promise<string>;
};

export type AgentKnowledgeOrchestrationDependencies = {
  knowledgeRetrievalTool: Pick<AgentKnowledgeRetrievalTool, "execute">;
  responseComposer?: AgentGroundedResponseComposer;
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
    const retrieval = await this.dependencies.knowledgeRetrievalTool.execute({
      workspaceId,
      agentId,
      query: request.message,
      topK: request.topK,
      filters: request.filters
    });

    if (retrieval.status !== "found") {
      return {
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
    }

    const relevantEvidence = retrieval.evidence.filter((item) =>
      isKnowledgeEvidenceAnswerable({
        query: request.message,
        evidenceTitle: item.documentTitle,
        evidenceText: item.snippet,
        score: item.score,
        minScore: MIN_AGENT_KNOWLEDGE_EVIDENCE_SCORE
      })
    );
    if (relevantEvidence.length === 0) {
      return insufficientEvidenceResponse();
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
        return insufficientEvidenceResponse();
      }

      return {
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
    } catch {
      return safeError();
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
