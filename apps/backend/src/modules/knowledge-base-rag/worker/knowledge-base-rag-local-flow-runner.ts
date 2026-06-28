import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentRepository } from "../application/knowledge-document-repository.ts";
import type { KnowledgeIngestionJobRepository } from "../application/knowledge-ingestion-job-repository.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import {
  KnowledgeDocumentIndexingPipeline,
  type KnowledgeDocumentIndexingResult
} from "./knowledge-document-indexing-pipeline.ts";
import {
  KnowledgeDocumentProcessingPipeline,
  type KnowledgeDocumentProcessingPipelineDependencies
} from "./knowledge-document-processing-pipeline.ts";
import type { KnowledgeEmbeddingAdapter } from "./knowledge-embedding-adapter.ts";
import {
  toSafeKnowledgeIndexingFailure,
  type SafeKnowledgeIndexingFailure
} from "./knowledge-indexing-errors.ts";
import {
  KnowledgeIngestionHandoff,
  type KnowledgeIngestionEventPublisher,
  type KnowledgeIngestionHandoffResult
} from "./knowledge-ingestion-handoff.ts";
import type { KnowledgeVectorIndexAdapter } from "./knowledge-vector-index-adapter.ts";

export type KnowledgeBaseRagLocalFlowInput = {
  workspaceId: EntityId<"workspaceId">;
  jobId: EntityId<"jobId">;
};

export type KnowledgeBaseRagLocalFlowPhase =
  | "completed"
  | "ingestion_failed"
  | "indexing_failed";

export type KnowledgeBaseRagLocalFlowResult = {
  phase: KnowledgeBaseRagLocalFlowPhase;
  document: KnowledgeDocument;
  job: KnowledgeIngestionJob;
  chunks: KnowledgeDocumentChunk[];
  ingestion: KnowledgeIngestionHandoffResult;
  indexing?: KnowledgeDocumentIndexingResult;
  failure?: SafeKnowledgeIndexingFailure;
};

export type KnowledgeBaseRagLocalFlowRunnerDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  ingestionHandoff: Pick<KnowledgeIngestionHandoff, "processIngestionJob">;
  indexingPipeline: Pick<KnowledgeDocumentIndexingPipeline, "processDocument">;
  now: () => string;
};

export type KnowledgeBaseRagLocalFlowCompositionDependencies = Omit<
  KnowledgeDocumentProcessingPipelineDependencies,
  "contentReader"
> & {
  contentReader: KnowledgeDocumentProcessingPipelineDependencies["contentReader"];
  embeddingAdapter: KnowledgeEmbeddingAdapter;
  vectorIndexAdapter: KnowledgeVectorIndexAdapter;
  generateEventId: () => EntityId<"eventId">;
  eventPublisher?: KnowledgeIngestionEventPublisher;
};

export class KnowledgeBaseRagLocalFlowRunner {
  private readonly dependencies: KnowledgeBaseRagLocalFlowRunnerDependencies;

  constructor(dependencies: KnowledgeBaseRagLocalFlowRunnerDependencies) {
    this.dependencies = dependencies;
  }

  async run(
    input: KnowledgeBaseRagLocalFlowInput
  ): Promise<KnowledgeBaseRagLocalFlowResult> {
    const ingestion = await this.dependencies.ingestionHandoff.processIngestionJob(
      input
    );

    if (ingestion.job.status === "failed" || ingestion.document.ingestionStatus === "failed") {
      return {
        phase: "ingestion_failed",
        document: ingestion.document,
        job: ingestion.job,
        chunks: await this.listChunks(input.workspaceId, ingestion.document.documentId),
        ingestion,
        failure: {
          errorCode: ingestion.job.errorCode ?? "knowledge.ingestion_failed",
          errorMessage:
            ingestion.job.errorMessage ??
            "Knowledge document ingestion failed during local flow."
        }
      };
    }

    try {
      const indexing = await this.dependencies.indexingPipeline.processDocument({
        workspaceId: input.workspaceId,
        documentId: ingestion.document.documentId
      });
      const latestJob =
        (await this.dependencies.ingestionJobRepository.getIngestionJobById(
          input.workspaceId,
          input.jobId
        )) ?? ingestion.job;
      const chunks = await this.listChunks(input.workspaceId, indexing.document.documentId);

      return {
        phase: indexing.failure ? "indexing_failed" : "completed",
        document: indexing.document,
        job: latestJob,
        chunks,
        ingestion,
        indexing,
        failure: indexing.failure
      };
    } catch (error) {
      const failure = toSafeKnowledgeIndexingFailure(error);
      const failedDocument = await this.dependencies.documentRepository.saveDocument({
        ...ingestion.document,
        status: "failed",
        indexingStatus: "failed",
        updatedAt: this.dependencies.now()
      });

      return {
        phase: "indexing_failed",
        document: failedDocument,
        job: ingestion.job,
        chunks: await this.listChunks(input.workspaceId, failedDocument.documentId),
        ingestion,
        failure
      };
    }
  }

  private async listChunks(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeDocumentChunk[]> {
    const result = await this.dependencies.documentRepository.listDocumentChunks(
      workspaceId,
      documentId
    );
    return result.items;
  }
}

export function createKnowledgeBaseRagLocalFlowRunner(
  dependencies: KnowledgeBaseRagLocalFlowCompositionDependencies
): KnowledgeBaseRagLocalFlowRunner {
  const processingPipeline = new KnowledgeDocumentProcessingPipeline(dependencies);
  const ingestionHandoff = new KnowledgeIngestionHandoff({
    documentRepository: dependencies.documentRepository,
    ingestionJobRepository: dependencies.ingestionJobRepository,
    now: dependencies.now,
    generateEventId: dependencies.generateEventId,
    processor: processingPipeline.asHandoffProcessor(),
    eventPublisher: dependencies.eventPublisher
  });
  const indexingPipeline = new KnowledgeDocumentIndexingPipeline({
    documentRepository: dependencies.documentRepository,
    embeddingAdapter: dependencies.embeddingAdapter,
    vectorIndexAdapter: dependencies.vectorIndexAdapter,
    now: dependencies.now
  });

  return new KnowledgeBaseRagLocalFlowRunner({
    documentRepository: dependencies.documentRepository,
    ingestionJobRepository: dependencies.ingestionJobRepository,
    ingestionHandoff,
    indexingPipeline,
    now: dependencies.now
  });
}
