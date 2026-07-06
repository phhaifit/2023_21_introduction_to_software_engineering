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
    const records = await this.prisma.$transaction(
      nodes.map((node) => {
        const data = toKnowledgeSyncScopeNodePrisma({ ...node, workspaceId });
        return this.prisma.knowledgeSyncScopeNode.upsert({
          where: { scopeNodeId: node.scopeNodeId },
          create: data,
          update: data
        });
      })
    );

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
