import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type KnowledgeFileStorageInput = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  fileName: string;
  mediaType: string;
  content: Uint8Array;
};

export type StoredKnowledgeFile = {
  storageKey: string;
  contentHash: string;
  sizeBytes: number;
};

export type KnowledgeFileStorage = {
  store(input: KnowledgeFileStorageInput): Promise<StoredKnowledgeFile>;
  remove(storageKey: string): Promise<void>;
};
