import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIngestionJobRepository } from "../application/knowledge-ingestion-job-repository.ts";
import {
  KnowledgeIngestionHandoff,
  KnowledgeIngestionWorkerError,
  type KnowledgeIngestionHandoffResult
} from "./knowledge-ingestion-handoff.ts";

export type KnowledgeIngestionWorkerRunnerDependencies = {
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  ingestionHandoff: Pick<KnowledgeIngestionHandoff, "processIngestionJob">;
};

export type ProcessNextKnowledgeIngestionJobResult =
  | KnowledgeIngestionHandoffResult
  | null;

export class KnowledgeIngestionWorkerRunner {
  private readonly dependencies: KnowledgeIngestionWorkerRunnerDependencies;

  constructor(dependencies: KnowledgeIngestionWorkerRunnerDependencies) {
    this.dependencies = dependencies;
  }

  async processNextQueuedJob(
    workspaceId: EntityId<"workspaceId">
  ): Promise<ProcessNextKnowledgeIngestionJobResult> {
    if (!workspaceId) {
      throw new KnowledgeIngestionWorkerError(
        "validation.invalid_input",
        "workspaceId is required"
      );
    }

    const job =
      await this.dependencies.ingestionJobRepository.findNextQueuedJob(workspaceId);
    if (!job) {
      return null;
    }

    return this.processJob(workspaceId, job.jobId);
  }

  async processJob(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeIngestionHandoffResult> {
    return this.dependencies.ingestionHandoff.processIngestionJob({
      workspaceId,
      jobId
    });
  }
}
