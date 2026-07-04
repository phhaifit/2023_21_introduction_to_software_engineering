import type { KnowledgeAccessGrant as PrismaKnowledgeAccessGrant, PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeAccessGrantRepository } from "../application/knowledge-access-grant-repository.ts";
import type { KnowledgeAccessGrant } from "../domain/knowledge-access-grant.ts";

export class PrismaKnowledgeAccessGrantRepository
  implements KnowledgeAccessGrantRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findAccessGrant(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeAccessGrant | null> {
    const record = await this.prisma.knowledgeAccessGrant.findUnique({
      where: {
        workspaceId_documentId_agentId: {
          workspaceId,
          documentId,
          agentId
        }
      }
    });
    return record ? toDomain(record) : null;
  }

  async listActiveDocumentIds(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<EntityId<"documentId">[]> {
    const records = await this.prisma.knowledgeAccessGrant.findMany({
      where: { workspaceId, agentId, status: "active" },
      select: { documentId: true },
      orderBy: { documentId: "asc" }
    });
    return records.map(
      (record) => record.documentId as EntityId<"documentId">
    );
  }

  async hasActiveDocumentGrant(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<boolean> {
    const record = await this.prisma.knowledgeAccessGrant.findFirst({
      where: { workspaceId, agentId, documentId, status: "active" },
      select: { knowledgeAccessGrantId: true }
    });
    return Boolean(record);
  }

  async saveAccessGrant(
    grant: KnowledgeAccessGrant
  ): Promise<KnowledgeAccessGrant> {
    const data = {
      knowledgeAccessGrantId: grant.knowledgeAccessGrantId,
      workspaceId: grant.workspaceId,
      documentId: grant.documentId,
      agentId: grant.agentId,
      status: grant.status,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt
    };
    const record = await this.prisma.knowledgeAccessGrant.upsert({
      where: {
        workspaceId_documentId_agentId: {
          workspaceId: grant.workspaceId,
          documentId: grant.documentId,
          agentId: grant.agentId
        }
      },
      create: data,
      update: {
        status: grant.status,
        updatedAt: grant.updatedAt
      }
    });
    return toDomain(record);
  }
}

function toDomain(record: PrismaKnowledgeAccessGrant): KnowledgeAccessGrant {
  return {
    knowledgeAccessGrantId: record.knowledgeAccessGrantId,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    documentId: record.documentId as EntityId<"documentId">,
    agentId: record.agentId as EntityId<"agentId">,
    status: record.status === "active" ? "active" : "revoked",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
