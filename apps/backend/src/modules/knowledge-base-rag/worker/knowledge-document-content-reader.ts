import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocument } from "../domain/knowledge-document.ts";

export type KnowledgeDocumentContentReaderInput = {
  workspaceId: EntityId<"workspaceId">;
  document: KnowledgeDocument;
};

export type KnowledgeDocumentContentReader = {
  readText(input: KnowledgeDocumentContentReaderInput): Promise<string>;
};
