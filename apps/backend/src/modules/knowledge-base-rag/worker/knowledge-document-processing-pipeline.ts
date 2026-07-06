import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentRepository } from "../application/knowledge-document-repository.ts";
import type { KnowledgeIngestionJobRepository } from "../application/knowledge-ingestion-job-repository.ts";
import { KnowledgeDocumentParserError } from "../application/knowledge-document-text-extractor.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import type { KnowledgeDocumentContentReader } from "./knowledge-document-content-reader.ts";
import {
  chunkKnowledgeDocumentText,
  type KnowledgeDocumentTextChunkerOptions
} from "./knowledge-document-text-chunker.ts";
import { normalizeKnowledgeDocumentText } from "./knowledge-document-text-normalizer.ts";
import {
  KnowledgeIngestionWorkerError,
  type KnowledgeIngestionHandoffProcessor
} from "./knowledge-ingestion-handoff.ts";

export type KnowledgeDocumentChunkIdInput = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  chunkIndex: number;
};

export type KnowledgeDocumentProcessingPipelineDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  contentReader: KnowledgeDocumentContentReader;
  now: () => string;
  generateChunkId: (input: KnowledgeDocumentChunkIdInput) => string;
  chunkerOptions?: KnowledgeDocumentTextChunkerOptions;
};

export type KnowledgeDocumentProcessingInput = {
  workspaceId: EntityId<"workspaceId">;
  document: KnowledgeDocument;
  job: KnowledgeIngestionJob;
};

export type KnowledgeDocumentProcessingResult = {
  document: KnowledgeDocument;
  job: KnowledgeIngestionJob;
  chunks: KnowledgeDocumentChunk[];
};

export class KnowledgeDocumentProcessingPipeline {
  private readonly dependencies: KnowledgeDocumentProcessingPipelineDependencies;

  constructor(dependencies: KnowledgeDocumentProcessingPipelineDependencies) {
    this.dependencies = dependencies;
  }

  asHandoffProcessor(): KnowledgeIngestionHandoffProcessor {
    return async (input) => {
      const result = await this.process(input);
      return {
        document: result.document,
        job: result.job
      };
    };
  }

  async process(
    input: KnowledgeDocumentProcessingInput
  ): Promise<KnowledgeDocumentProcessingResult> {
    this.assertWorkspaceScope(input);
    this.assertSupportedTextDocument(input.document);

    let rawContent: string;
    try {
      rawContent = await this.dependencies.contentReader.readText({
        workspaceId: input.workspaceId,
        document: input.document
      });
    } catch (error) {
      if (error instanceof KnowledgeDocumentParserError) {
        throw new KnowledgeIngestionWorkerError(error.errorCode, error.message);
      }
      throw new KnowledgeIngestionWorkerError(
        "knowledge.document_content_read_failed",
        "Knowledge document content could not be read for processing."
      );
    }

    if (typeof rawContent !== "string") {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.document_content_invalid",
        "Knowledge document content must be text."
      );
    }

    const normalizedText = normalizeKnowledgeDocumentText(rawContent);
    if (!normalizedText) {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.document_content_empty",
        "Knowledge document content is empty after normalization."
      );
    }

    const textChunks = chunkKnowledgeDocumentText(
      normalizedText,
      this.dependencies.chunkerOptions
    );
    if (textChunks.length === 0) {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.document_chunks_empty",
        "Knowledge document content produced no chunks."
      );
    }

    const timestamp = this.dependencies.now();
    const chunks: KnowledgeDocumentChunk[] = [];
    for (const textChunk of textChunks) {
      const chunk: KnowledgeDocumentChunk = {
        chunkId: this.dependencies.generateChunkId({
          workspaceId: input.workspaceId,
          documentId: input.document.documentId,
          chunkIndex: textChunk.chunkIndex
        }),
        workspaceId: input.workspaceId,
        documentId: input.document.documentId,
        chunkIndex: textChunk.chunkIndex,
        contentText: textChunk.contentText,
        tokenCount: textChunk.tokenCount,
        embeddingStatus: "pending",
        sourceLocator: `text:${textChunk.chunkIndex}`,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      chunks.push(await this.dependencies.documentRepository.saveDocumentChunk(chunk));
    }

    const updatedDocument = await this.dependencies.documentRepository.saveDocument({
      ...input.document,
      status: "ingesting",
      ingestionStatus: "ingesting",
      indexingStatus: "pending",
      chunkCount: chunks.length,
      indexedChunkCount: 0,
      updatedAt: timestamp
    });
    const updatedJob = await this.dependencies.ingestionJobRepository.saveIngestionJob({
      ...input.job,
      status: "ingesting",
      progress: Math.max(input.job.progress, 80),
      updatedAt: timestamp
    });

    return {
      document: updatedDocument,
      job: updatedJob,
      chunks
    };
  }

  private assertWorkspaceScope(input: KnowledgeDocumentProcessingInput): void {
    if (!input.workspaceId) {
      throw new KnowledgeIngestionWorkerError(
        "validation.invalid_input",
        "workspaceId is required"
      );
    }

    if (input.document.workspaceId !== input.workspaceId) {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.document_workspace_mismatch",
        "Knowledge document does not belong to the requested workspace."
      );
    }

    if (input.job.workspaceId !== input.workspaceId) {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.ingestion_job_workspace_mismatch",
        "Knowledge ingestion job does not belong to the requested workspace."
      );
    }

    if (input.job.documentId !== input.document.documentId) {
      throw new KnowledgeIngestionWorkerError(
        "knowledge.ingestion_job_document_mismatch",
        "Knowledge ingestion job does not match the requested document."
      );
    }
  }

  private assertSupportedTextDocument(document: KnowledgeDocument): void {
    const mimeType = document.mimeType.toLowerCase();
    const fileType = document.fileType.toLowerCase();

    if (
      mimeType === "text/plain" ||
      mimeType === "text/csv" ||
      mimeType === "text/markdown" ||
      mimeType === "application/pdf" ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileType === "txt" ||
      fileType === "csv" ||
      fileType === "md" ||
      fileType === "markdown" ||
      fileType === "pdf" ||
      fileType === "docx"
    ) {
      return;
    }

    throw new KnowledgeIngestionWorkerError(
      "knowledge.document_type_unsupported",
      "Knowledge document type is not supported by the text processing pipeline."
    );
  }
}
