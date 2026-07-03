import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import { roleHasPermission, type Permission } from "@vcp/shared/contracts/roles.ts";
import type { KnowledgeAccessGrantRepository } from "./knowledge-access-grant-repository.ts";
import { KnowledgeAccessDeniedError } from "./knowledge-base-rag-errors.ts";

export const KNOWLEDGE_USER_ACTIONS = [
  "document:read",
  "document:upload",
  "document:delete",
  "ingestion:read",
  "source:read",
  "source:manage",
  "sync-scope:read",
  "sync-scope:manage",
  "sync:trigger",
  "sync:read",
  "retrieval:search",
  "rag:answer"
] as const;

export type KnowledgeUserAction = (typeof KNOWLEDGE_USER_ACTIONS)[number];

const MANAGEMENT_ACTIONS = new Set<KnowledgeUserAction>([
  "document:upload",
  "document:delete",
  "source:manage",
  "sync-scope:manage",
  "sync:trigger"
]);

export class KnowledgeBaseRagAccessPolicy {
  private readonly accessGrantRepository?: KnowledgeAccessGrantRepository;

  constructor(accessGrantRepository?: KnowledgeAccessGrantRepository) {
    this.accessGrantRepository = accessGrantRepository;
  }

  assertUserCan(role: WorkspaceRole, action: KnowledgeUserAction): void {
    const permission: Permission = MANAGEMENT_ACTIONS.has(action)
      ? "knowledge:manage"
      : "workspace:read";
    if (!roleHasPermission(role, permission)) {
      throw new KnowledgeAccessDeniedError();
    }
  }

  async listAgentDocumentIds(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<EntityId<"documentId">[]> {
    if (!workspaceId || !agentId || !this.accessGrantRepository) {
      return [];
    }
    try {
      const ids = await this.accessGrantRepository.listActiveDocumentIds(
        workspaceId,
        agentId
      );
      return [...new Set(ids)].filter(Boolean);
    } catch {
      throw new KnowledgeAccessDeniedError();
    }
  }

  async assertAgentCanAccessDocument(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<void> {
    if (
      !workspaceId ||
      !agentId ||
      !documentId ||
      !this.accessGrantRepository
    ) {
      throw new KnowledgeAccessDeniedError();
    }
    try {
      if (
        !(await this.accessGrantRepository.hasActiveDocumentGrant(
          workspaceId,
          agentId,
          documentId
        ))
      ) {
        throw new KnowledgeAccessDeniedError();
      }
    } catch {
      throw new KnowledgeAccessDeniedError();
    }
  }
}
