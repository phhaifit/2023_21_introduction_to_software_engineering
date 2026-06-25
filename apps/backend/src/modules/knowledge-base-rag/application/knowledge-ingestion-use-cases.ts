import type { IngestionJobDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeIngestionJobListFilters,
  KnowledgeIngestionJobRepository
} from "./knowledge-ingestion-job-repository.ts";
import { toIngestionJobDto } from "./dto-mappers.ts";

export type KnowledgeIngestionUseCaseDependencies = {
  ingestionJobRepository: KnowledgeIngestionJobRepository;
};

export class KnowledgeIngestionUseCases {
  private readonly ingestionJobRepository: KnowledgeIngestionJobRepository;

  constructor(dependencies: KnowledgeIngestionUseCaseDependencies) {
    this.ingestionJobRepository = dependencies.ingestionJobRepository;
  }

  async listIngestionJobs(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeIngestionJobListFilters = {}
  ): Promise<{ items: IngestionJobDto[]; total: number }> {
    const result = await this.ingestionJobRepository.listIngestionJobs(
      workspaceId,
      filters
    );

    return {
      items: result.items.map(toIngestionJobDto),
      total: result.total
    };
  }

  async getIngestionJob(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<IngestionJobDto | null> {
    const job = await this.ingestionJobRepository.getIngestionJobById(
      workspaceId,
      jobId
    );

    return job ? toIngestionJobDto(job) : null;
  }
}

