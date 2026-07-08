import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentSource } from "@vcp/shared/contracts/knowledge-base-rag.ts";

export type DeletedKnowledgeDocument = {
  documentId: EntityId<"documentId">;
  workspaceId: EntityId<"workspaceId">;
  sourceType: KnowledgeDocumentSource;
  storageKey?: string;
};

export type KnowledgeDocumentDeletionRepository = {
  deleteDocumentCascade(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<DeletedKnowledgeDocument | null>;
};
