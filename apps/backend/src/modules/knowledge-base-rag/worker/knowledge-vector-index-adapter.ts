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

export type KnowledgeVectorIndexAdapter = {
  upsertChunkEmbedding(
    input: KnowledgeVectorIndexInput
  ): Promise<KnowledgeVectorIndexResult>;
};
