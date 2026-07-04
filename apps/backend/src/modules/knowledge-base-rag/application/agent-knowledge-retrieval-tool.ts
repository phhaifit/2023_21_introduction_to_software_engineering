import type {
  KnowledgeDocumentSource,
  KnowledgeRetrievalFilters
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeRetrievalError
} from "./knowledge-base-rag-errors.ts";
import type { KnowledgeRetrievalSearchUseCase } from "./knowledge-retrieval-search-use-case.ts";

export const AGENT_KNOWLEDGE_RETRIEVAL_TOOL_NAME = "knowledge.retrieve";
export const MAX_AGENT_TOOL_SNIPPET_LENGTH = 400;

export type AgentKnowledgeRetrievalToolInput = {
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
  query: string;
  topK?: number;
  filters?: Pick<
    KnowledgeRetrievalFilters,
    "documentIds" | "sourceTypes" | "sourceLocators"
  >;
};

export type AgentKnowledgeRetrievalToolEvidence = {
  citationId: string;
  documentId: EntityId<"documentId">;
  documentTitle: string;
  snippet: string;
  score: number;
  sourceType: KnowledgeDocumentSource;
  sourceLocator?: string;
};

export type AgentKnowledgeRetrievalToolResult = {
  status: "found" | "empty" | "unauthorized" | "invalid_request" | "error";
  evidence: AgentKnowledgeRetrievalToolEvidence[];
  warnings: string[];
};

export type AgentKnowledgeRetrievalAgentLookup = {
  existsInWorkspace(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<boolean>;
};

export type AgentKnowledgeRetrievalToolDependencies = {
  retrievalSearchUseCase: Pick<KnowledgeRetrievalSearchUseCase, "search">;
  agentLookup: AgentKnowledgeRetrievalAgentLookup;
};

export class AgentKnowledgeRetrievalTool {
  private readonly dependencies: AgentKnowledgeRetrievalToolDependencies;

  constructor(dependencies: AgentKnowledgeRetrievalToolDependencies) {
    this.dependencies = dependencies;
  }

  async execute(
    input: AgentKnowledgeRetrievalToolInput
  ): Promise<AgentKnowledgeRetrievalToolResult> {
    if (!hasRequiredIdentity(input)) {
      return result(
        "invalid_request",
        "Agent knowledge retrieval input is invalid."
      );
    }

    let agentExists: boolean;
    try {
      agentExists = await this.dependencies.agentLookup.existsInWorkspace(
        input.workspaceId,
        input.agentId
      );
    } catch {
      return result("error", "Agent knowledge access could not be verified.");
    }
    if (!agentExists) {
      return result("unauthorized", "Agent knowledge access is unavailable.");
    }

    try {
      const response = await this.dependencies.retrievalSearchUseCase.search(
        input.workspaceId,
        {
          query: input.query,
          topK: input.topK,
          filters: input.filters
        },
        { agentId: input.agentId }
      );
      if (response.results.length === 0) {
        return result("empty");
      }

      return {
        status: "found",
        evidence: response.results.map((item, index) => ({
          citationId: `E${index + 1}`,
          documentId: item.documentId,
          documentTitle: item.documentTitle,
          snippet: item.snippet.slice(0, MAX_AGENT_TOOL_SNIPPET_LENGTH),
          score: item.score,
          sourceType: item.source.type,
          ...(item.source.locator
            ? { sourceLocator: item.source.locator }
            : {})
        })),
        warnings: []
      };
    } catch (error) {
      if (error instanceof KnowledgeBaseRagValidationError) {
        return result(
          "invalid_request",
          "Agent knowledge retrieval input is invalid."
        );
      }
      if (error instanceof KnowledgeRetrievalError) {
        return result("error", "Agent knowledge retrieval is unavailable.");
      }
      return result("error", "Agent knowledge retrieval is unavailable.");
    }
  }
}

function hasRequiredIdentity(
  input: AgentKnowledgeRetrievalToolInput
): boolean {
  return Boolean(
    input &&
      typeof input.workspaceId === "string" &&
      input.workspaceId.trim() &&
      typeof input.agentId === "string" &&
      input.agentId.trim() &&
      typeof input.query === "string"
  );
}

function result(
  status: AgentKnowledgeRetrievalToolResult["status"],
  warning?: string
): AgentKnowledgeRetrievalToolResult {
  return {
    status,
    evidence: [],
    warnings: warning ? [warning] : []
  };
}
