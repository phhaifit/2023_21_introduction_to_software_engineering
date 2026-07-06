import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentTextExtractor } from "../application/knowledge-document-text-extractor.ts";
import type { KnowledgeDocumentRepository } from "../application/knowledge-document-repository.ts";
import type { KnowledgeFileStorage } from "../application/knowledge-file-storage.ts";
import type { KnowledgeIngestionJobRepository } from "../application/knowledge-ingestion-job-repository.ts";
import { KnowledgeDocumentProcessingPipeline } from "../worker/knowledge-document-processing-pipeline.ts";
import type { KnowledgeDocumentTextChunkerOptions } from "../worker/knowledge-document-text-chunker.ts";
import {
  KnowledgeIngestionHandoff,
  type KnowledgeIngestionEventPublisher
} from "../worker/knowledge-ingestion-handoff.ts";
import { KnowledgeIngestionWorkerRunner } from "../worker/knowledge-ingestion-worker-runner.ts";
import { StoredKnowledgeDocumentContentReader } from "./stored-knowledge-document-content-reader.ts";

export type KnowledgeIngestionWorkerRuntimeDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  fileStorage: Pick<KnowledgeFileStorage, "read">;
  textExtractor: KnowledgeDocumentTextExtractor;
  now: () => string;
  generateEventId: () => EntityId<"eventId">;
  generateChunkId: (input: {
    workspaceId: EntityId<"workspaceId">;
    documentId: EntityId<"documentId">;
    chunkIndex: number;
  }) => string;
  chunkerOptions?: KnowledgeDocumentTextChunkerOptions;
  eventPublisher?: KnowledgeIngestionEventPublisher;
};

export function createKnowledgeIngestionWorkerRuntime(
  dependencies: KnowledgeIngestionWorkerRuntimeDependencies
): KnowledgeIngestionWorkerRunner {
  const contentReader = new StoredKnowledgeDocumentContentReader(
    dependencies.fileStorage,
    dependencies.textExtractor
  );
  const processingPipeline = new KnowledgeDocumentProcessingPipeline({
    documentRepository: dependencies.documentRepository,
    ingestionJobRepository: dependencies.ingestionJobRepository,
    contentReader,
    now: dependencies.now,
    generateChunkId: dependencies.generateChunkId,
    chunkerOptions: dependencies.chunkerOptions
  });
  const ingestionHandoff = new KnowledgeIngestionHandoff({
    documentRepository: dependencies.documentRepository,
    ingestionJobRepository: dependencies.ingestionJobRepository,
    now: dependencies.now,
    generateEventId: dependencies.generateEventId,
    processor: processingPipeline.asHandoffProcessor(),
    eventPublisher: dependencies.eventPublisher
  });

  return new KnowledgeIngestionWorkerRunner({
    ingestionJobRepository: dependencies.ingestionJobRepository,
    ingestionHandoff
  });
}
