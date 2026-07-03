import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type KnowledgeVectorIndexInput = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkId: string;
  chunkIndex: number;
  embedding: readonly number[];
  metadata: {
    contentHash?: string;
    tokenCount?: number;
    sourceLocator?: string;
  };
};

export type KnowledgeVectorIndexResult = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkId: string;
  chunkIndex: number;
  vectorRef: string;
};

export type KnowledgeVectorQueryInput = {
  workspaceId: EntityId<"workspaceId">;
  embedding: readonly number[];
  topK: number;
  documentId?: EntityId<"documentId">;
  sourceLocator?: string;
};

export type KnowledgeVectorQueryMatch = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkId: string;
  chunkIndex: number;
  score: number;
  metadata: {
    contentHash?: string;
    tokenCount?: number;
    sourceLocator?: string;
  };
};

export type KnowledgeVectorIndexAdapter = {
  upsertChunkEmbedding(
    input: KnowledgeVectorIndexInput
  ): Promise<KnowledgeVectorIndexResult>;
  upsertChunkEmbeddings?(
    inputs: readonly KnowledgeVectorIndexInput[]
  ): Promise<KnowledgeVectorIndexResult[]>;
  ensureIndex?(): Promise<void>;
  query?(
    input: KnowledgeVectorQueryInput
  ): Promise<KnowledgeVectorQueryMatch[]>;
};
