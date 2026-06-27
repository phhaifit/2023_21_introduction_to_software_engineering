import type {
  KnowledgeDocumentDto,
  KnowledgeDocumentSource
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";

export type KnowledgeDocument = {
  documentId: EntityId<"documentId">;
  workspaceId: EntityId<"workspaceId">;
  uploadedByUserId: EntityId<"userId">;
  displayName: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  sourceType: KnowledgeDocumentSource;
  sourceId?: string;
  storageKey?: string;
  contentHash?: string;
  status: KnowledgeIndexStatus;
  ingestionStatus: KnowledgeIndexStatus;
  indexingStatus: KnowledgeIndexStatus;
  chunkCount: number;
  indexedChunkCount: number;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeDocumentChunk = {
  chunkId: string;
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkIndex: number;
  contentText: string;
  contentHash?: string;
  tokenCount?: number;
  embeddingStatus: KnowledgeIndexStatus;
  vectorRef?: string;
  sourceLocator?: string;
  createdAt: string;
  updatedAt: string;
};

export function toKnowledgeDocumentDto(
  document: KnowledgeDocument
): KnowledgeDocumentDto {
  return {
    documentId: document.documentId,
    workspaceId: document.workspaceId,
    name: document.displayName,
    source: document.sourceType,
    mediaType: document.mimeType,
    sizeBytes: document.sizeBytes,
    status: document.indexingStatus,
    chunkCount: document.chunkCount,
    indexedChunkCount: document.indexedChunkCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

