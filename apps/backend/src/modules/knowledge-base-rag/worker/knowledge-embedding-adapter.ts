import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type KnowledgeEmbeddingInput = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkId: string;
  chunkIndex: number;
  chunkText: string;
  metadata: {
    contentHash?: string;
    tokenCount?: number;
    sourceLocator?: string;
  };
};

export type KnowledgeEmbeddingResult = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkId: string;
  chunkIndex: number;
  embedding: readonly number[];
};

export type KnowledgeEmbeddingAdapter = {
  generateEmbedding(input: KnowledgeEmbeddingInput): Promise<KnowledgeEmbeddingResult>;
};
