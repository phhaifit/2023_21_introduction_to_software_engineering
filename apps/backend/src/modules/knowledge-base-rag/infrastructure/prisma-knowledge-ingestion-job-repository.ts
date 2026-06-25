import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeIngestionJobListFilters,
  KnowledgeIngestionJobListResult,
  KnowledgeIngestionJobRepository
} from "../application/knowledge-ingestion-job-repository.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import {
  toKnowledgeIngestionJobDomain,
  toKnowledgeIngestionJobPrisma
} from "./prisma-knowledge-base-rag-mapper.ts";

export class PrismaKnowledgeIngestionJobRepository
  implements KnowledgeIngestionJobRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listIngestionJobs(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeIngestionJobListFilters = {}
  ): Promise<KnowledgeIngestionJobListResult> {
    const where = this.buildWhere(workspaceId, filters);
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const [total, records] = await Promise.all([
      this.prisma.knowledgeIngestionJob.count({ where }),
      this.prisma.knowledgeIngestionJob.findMany({
        where,
        orderBy: { queuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: records.map(toKnowledgeIngestionJobDomain),
      total
    };
  }

  async getIngestionJobById(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeIngestionJob | null> {
    const record = await this.prisma.knowledgeIngestionJob.findFirst({
      where: { workspaceId, jobId }
    });

    return record ? toKnowledgeIngestionJobDomain(record) : null;
  }

  async saveIngestionJob(job: KnowledgeIngestionJob): Promise<KnowledgeIngestionJob> {
    const data = toKnowledgeIngestionJobPrisma(job);
    const record = await this.prisma.knowledgeIngestionJob.upsert({
      where: { jobId: job.jobId },
      create: data,
      update: data
    });

    return toKnowledgeIngestionJobDomain(record);
  }

  private buildWhere(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeIngestionJobListFilters
  ) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.documentId) {
      where.documentId = filters.documentId;
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: [...filters.statuses] };
    }

    return where;
  }
}
