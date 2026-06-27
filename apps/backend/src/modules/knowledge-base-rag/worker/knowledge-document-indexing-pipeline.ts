import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentRepository } from "../application/knowledge-document-repository.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { KnowledgeEmbeddingAdapter } from "./knowledge-embedding-adapter.ts";
import {
  KnowledgeDocumentIndexingError,
  toSafeKnowledgeIndexingFailure,
  type SafeKnowledgeIndexingFailure
} from "./knowledge-indexing-errors.ts";
import type { KnowledgeVectorIndexAdapter } from "./knowledge-vector-index-adapter.ts";

export type KnowledgeDocumentIndexingPipelineDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  embeddingAdapter: KnowledgeEmbeddingAdapter;
  vectorIndexAdapter: KnowledgeVectorIndexAdapter;
  now: () => string;
};

export type KnowledgeDocumentIndexingInput = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
};

export type KnowledgeDocumentIndexingResult = {
  document: KnowledgeDocument;
  chunks: KnowledgeDocumentChunk[];
  indexedChunkCount: number;
  failure?: SafeKnowledgeIndexingFailure;
};

export class KnowledgeDocumentIndexingPipeline {
  private readonly dependencies: KnowledgeDocumentIndexingPipelineDependencies;

  constructor(dependencies: KnowledgeDocumentIndexingPipelineDependencies) {
    this.dependencies = dependencies;
  }

  async processDocument(
    input: KnowledgeDocumentIndexingInput
  ): Promise<KnowledgeDocumentIndexingResult> {
    this.assertInput(input);

    const document = await this.dependencies.documentRepository.getDocumentById(
      input.workspaceId,
      input.documentId
    );
    if (!document) {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.document_not_found",
        "Knowledge document was not found in the requested workspace."
      );
    }

    const startedDocument = await this.markStarted(document);
    const indexedChunks: KnowledgeDocumentChunk[] = [];

    try {
      const chunkResult = await this.dependencies.documentRepository.listDocumentChunks(
        input.workspaceId,
        input.documentId
      );

      if (chunkResult.total === 0) {
        throw new KnowledgeDocumentIndexingError(
          "knowledge.document_chunks_missing",
          "Knowledge document has no persisted chunks available for indexing."
        );
      }

      for (const chunk of chunkResult.items) {
        this.assertIndexableChunk(input.workspaceId, input.documentId, chunk);
        const indexedChunk = await this.indexChunk(chunk);
        indexedChunks.push(indexedChunk);
      }

      const completedDocument = await this.dependencies.documentRepository.saveDocument({
        ...startedDocument,
        status: "ready",
        indexingStatus: "ready",
        chunkCount: chunkResult.total,
        indexedChunkCount: indexedChunks.length,
        updatedAt: this.dependencies.now()
      });

      return {
        document: completedDocument,
        chunks: indexedChunks,
        indexedChunkCount: indexedChunks.length
      };
    } catch (error) {
      const failure = toSafeKnowledgeIndexingFailure(error);
      const failedDocument = await this.dependencies.documentRepository.saveDocument({
        ...startedDocument,
        status: "failed",
        indexingStatus: "failed",
        indexedChunkCount: indexedChunks.length,
        updatedAt: this.dependencies.now()
      });

      return {
        document: failedDocument,
        chunks: indexedChunks,
        indexedChunkCount: indexedChunks.length,
        failure
      };
    }
  }

  private async indexChunk(
    chunk: KnowledgeDocumentChunk
  ): Promise<KnowledgeDocumentChunk> {
    const inProgressChunk = await this.dependencies.documentRepository.saveDocumentChunk({
      ...chunk,
      embeddingStatus: "ingesting",
      updatedAt: this.dependencies.now()
    });

    let embeddingResult;
    try {
      embeddingResult = await this.dependencies.embeddingAdapter.generateEmbedding({
        workspaceId: inProgressChunk.workspaceId,
        documentId: inProgressChunk.documentId,
        chunkId: inProgressChunk.chunkId,
        chunkIndex: inProgressChunk.chunkIndex,
        chunkText: inProgressChunk.contentText,
        metadata: {
          contentHash: inProgressChunk.contentHash,
          tokenCount: inProgressChunk.tokenCount,
          sourceLocator: inProgressChunk.sourceLocator
        }
      });
    } catch {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.embedding_failed",
        "Knowledge document chunk embedding generation failed."
      );
    }

    let vectorResult;
    try {
      vectorResult = await this.dependencies.vectorIndexAdapter.upsertChunkEmbedding({
        workspaceId: inProgressChunk.workspaceId,
        documentId: inProgressChunk.documentId,
        chunkId: inProgressChunk.chunkId,
        chunkIndex: inProgressChunk.chunkIndex,
        embedding: embeddingResult.embedding,
        metadata: {
          contentHash: inProgressChunk.contentHash,
          tokenCount: inProgressChunk.tokenCount,
          sourceLocator: inProgressChunk.sourceLocator
        }
      });
    } catch {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.vector_index_failed",
        "Knowledge document chunk vector indexing failed."
      );
    }

    return this.dependencies.documentRepository.saveDocumentChunk({
      ...inProgressChunk,
      embeddingStatus: "ready",
      vectorRef: vectorResult.vectorRef,
      updatedAt: this.dependencies.now()
    });
  }

  private async markStarted(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    return this.dependencies.documentRepository.saveDocument({
      ...document,
      status: "ingesting",
      indexingStatus: "ingesting",
      updatedAt: this.dependencies.now()
    });
  }

  private assertInput(input: KnowledgeDocumentIndexingInput): void {
    if (!input.workspaceId) {
      throw new KnowledgeDocumentIndexingError(
        "validation.invalid_input",
        "workspaceId is required"
      );
    }

    if (!input.documentId) {
      throw new KnowledgeDocumentIndexingError(
        "validation.invalid_input",
        "documentId is required"
      );
    }
  }

  private assertIndexableChunk(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">,
    chunk: KnowledgeDocumentChunk
  ): void {
    if (chunk.workspaceId !== workspaceId || chunk.documentId !== documentId) {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.document_chunk_scope_mismatch",
        "Knowledge document chunk does not belong to the requested workspace document."
      );
    }

    if (chunk.embeddingStatus === "failed") {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.document_chunk_state_unsupported",
        "Knowledge document chunk is not in an indexable state."
      );
    }

    if (!chunk.contentText.trim()) {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.document_chunk_empty",
        "Knowledge document chunk has no text available for indexing."
      );
    }
  }
}
