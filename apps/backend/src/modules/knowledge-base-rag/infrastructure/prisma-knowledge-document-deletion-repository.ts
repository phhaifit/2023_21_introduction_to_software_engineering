import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

import type {
  DeletedKnowledgeDocument,
  KnowledgeDocumentDeletionRepository
} from "../application/knowledge-document-deletion-repository.ts";
import { toKnowledgeDocumentDomain } from "./prisma-knowledge-base-rag-mapper.ts";

export class PrismaKnowledgeDocumentDeletionRepository
  implements KnowledgeDocumentDeletionRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async deleteDocumentCascade(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<DeletedKnowledgeDocument | null> {
    const document = await this.prisma.document.findFirst({
      where: { workspaceId, documentId }
    });
    if (!document) return null;

    const domainDocument = toKnowledgeDocumentDomain(document);
    const ingestionJobs = await this.prisma.knowledgeIngestionJob.findMany({
      where: { workspaceId, documentId },
      select: { jobId: true }
    });
    const ingestionJobIds = ingestionJobs.map((job) => job.jobId);

    await this.prisma.$transaction(async (transaction) => {
      if (ingestionJobIds.length > 0) {
        await transaction.knowledgeRuntimeJob.deleteMany({
          where: {
            workspaceId,
            kind: "document-ingestion",
            targetJobId: { in: ingestionJobIds }
          }
        });
      }
      await transaction.knowledgeAccessGrant.deleteMany({
        where: { workspaceId, documentId }
      });
      await transaction.knowledgeIndex.deleteMany({
        where: { workspaceId, documentId }
      });
      await transaction.knowledgeDocumentChunk.deleteMany({
        where: { workspaceId, documentId }
      });
      await transaction.knowledgeIngestionJob.deleteMany({
        where: { workspaceId, documentId }
      });
      await transaction.document.delete({
        where: { documentId }
      });
    });

    return {
      documentId,
      workspaceId,
      sourceType: domainDocument.sourceType,
      storageKey: domainDocument.storageKey
    };
  }
}
