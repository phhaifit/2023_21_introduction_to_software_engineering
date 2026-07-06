import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeSyncJobListFilters,
  KnowledgeSyncJobListResult,
  KnowledgeSyncJobRepository,
  KnowledgeSyncScopeRepository
} from "../application/knowledge-sync-repositories.ts";
import type {
  KnowledgeSyncJob,
  KnowledgeSyncJobEvent,
  KnowledgeSyncScopeNode
} from "../domain/knowledge-sync.ts";
import {
  toKnowledgeSyncJobDomain,
  toKnowledgeSyncJobEventDomain,
  toKnowledgeSyncJobEventPrisma,
  toKnowledgeSyncJobPrisma,
  toKnowledgeSyncScopeNodeDomain,
  toKnowledgeSyncScopeNodePrisma
} from "./prisma-knowledge-base-rag-mapper.ts";

export class PrismaKnowledgeSyncScopeRepository
  implements KnowledgeSyncScopeRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getSyncScope(
    workspaceId: EntityId<"workspaceId">,
    sourceId?: string
  ): Promise<KnowledgeSyncScopeNode[]> {
    const records = await this.prisma.knowledgeSyncScopeNode.findMany({
      where: { workspaceId, ...(sourceId ? { sourceId } : {}) },
      orderBy: [{ sourceId: "asc" }, { displayName: "asc" }]
    });

    return records.map(toKnowledgeSyncScopeNodeDomain);
  }

  async saveSyncScopeNodes(
    workspaceId: EntityId<"workspaceId">,
    nodes: readonly KnowledgeSyncScopeNode[]
  ): Promise<KnowledgeSyncScopeNode[]> {
    const sourceIds = [...new Set(nodes.map((node) => node.sourceId))];
    const scopeNodeIds = nodes.map((node) => node.scopeNodeId);
    const records = await this.prisma.$transaction(async (transaction) => {
      for (const sourceId of sourceIds) {
        await transaction.knowledgeSyncScopeNode.deleteMany({
          where: {
            workspaceId,
            sourceId,
            ...(scopeNodeIds.length > 0
              ? { scopeNodeId: { notIn: scopeNodeIds } }
              : {})
          }
        });
      }
      return Promise.all(nodes.map((node) => {
        const data = toKnowledgeSyncScopeNodePrisma({ ...node, workspaceId });
        return transaction.knowledgeSyncScopeNode.upsert({
          where: { scopeNodeId: node.scopeNodeId },
          create: data,
          update: data
        });
      }));
    });

    return records.map(toKnowledgeSyncScopeNodeDomain);
  }
}

export class PrismaKnowledgeSyncJobRepository implements KnowledgeSyncJobRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listSyncJobs(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeSyncJobListFilters = {}
  ): Promise<KnowledgeSyncJobListResult> {
    const where = this.buildWhere(workspaceId, filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const [total, records] = await Promise.all([
      this.prisma.knowledgeSyncJob.count({ where }),
      this.prisma.knowledgeSyncJob.findMany({
        where,
        orderBy: { queuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: records.map(toKnowledgeSyncJobDomain),
      total
    };
  }

  async getSyncJobById(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeSyncJob | null> {
    const record = await this.prisma.knowledgeSyncJob.findFirst({
      where: { workspaceId, jobId }
    });

    return record ? toKnowledgeSyncJobDomain(record) : null;
  }

  async saveSyncJob(job: KnowledgeSyncJob): Promise<KnowledgeSyncJob> {
    const data = toKnowledgeSyncJobPrisma(job);
    const record = await this.prisma.knowledgeSyncJob.upsert({
      where: { jobId: job.jobId },
      create: data,
      update: data
    });

    return toKnowledgeSyncJobDomain(record);
  }

  async createSyncJobIfNoActiveSource(
    job: KnowledgeSyncJob
  ): Promise<KnowledgeSyncJob | null> {
    if (!job.sourceId) return this.saveSyncJob(job);
    const rows = await this.prisma.$queryRawUnsafe<
      Parameters<typeof toKnowledgeSyncJobDomain>[0][]
    >(
      `INSERT INTO "knowledge_sync_jobs"
        ("jobId", "workspaceId", "sourceId", "status", "requestedByUserId",
         "queuedAt", "startedAt", "completedAt", "failedAt", "totalItems",
         "syncedItems", "failedItems", "errorCode", "errorMessage",
         "safeSummary", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, $7, $8, $9,
               NULL, NULL, $10::jsonb, $11, $12)
       ON CONFLICT ("sourceId")
         WHERE "sourceId" IS NOT NULL AND "status" IN ('pending', 'syncing')
       DO NOTHING
       RETURNING *`,
      job.jobId,
      job.workspaceId,
      job.sourceId,
      job.status,
      job.requestedByUserId ?? null,
      job.queuedAt,
      job.totalItems ?? null,
      job.syncedItems ?? null,
      job.failedItems ?? null,
      JSON.stringify(job.safeSummary ?? null),
      job.createdAt,
      job.updatedAt
    );
    return rows[0] ? toKnowledgeSyncJobDomain(rows[0]) : null;
  }

  async appendSyncJobEvent(
    event: KnowledgeSyncJobEvent
  ): Promise<KnowledgeSyncJobEvent> {
    const record = await this.prisma.knowledgeSyncJobEvent.create({
      data: toKnowledgeSyncJobEventPrisma(event)
    });

    return toKnowledgeSyncJobEventDomain(record);
  }

  async listSyncJobEvents(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeSyncJobEvent[]> {
    const records = await this.prisma.knowledgeSyncJobEvent.findMany({
      where: { workspaceId, jobId },
      orderBy: { occurredAt: "asc" }
    });

    return records.map(toKnowledgeSyncJobEventDomain);
  }

  private buildWhere(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeSyncJobListFilters
  ) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.sourceId) {
      where.sourceId = filters.sourceId;
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: [...filters.statuses] };
    }

    return where;
  }
}
