import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceListFilters,
  KnowledgeDataSourceRepository
} from "../application/knowledge-data-source-repository.ts";
import type { KnowledgeDataSource } from "../domain/knowledge-data-source.ts";
import {
  toKnowledgeDataSourceDomain,
  toKnowledgeDataSourcePrisma
} from "./prisma-knowledge-base-rag-mapper.ts";

export class PrismaKnowledgeDataSourceRepository
  implements KnowledgeDataSourceRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listAllDataSources(
    filters: KnowledgeDataSourceListFilters = {}
  ): Promise<KnowledgeDataSource[]> {
    const records = await this.prisma.knowledgeDataSource.findMany({
      where: this.buildWhere(undefined, filters),
      orderBy: { updatedAt: "desc" }
    });
    return Promise.all(
      records.map(async (record) =>
        toKnowledgeDataSourceDomain(
          record,
          await this.prisma.knowledgeSyncScopeNode.count({
            where: {
              workspaceId: record.workspaceId,
              sourceId: record.sourceId,
              selected: true
            }
          })
        )
      )
    );
  }

  async listDataSources(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDataSourceListFilters = {}
  ): Promise<KnowledgeDataSource[]> {
    const where = this.buildWhere(workspaceId, filters);
    const records = await this.prisma.knowledgeDataSource.findMany({
      where,
      orderBy: { updatedAt: "desc" }
    });

    return Promise.all(
      records.map(async (record) =>
        toKnowledgeDataSourceDomain(
          record,
          await this.prisma.knowledgeSyncScopeNode.count({
            where: { workspaceId, sourceId: record.sourceId, selected: true }
          })
        )
      )
    );
  }

  async getDataSourceById(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<KnowledgeDataSource | null> {
    const record = await this.prisma.knowledgeDataSource.findFirst({
      where: { workspaceId, sourceId }
    });

    if (!record) {
      return null;
    }

    const selectedScopeNodeCount = await this.prisma.knowledgeSyncScopeNode.count({
      where: { workspaceId, sourceId, selected: true }
    });

    return toKnowledgeDataSourceDomain(record, selectedScopeNodeCount);
  }

  async saveDataSource(source: KnowledgeDataSource): Promise<KnowledgeDataSource> {
    const data = toKnowledgeDataSourcePrisma(source);
    const record = await this.prisma.knowledgeDataSource.upsert({
      where: { sourceId: source.sourceId },
      create: data,
      update: data
    });

    return toKnowledgeDataSourceDomain(record, source.selectedScopeNodeCount);
  }

  private buildWhere(
    workspaceId: EntityId<"workspaceId"> | undefined,
    filters: KnowledgeDataSourceListFilters
  ) {
    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;

    if (filters.provider) {
      where.provider = filters.provider;
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.connectionStatus = { in: [...filters.statuses] };
    }

    return where;
  }
}
