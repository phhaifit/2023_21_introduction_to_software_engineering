import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type KnowledgeAccessGrantStatus = "active" | "revoked";

export type KnowledgeAccessGrant = {
  knowledgeAccessGrantId: string;
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  agentId: EntityId<"agentId">;
  status: KnowledgeAccessGrantStatus;
  createdAt: string;
  updatedAt: string;
};
