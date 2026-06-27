import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";

export type KnowledgeDocumentListFilters = {
  statuses?: readonly KnowledgeIndexStatus[];
  sourceId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type KnowledgeDocumentListResult = {
  items: KnowledgeDocument[];
  total: number;
};

export type KnowledgeDocumentChunkListResult = {
  items: KnowledgeDocumentChunk[];
  total: number;
};

export type KnowledgeDocumentRepository = {
  listDocuments(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeDocumentListFilters
  ): Promise<KnowledgeDocumentListResult>;
  getDocumentById(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeDocument | null>;
  saveDocument(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  listDocumentChunks(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeDocumentChunkListResult>;
  saveDocumentChunk(chunk: KnowledgeDocumentChunk): Promise<KnowledgeDocumentChunk>;
};

