import type {
  AgentDraftValidationWarning,
  AgentSkillKnowledgeReference,
  AgentSkillToolReference
} from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type ConnectedToolCatalogEntry = {
  toolId: EntityId<"toolId">;
  name: string;
  connected: boolean;
  available: boolean;
};

export type KnowledgeDocumentCatalogEntry = {
  documentId: EntityId<"documentId">;
  title: string;
  ready: boolean;
  status: "ready" | "pending" | "ingesting" | "failed" | "unavailable";
};

export type ConnectedToolCatalogPort = {
  listConnectedTools(workspaceId: EntityId<"workspaceId">): Promise<ConnectedToolCatalogEntry[]>;
};

export type KnowledgeDocumentCatalogPort = {
  listKnowledgeDocuments(
    workspaceId: EntityId<"workspaceId">
  ): Promise<KnowledgeDocumentCatalogEntry[]>;
};

export class MockConnectedToolCatalog implements ConnectedToolCatalogPort {
  private readonly entries: readonly ConnectedToolCatalogEntry[];

  constructor(entries: readonly ConnectedToolCatalogEntry[] = DEMO_CONNECTED_TOOL_CATALOG) {
    this.entries = entries.map((entry) => ({ ...entry }));
  }

  async listConnectedTools(_workspaceId: EntityId<"workspaceId">): Promise<ConnectedToolCatalogEntry[]> {
    return this.entries.map((entry) => ({ ...entry }));
  }
}

export class MockKnowledgeDocumentCatalog implements KnowledgeDocumentCatalogPort {
  private readonly entries: readonly KnowledgeDocumentCatalogEntry[];

  constructor(entries: readonly KnowledgeDocumentCatalogEntry[] = DEMO_KNOWLEDGE_DOCUMENT_CATALOG) {
    this.entries = entries.map((entry) => ({ ...entry }));
  }

  async listKnowledgeDocuments(
    _workspaceId: EntityId<"workspaceId">
  ): Promise<KnowledgeDocumentCatalogEntry[]> {
    return this.entries.map((entry) => ({ ...entry }));
  }
}

export const DEMO_CONNECTED_TOOL_CATALOG: readonly ConnectedToolCatalogEntry[] = [
  {
    toolId: "tool-slack" as EntityId<"toolId">,
    name: "Slack",
    connected: true,
    available: true
  },
  {
    toolId: "tool-email" as EntityId<"toolId">,
    name: "Email",
    connected: true,
    available: true
  },
  {
    toolId: "tool-crm" as EntityId<"toolId">,
    name: "CRM",
    connected: false,
    available: true
  }
] as const;

export const DEMO_KNOWLEDGE_DOCUMENT_CATALOG: readonly KnowledgeDocumentCatalogEntry[] = [
  {
    documentId: "document-support-handbook" as EntityId<"documentId">,
    title: "Support Handbook",
    ready: true,
    status: "ready"
  },
  {
    documentId: "document-product-faq" as EntityId<"documentId">,
    title: "Product FAQ",
    ready: true,
    status: "ready"
  },
  {
    documentId: "document-draft-policy" as EntityId<"documentId">,
    title: "Draft Policy",
    ready: false,
    status: "pending"
  }
] as const;

export async function validateRequestedCapabilities(
  input: {
    workspaceId: EntityId<"workspaceId">;
    requestedTools?: readonly AgentSkillToolReference[];
    requestedKnowledge?: readonly AgentSkillKnowledgeReference[];
  },
  catalogs: {
    tools: ConnectedToolCatalogPort;
    knowledge: KnowledgeDocumentCatalogPort;
  }
): Promise<AgentDraftValidationWarning[]> {
  const warnings: AgentDraftValidationWarning[] = [];

  if (input.requestedTools?.length) {
    const tools = await catalogs.tools.listConnectedTools(input.workspaceId);
    for (const request of input.requestedTools) {
      const match = findTool(tools, request);
      if (!match) {
        warnings.push(blockingWarning(
          "tool.missing",
          `Requested tool "${request.name}" is not connected in this workspace.`,
          "requestedTools"
        ));
      } else if (!match.connected || !match.available) {
        warnings.push(blockingWarning(
          "tool.disconnected",
          `Requested tool "${request.name}" is disconnected or unavailable in this workspace.`,
          "requestedTools"
        ));
      }
    }
  }

  if (input.requestedKnowledge?.length) {
    const documents = await catalogs.knowledge.listKnowledgeDocuments(input.workspaceId);
    for (const request of input.requestedKnowledge) {
      const match = findKnowledgeDocument(documents, request);
      if (!match) {
        warnings.push(blockingWarning(
          "knowledge.missing",
          `Requested knowledge "${request.title}" is not available in this workspace.`,
          "requestedKnowledge"
        ));
      } else if (!match.ready) {
        warnings.push(blockingWarning(
          "knowledge.unready",
          `Requested knowledge "${request.title}" is ${match.status} and not ready for retrieval.`,
          "requestedKnowledge"
        ));
      }
    }
  }

  return warnings;
}

function findTool(
  tools: readonly ConnectedToolCatalogEntry[],
  request: AgentSkillToolReference
): ConnectedToolCatalogEntry | undefined {
  return tools.find((tool) => {
    if (request.toolId && tool.toolId === request.toolId) {
      return true;
    }
    return normalizeName(tool.name) === normalizeName(request.name);
  });
}

function findKnowledgeDocument(
  documents: readonly KnowledgeDocumentCatalogEntry[],
  request: AgentSkillKnowledgeReference
): KnowledgeDocumentCatalogEntry | undefined {
  return documents.find((document) => {
    if (request.documentId && document.documentId === request.documentId) {
      return true;
    }
    return normalizeName(document.title) === normalizeName(request.title);
  });
}

function blockingWarning(
  code: string,
  message: string,
  field: "requestedTools" | "requestedKnowledge"
): AgentDraftValidationWarning {
  return {
    code,
    message,
    severity: "blocking",
    field
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
