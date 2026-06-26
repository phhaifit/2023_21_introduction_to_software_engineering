import type { DomainEvent } from "@vcp/shared/contracts/events.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";
import type { KnowledgeDocumentRepository } from "../application/knowledge-document-repository.ts";
import {
  createIngestionCompletedEvent,
  createIngestionFailedEvent,
  createIngestionStartedEvent
} from "../application/knowledge-base-rag-events.ts";
import type { KnowledgeIngestionJobRepository } from "../application/knowledge-ingestion-job-repository.ts";
import type { KnowledgeDocument } from "../domain/knowledge-document.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";

type IngestionLifecycleEvent =
  | DomainEvent<"knowledge.document.ingestionStarted">
  | DomainEvent<"knowledge.document.ingestionCompleted">
  | DomainEvent<"knowledge.document.ingestionFailed">;

export type KnowledgeIngestionEventPublisher = {
  publish(event: IngestionLifecycleEvent): Promise<void>;
};

export type KnowledgeIngestionHandoffProcessor = (input: {
  workspaceId: EntityId<"workspaceId">;
  document: KnowledgeDocument;
  job: KnowledgeIngestionJob;
}) => Promise<void>;

export type KnowledgeIngestionHandoffDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  now: () => string;
  generateEventId: () => EntityId<"eventId">;
  processor?: KnowledgeIngestionHandoffProcessor;
  eventPublisher?: KnowledgeIngestionEventPublisher;
};

export type ProcessKnowledgeIngestionJobInput = {
  workspaceId: EntityId<"workspaceId">;
  jobId: EntityId<"jobId">;
};

export type KnowledgeIngestionHandoffResult = {
  job: KnowledgeIngestionJob;
  document: KnowledgeDocument;
  events: IngestionLifecycleEvent[];
};

export class KnowledgeIngestionWorkerError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeIngestionWorkerError";
    this.errorCode = errorCode;
  }
}

export class KnowledgeIngestionHandoff {
  private readonly dependencies: KnowledgeIngestionHandoffDependencies;

  constructor(dependencies: KnowledgeIngestionHandoffDependencies) {
    this.dependencies = dependencies;
  }

  async processIngestionJob(
    input: ProcessKnowledgeIngestionJobInput
  ): Promise<KnowledgeIngestionHandoffResult> {
    this.assertWorkspaceId(input.workspaceId);
    this.assertJobId(input.jobId);

    const queuedJob = await this.dependencies.ingestionJobRepository.getIngestionJobById(
      input.workspaceId,
      input.jobId
    );

    if (!queuedJob) {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.ingestion_job_not_found",
        "Knowledge ingestion job was not found in the requested workspace."
      );
    }

    if (queuedJob.status !== "pending") {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.ingestion_job_not_queued",
        "Knowledge ingestion job is not queued for worker handoff."
      );
    }

    if (!queuedJob.documentId) {
      const failedJob = await this.markJobFailed(
        queuedJob,
        "knowledge.ingestion_document_missing",
        "Knowledge ingestion job has no associated document."
      );
      throw new KnowledgeIngestionWorkerError(failedJob.errorCode!, failedJob.errorMessage!);
    }

    const queuedDocument = await this.dependencies.documentRepository.getDocumentById(
      input.workspaceId,
      queuedJob.documentId
    );

    if (!queuedDocument) {
      const failedJob = await this.markJobFailed(
        queuedJob,
        "knowledge.ingestion_document_not_found",
        "Knowledge document was not found in the requested workspace."
      );
      throw new KnowledgeIngestionWorkerError(failedJob.errorCode!, failedJob.errorMessage!);
    }

    const started = await this.markStarted(queuedJob, queuedDocument);
    const events: IngestionLifecycleEvent[] = [started.event];

    try {
      await (this.dependencies.processor ?? noopProcessor)({
        workspaceId: input.workspaceId,
        document: started.document,
        job: started.job
      });

      const completed = await this.markCompleted(started.job, started.document);
      events.push(completed.event);

      await this.publishEvents(events);

      return {
        job: completed.job,
        document: completed.document,
        events
      };
    } catch (error) {
      const failure = toSafeFailure(error);
      const failed = await this.markFailed(started.job, started.document, failure);
      events.push(failed.event);

      await this.publishEvents(events);

      return {
        job: failed.job,
        document: failed.document,
        events
      };
    }
  }

  private async markStarted(
    job: KnowledgeIngestionJob,
    document: KnowledgeDocument
  ): Promise<{
    job: KnowledgeIngestionJob;
    document: KnowledgeDocument;
    event: DomainEvent<"knowledge.document.ingestionStarted">;
  }> {
    const timestamp = this.dependencies.now();
    const startedJob = await this.dependencies.ingestionJobRepository.saveIngestionJob({
      ...job,
      status: "ingesting",
      progress: Math.max(job.progress, 10),
      startedAt: job.startedAt ?? timestamp,
      updatedAt: timestamp
    });
    const startedDocument = await this.dependencies.documentRepository.saveDocument({
      ...document,
      status: "ingesting",
      ingestionStatus: "ingesting",
      indexingStatus: "pending",
      updatedAt: timestamp
    });

    return {
      job: startedJob,
      document: startedDocument,
      event: createIngestionStartedEvent({
        eventId: this.dependencies.generateEventId(),
        workspaceId: job.workspaceId,
        occurredAt: timestamp,
        documentId: document.documentId,
        jobId: job.jobId,
        status: "ingesting"
      })
    };
  }

  private async markCompleted(
    job: KnowledgeIngestionJob,
    document: KnowledgeDocument
  ): Promise<{
    job: KnowledgeIngestionJob;
    document: KnowledgeDocument;
    event: DomainEvent<"knowledge.document.ingestionCompleted">;
  }> {
    const timestamp = this.dependencies.now();
    const completedJob = await this.dependencies.ingestionJobRepository.saveIngestionJob({
      ...job,
      status: "ready",
      progress: 100,
      completedAt: timestamp,
      failedAt: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: timestamp
    });
    const completedDocument = await this.dependencies.documentRepository.saveDocument({
      ...document,
      status: "ready",
      ingestionStatus: "ready",
      indexingStatus: "ready",
      updatedAt: timestamp
    });

    return {
      job: completedJob,
      document: completedDocument,
      event: createIngestionCompletedEvent({
        eventId: this.dependencies.generateEventId(),
        workspaceId: job.workspaceId,
        occurredAt: timestamp,
        documentId: document.documentId,
        jobId: job.jobId,
        status: "ready",
        chunkCount: completedDocument.chunkCount,
        indexedChunkCount: completedDocument.indexedChunkCount
      })
    };
  }

  private async markFailed(
    job: KnowledgeIngestionJob,
    document: KnowledgeDocument,
    failure: SafeIngestionFailure
  ): Promise<{
    job: KnowledgeIngestionJob;
    document: KnowledgeDocument;
    event: DomainEvent<"knowledge.document.ingestionFailed">;
  }> {
    const timestamp = this.dependencies.now();
    const failedJob = await this.dependencies.ingestionJobRepository.saveIngestionJob({
      ...job,
      status: "failed",
      failedAt: timestamp,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      updatedAt: timestamp
    });
    const failedDocument = await this.dependencies.documentRepository.saveDocument({
      ...document,
      status: "failed",
      ingestionStatus: "failed",
      indexingStatus: "failed",
      updatedAt: timestamp
    });

    return {
      job: failedJob,
      document: failedDocument,
      event: createIngestionFailedEvent({
        eventId: this.dependencies.generateEventId(),
        workspaceId: job.workspaceId,
        occurredAt: timestamp,
        documentId: document.documentId,
        jobId: job.jobId,
        status: "failed",
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage
      })
    };
  }

  private async markJobFailed(
    job: KnowledgeIngestionJob,
    errorCode: string,
    errorMessage: string
  ): Promise<KnowledgeIngestionJob> {
    const timestamp = this.dependencies.now();
    return this.dependencies.ingestionJobRepository.saveIngestionJob({
      ...job,
      status: "failed",
      failedAt: timestamp,
      errorCode,
      errorMessage,
      updatedAt: timestamp
    });
  }

  private async publishEvents(events: readonly IngestionLifecycleEvent[]): Promise<void> {
    if (!this.dependencies.eventPublisher) {
      return;
    }

    for (const event of events) {
      await this.dependencies.eventPublisher.publish(event);
    }
  }

  private assertWorkspaceId(workspaceId: EntityId<"workspaceId">): void {
    if (!workspaceId) {
      throw new KnowledgeIngestionWorkerError(
        "validation.invalid_input",
        "workspaceId is required"
      );
    }
  }

  private assertJobId(jobId: EntityId<"jobId">): void {
    if (!jobId) {
      throw new KnowledgeIngestionWorkerError(
        "validation.invalid_input",
        "jobId is required"
      );
    }
  }
}

type SafeIngestionFailure = {
  errorCode: string;
  errorMessage: string;
};

function toSafeFailure(error: unknown): SafeIngestionFailure {
  if (error instanceof KnowledgeIngestionWorkerError) {
    return {
      errorCode: error.errorCode,
      errorMessage: error.message
    };
  }

  return {
    errorCode: "knowledge.ingestion_failed",
    errorMessage: "Knowledge ingestion failed during worker handoff."
  };
}

async function noopProcessor(): Promise<void> {
  return;
}

export const KNOWLEDGE_INGESTION_HANDOFF_STATUS_MAP = {
  queued: "pending",
  started: "ingesting",
  completed: "ready",
  failed: "failed"
} as const satisfies Record<string, KnowledgeIndexStatus>;
