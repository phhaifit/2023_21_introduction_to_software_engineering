import type {
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

export type KnowledgeDocumentUseCaseDependencies = {
  documentRepository: KnowledgeDocumentRepository;
};

export class KnowledgeDocumentUseCases {
  private readonly documentRepository: KnowledgeDocumentRepository;

  constructor(dependencies: KnowledgeDocumentUseCaseDependencies) {
    this.documentRepository = dependencies.documentRepository;
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
}
