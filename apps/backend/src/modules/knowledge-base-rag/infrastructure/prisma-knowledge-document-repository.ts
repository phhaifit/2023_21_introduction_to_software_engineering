import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDocumentListFilters,
  KnowledgeDocumentListResult,
  KnowledgeDocumentRepository
} from "../application/knowledge-document-repository.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import {
  toKnowledgeDocumentChunkDomain,
  toKnowledgeDocumentChunkPrisma,
  toKnowledgeDocumentDomain,
  toKnowledgeDocumentPrisma
} from "./prisma-knowledge-base-rag-mapper.ts";

export class PrismaKnowledgeDocumentRepository implements KnowledgeDocumentRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listDocuments(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDocumentListFilters = {}
  ): Promise<KnowledgeDocumentListResult> {
    const where = this.buildDocumentWhere(workspaceId, filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const [total, records] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: records.map(toKnowledgeDocumentDomain),
      total
    };
  }

  async getDocumentById(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeDocument | null> {
    const record = await this.prisma.document.findFirst({
      where: { workspaceId, documentId }
    });

    return record ? toKnowledgeDocumentDomain(record) : null;
  }

  async saveDocument(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    const data = toKnowledgeDocumentPrisma(document);
    const record = await this.prisma.document.upsert({
      where: { documentId: document.documentId },
      create: data,
      update: data
    });

    return toKnowledgeDocumentDomain(record);
  }

  async listDocumentChunks(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ) {
    const where = { workspaceId, documentId };
    const [total, records] = await Promise.all([
      this.prisma.knowledgeDocumentChunk.count({ where }),
      this.prisma.knowledgeDocumentChunk.findMany({
        where,
        orderBy: { chunkIndex: "asc" }
      })
    ]);

    return {
      items: records.map(toKnowledgeDocumentChunkDomain),
      total
    };
  }

  async saveDocumentChunk(
    chunk: KnowledgeDocumentChunk
  ): Promise<KnowledgeDocumentChunk> {
    const data = toKnowledgeDocumentChunkPrisma(chunk);
    const record = await this.prisma.knowledgeDocumentChunk.upsert({
      where: { chunkId: chunk.chunkId },
      create: data,
      update: data
    });

    return toKnowledgeDocumentChunkDomain(record);
  }

  private buildDocumentWhere(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDocumentListFilters
  ) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.statuses && filters.statuses.length > 0) {
      where.indexingStatus = { in: [...filters.statuses] };
    }

    if (filters.sourceId) {
      where.sourceId = filters.sourceId;
    }

    if (filters.search) {
      where.OR = [
        { displayName: { contains: filters.search, mode: "insensitive" } },
        { fileName: { contains: filters.search, mode: "insensitive" } }
      ];
    }

    return where;
  }
}
