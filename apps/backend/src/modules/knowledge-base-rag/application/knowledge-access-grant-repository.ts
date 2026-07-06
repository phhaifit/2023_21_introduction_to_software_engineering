import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeAccessGrant } from "../domain/knowledge-access-grant.ts";

export type KnowledgeAccessGrantRepository = {
  findAccessGrant(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeAccessGrant | null>;
  listActiveDocumentIds(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<EntityId<"documentId">[]>;
  hasActiveDocumentGrant(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<boolean>;
  saveAccessGrant(grant: KnowledgeAccessGrant): Promise<KnowledgeAccessGrant>;
};
