import type {
  DeleteKnowledgeDocumentResponse,
  KnowledgeDocumentChunkDto,
  KnowledgeDocumentDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDocumentListFilters,
  KnowledgeDocumentRepository
} from "./knowledge-document-repository.ts";
import {
  toKnowledgeDocumentChunkDto,
  toKnowledgeDocumentDto
} from "./dto-mappers.ts";
import type { KnowledgeDocumentDeletionRepository } from "./knowledge-document-deletion-repository.ts";
import type { KnowledgeFileStorage } from "./knowledge-file-storage.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeDocumentNotFoundError
} from "./knowledge-base-rag-errors.ts";

export type KnowledgeDocumentUseCaseDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  documentDeletionRepository?: KnowledgeDocumentDeletionRepository;
  fileStorage?: Pick<KnowledgeFileStorage, "remove">;
  logger?: Pick<Console, "warn">;
};

export class KnowledgeDocumentUseCases {
  private readonly documentRepository: KnowledgeDocumentRepository;
  private readonly documentDeletionRepository?: KnowledgeDocumentDeletionRepository;
  private readonly fileStorage?: Pick<KnowledgeFileStorage, "remove">;
  private readonly logger?: Pick<Console, "warn">;

  constructor(dependencies: KnowledgeDocumentUseCaseDependencies) {
    this.documentRepository = dependencies.documentRepository;
    this.documentDeletionRepository = dependencies.documentDeletionRepository;
    this.fileStorage = dependencies.fileStorage;
    this.logger = dependencies.logger ?? console;
  }

  async listDocuments(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDocumentListFilters = {}
  ): Promise<{ items: KnowledgeDocumentDto[]; total: number }> {
    const result = await this.documentRepository.listDocuments(workspaceId, filters);

    return {
      items: result.items.map(toKnowledgeDocumentDto),
      total: result.total
    };
  }

  async getDocument(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeDocumentDto | null> {
    const document = await this.documentRepository.getDocumentById(
      workspaceId,
      documentId
    );

    return document ? toKnowledgeDocumentDto(document) : null;
  }

  async listDocumentChunks(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">,
    filters: { page?: number; pageSize?: number } = {}
  ): Promise<{ items: KnowledgeDocumentChunkDto[]; total: number }> {
    const result = await this.documentRepository.listDocumentChunks(
      workspaceId,
      documentId
    );
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? (result.items.length || 20);
    const offset = (page - 1) * pageSize;

    return {
      items: result.items.slice(offset, offset + pageSize).map(toKnowledgeDocumentChunkDto),
      total: result.total
    };
  }

  async deleteDocument(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<DeleteKnowledgeDocumentResponse> {
    if (!this.documentDeletionRepository) {
      throw new KnowledgeBaseRagValidationError([
        "Document deletion is not configured."
      ]);
    }

    const document = await this.documentRepository.getDocumentById(
      workspaceId,
      documentId
    );
    if (!document) {
      throw new KnowledgeDocumentNotFoundError(documentId);
    }
    if (!isTerminalDocument(document)) {
      throw new KnowledgeBaseRagValidationError([
        "Cannot delete while processing."
      ]);
    }

    const deleted = await this.documentDeletionRepository.deleteDocumentCascade(
      workspaceId,
      documentId
    );
    if (!deleted) {
      throw new KnowledgeDocumentNotFoundError(documentId);
    }

    if (deleted.storageKey && this.fileStorage) {
      await this.fileStorage.remove(deleted.storageKey).catch(() => {
        this.logger?.warn(
          "Knowledge document storage cleanup failed after database deletion.",
          {
            workspaceId,
            documentId
          }
        );
      });
    }

    return {
      documentId,
      deleted: true
    };
  }
}

function isTerminalDocument(document: {
  status: string;
  ingestionStatus: string;
  indexingStatus: string;
}): boolean {
  return [document.status, document.ingestionStatus, document.indexingStatus].every(
    (status) => status === "ready" || status === "failed"
  );
}
