import type { AgentKnowledgeDocumentDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import type { KnowledgeAccessGrantRepository } from "./knowledge-access-grant-repository.ts";
import type { KnowledgeDocumentRepository } from "./knowledge-document-repository.ts";
import { KnowledgeBaseRagAccessPolicy } from "./knowledge-base-rag-access-policy.ts";
import {
  KnowledgeAccessDeniedError,
  KnowledgeBaseRagValidationError
} from "./knowledge-base-rag-errors.ts";
import { toKnowledgeDocumentDto } from "./dto-mappers.ts";

export type AgentKnowledgeLookupPort = {
  existsInWorkspace(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<boolean>;
};

export type AgentKnowledgeAssignmentUseCaseDependencies = {
  accessGrantRepository: KnowledgeAccessGrantRepository;
  documentRepository: KnowledgeDocumentRepository;
  agentLookup: AgentKnowledgeLookupPort;
  accessPolicy: KnowledgeBaseRagAccessPolicy;
  now: () => string;
  generateGrantId: () => string;
};

export class AgentKnowledgeAssignmentUseCase {
  private readonly dependencies: AgentKnowledgeAssignmentUseCaseDependencies;

  constructor(
    dependencies: AgentKnowledgeAssignmentUseCaseDependencies
  ) {
    this.dependencies = dependencies;
  }

  async listAssignedDocuments(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    role: WorkspaceRole
  ): Promise<AgentKnowledgeDocumentDto[]> {
    this.validateIds(workspaceId, agentId);
    this.dependencies.accessPolicy.assertUserCan(role, "grant:read");
    await this.assertAgentInWorkspace(workspaceId, agentId);

    const documentIds =
      await this.dependencies.accessGrantRepository.listActiveDocumentIds(
        workspaceId,
        agentId
      );
    const documents = await Promise.all(
      documentIds.map((documentId) =>
        this.dependencies.documentRepository.getDocumentById(
          workspaceId,
          documentId
        )
      )
    );

    return documents
      .filter((document) => document !== null && !document.deletedAt)
      .map((document) => ({
        workspaceId,
        agentId,
        document: toKnowledgeDocumentDto(document),
        grantStatus: "active"
      }));
  }

  async assignDocument(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">,
    role: WorkspaceRole
  ): Promise<AgentKnowledgeDocumentDto> {
    this.validateIds(workspaceId, agentId, documentId);
    this.dependencies.accessPolicy.assertUserCan(role, "grant:manage");
    const document = await this.requireScopedResources(
      workspaceId,
      agentId,
      documentId
    );
    const existing =
      await this.dependencies.accessGrantRepository.findAccessGrant(
        workspaceId,
        agentId,
        documentId
      );

    if (!existing || existing.status !== "active") {
      const timestamp = this.dependencies.now();
      await this.dependencies.accessGrantRepository.saveAccessGrant({
        knowledgeAccessGrantId:
          existing?.knowledgeAccessGrantId ??
          this.dependencies.generateGrantId(),
        workspaceId,
        agentId,
        documentId,
        status: "active",
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      });
    }

    return {
      workspaceId,
      agentId,
      document: toKnowledgeDocumentDto(document),
      grantStatus: "active"
    };
  }

  async revokeDocument(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">,
    role: WorkspaceRole
  ): Promise<AgentKnowledgeDocumentDto> {
    this.validateIds(workspaceId, agentId, documentId);
    this.dependencies.accessPolicy.assertUserCan(role, "grant:manage");
    const document = await this.requireScopedResources(
      workspaceId,
      agentId,
      documentId
    );
    const existing =
      await this.dependencies.accessGrantRepository.findAccessGrant(
        workspaceId,
        agentId,
        documentId
      );

    if (existing?.status === "active") {
      await this.dependencies.accessGrantRepository.saveAccessGrant({
        ...existing,
        status: "revoked",
        updatedAt: this.dependencies.now()
      });
    }

    return {
      workspaceId,
      agentId,
      document: toKnowledgeDocumentDto(document),
      grantStatus: "revoked"
    };
  }

  private validateIds(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId?: EntityId<"documentId">
  ): void {
    const issues = [
      !workspaceId ? "workspaceId is required" : null,
      !agentId ? "agentId is required" : null,
      documentId !== undefined && !documentId ? "documentId is required" : null
    ].filter((issue): issue is string => Boolean(issue));
    if (issues.length > 0) {
      throw new KnowledgeBaseRagValidationError(issues);
    }
  }

  private async assertAgentInWorkspace(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<void> {
    if (
      !(await this.dependencies.agentLookup.existsInWorkspace(
        workspaceId,
        agentId
      ))
    ) {
      throw new KnowledgeAccessDeniedError();
    }
  }

  private async requireScopedResources(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ) {
    const [agentExists, document] = await Promise.all([
      this.dependencies.agentLookup.existsInWorkspace(workspaceId, agentId),
      this.dependencies.documentRepository.getDocumentById(
        workspaceId,
        documentId
      )
    ]);
    if (!agentExists || !document || document.deletedAt) {
      throw new KnowledgeAccessDeniedError();
    }
    return document;
  }
}
