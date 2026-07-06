import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentRepository } from "../application/knowledge-document-repository.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { KnowledgeEmbeddingAdapter } from "./knowledge-embedding-adapter.ts";
import type {
  KnowledgeEmbeddingInput,
  KnowledgeEmbeddingResult
} from "./knowledge-embedding-adapter.ts";
import {
  KnowledgeDocumentIndexingError,
  toSafeKnowledgeIndexingFailure,
  type SafeKnowledgeIndexingFailure
} from "./knowledge-indexing-errors.ts";
import type {
  KnowledgeVectorIndexAdapter,
  KnowledgeVectorIndexInput,
  KnowledgeVectorIndexResult
} from "./knowledge-vector-index-adapter.ts";

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
      }
      const bulkEmbeddings = await this.generateBulkEmbeddings(chunkResult.items);

      if (
        bulkEmbeddings &&
        this.dependencies.vectorIndexAdapter.upsertChunkEmbeddings
      ) {
        indexedChunks.push(
          ...(await this.indexChunksInBulk(chunkResult.items, bulkEmbeddings))
        );
      } else {
        for (const [index, chunk] of chunkResult.items.entries()) {
          const indexedChunk = await this.indexChunk(chunk, bulkEmbeddings?.[index]);
          indexedChunks.push(indexedChunk);
        }
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
    chunk: KnowledgeDocumentChunk,
    suppliedEmbedding?: KnowledgeEmbeddingResult
  ): Promise<KnowledgeDocumentChunk> {
    const inProgressChunk = await this.dependencies.documentRepository.saveDocumentChunk({
      ...chunk,
      embeddingStatus: "ingesting",
      updatedAt: this.dependencies.now()
    });

    const embeddingResult =
      suppliedEmbedding ?? (await this.generateSingleEmbedding(inProgressChunk));
    this.assertEmbeddingResult(inProgressChunk, embeddingResult);

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
    this.assertVectorResult(inProgressChunk, vectorResult);

    return this.dependencies.documentRepository.saveDocumentChunk({
      ...inProgressChunk,
      embeddingStatus: "ready",
      vectorRef: vectorResult.vectorRef,
      updatedAt: this.dependencies.now()
    });
  }

  private async indexChunksInBulk(
    chunks: readonly KnowledgeDocumentChunk[],
    embeddings: readonly KnowledgeEmbeddingResult[]
  ): Promise<KnowledgeDocumentChunk[]> {
    const inProgressChunks: KnowledgeDocumentChunk[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const inProgressChunk =
        await this.dependencies.documentRepository.saveDocumentChunk({
          ...chunk,
          embeddingStatus: "ingesting",
          updatedAt: this.dependencies.now()
        });
      this.assertEmbeddingResult(inProgressChunk, embeddings[index]);
      inProgressChunks.push(inProgressChunk);
    }

    let vectorResults: KnowledgeVectorIndexResult[];
    try {
      vectorResults =
        await this.dependencies.vectorIndexAdapter.upsertChunkEmbeddings!(
          inProgressChunks.map((chunk, index) =>
            this.toVectorIndexInput(chunk, embeddings[index])
          )
        );
    } catch {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.vector_index_failed",
        "Knowledge document chunk vector indexing failed."
      );
    }
    if (vectorResults.length !== inProgressChunks.length) {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.vector_index_failed",
        "Knowledge document chunk vector indexing failed."
      );
    }

    const indexedChunks: KnowledgeDocumentChunk[] = [];
    for (const [index, chunk] of inProgressChunks.entries()) {
      const vectorResult = vectorResults[index];
      this.assertVectorResult(chunk, vectorResult);
      indexedChunks.push(
        await this.dependencies.documentRepository.saveDocumentChunk({
          ...chunk,
          embeddingStatus: "ready",
          vectorRef: vectorResult.vectorRef,
          updatedAt: this.dependencies.now()
        })
      );
    }
    return indexedChunks;
  }

  private async generateBulkEmbeddings(
    chunks: readonly KnowledgeDocumentChunk[]
  ): Promise<KnowledgeEmbeddingResult[] | undefined> {
    if (!this.dependencies.embeddingAdapter.generateEmbeddings) {
      return undefined;
    }
    try {
      const results = await this.dependencies.embeddingAdapter.generateEmbeddings(
        chunks.map((chunk) => this.toEmbeddingInput(chunk))
      );
      if (results.length !== chunks.length) {
        throw new Error("Unexpected embedding result count.");
      }
      return results;
    } catch {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.embedding_failed",
        "Knowledge document chunk embedding generation failed."
      );
    }
  }

  private async generateSingleEmbedding(
    chunk: KnowledgeDocumentChunk
  ): Promise<KnowledgeEmbeddingResult> {
    try {
      return await this.dependencies.embeddingAdapter.generateEmbedding(
        this.toEmbeddingInput(chunk)
      );
    } catch {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.embedding_failed",
        "Knowledge document chunk embedding generation failed."
      );
    }
  }

  private toEmbeddingInput(chunk: KnowledgeDocumentChunk): KnowledgeEmbeddingInput {
    return {
      workspaceId: chunk.workspaceId,
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.contentText,
      metadata: {
        contentHash: chunk.contentHash,
        tokenCount: chunk.tokenCount,
        sourceLocator: chunk.sourceLocator
      }
    };
  }

  private toVectorIndexInput(
    chunk: KnowledgeDocumentChunk,
    embedding: KnowledgeEmbeddingResult
  ): KnowledgeVectorIndexInput {
    return {
      workspaceId: chunk.workspaceId,
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      embedding: embedding.embedding,
      metadata: {
        contentHash: chunk.contentHash,
        tokenCount: chunk.tokenCount,
        sourceLocator: chunk.sourceLocator
      }
    };
  }

  private assertEmbeddingResult(
    chunk: KnowledgeDocumentChunk,
    result: KnowledgeEmbeddingResult
  ): void {
    if (
      result.workspaceId !== chunk.workspaceId ||
      result.documentId !== chunk.documentId ||
      result.chunkId !== chunk.chunkId ||
      result.chunkIndex !== chunk.chunkIndex ||
      result.embedding.length === 0 ||
      !result.embedding.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
    ) {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.embedding_result_invalid",
        "Knowledge document chunk embedding result is invalid."
      );
    }
  }

  private async markStarted(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    return this.dependencies.documentRepository.saveDocument({
      ...document,
      status: "ingesting",
      indexingStatus: "ingesting",
      updatedAt: this.dependencies.now()
    });
  }

  private assertVectorResult(
    chunk: KnowledgeDocumentChunk,
    result: KnowledgeVectorIndexResult
  ): void {
    if (
      result.workspaceId !== chunk.workspaceId ||
      result.documentId !== chunk.documentId ||
      result.chunkId !== chunk.chunkId ||
      result.chunkIndex !== chunk.chunkIndex ||
      !result.vectorRef
    ) {
      throw new KnowledgeDocumentIndexingError(
        "knowledge.vector_index_failed",
        "Knowledge document chunk vector indexing failed."
      );
    }
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
