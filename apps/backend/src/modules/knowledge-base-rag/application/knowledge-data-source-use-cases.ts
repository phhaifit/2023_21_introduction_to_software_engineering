import type {
  ConnectKnowledgeDataSourceRequest,
  KnowledgeDataSourceDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceListFilters,
  KnowledgeDataSourceRepository
} from "./knowledge-data-source-repository.ts";
import { toKnowledgeDataSourceDto } from "./dto-mappers.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeDataSourceNotFoundError
} from "./knowledge-base-rag-errors.ts";

export type KnowledgeDataSourceUseCaseDependencies = {
  dataSourceRepository: KnowledgeDataSourceRepository;
  now: () => string;
};

export class KnowledgeDataSourceUseCases {
  private readonly dependencies: KnowledgeDataSourceUseCaseDependencies;

  constructor(dependencies: KnowledgeDataSourceUseCaseDependencies) {
    this.dependencies = dependencies;
  }

  async listDataSources(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDataSourceListFilters = {}
  ): Promise<KnowledgeDataSourceDto[]> {
    const sources = await this.dependencies.dataSourceRepository.listDataSources(
      workspaceId,
      filters
    );

    return sources.map(toKnowledgeDataSourceDto);
  }

  async getDataSource(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<KnowledgeDataSourceDto | null> {
    const source = await this.dependencies.dataSourceRepository.getDataSourceById(
      workspaceId,
      sourceId
    );

    return source ? toKnowledgeDataSourceDto(source) : null;
  }

  async connectDataSourcePlaceholder(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string,
    actorId: EntityId<"userId">,
    request: ConnectKnowledgeDataSourceRequest = {}
  ): Promise<KnowledgeDataSourceDto> {
    if (!actorId) {
      throw new KnowledgeBaseRagValidationError(["actorId is required"]);
    }

    this.assertSafeConnectRequest(request);

    const source = await this.dependencies.dataSourceRepository.getDataSourceById(
      workspaceId,
      sourceId
    );
    if (!source) {
      throw new KnowledgeDataSourceNotFoundError(sourceId);
    }

    const saved = await this.dependencies.dataSourceRepository.saveDataSource({
      ...source,
      displayName: request.displayName?.trim() || source.displayName,
      connectionStatus: "connected",
      connectedByUserId: actorId,
      safeMetadata: request.providerAccountLabel
        ? { providerAccountLabel: request.providerAccountLabel.trim() }
        : source.safeMetadata,
      updatedAt: this.dependencies.now()
    });

    return toKnowledgeDataSourceDto(saved);
  }

  private assertSafeConnectRequest(request: ConnectKnowledgeDataSourceRequest): void {
    const serialized = JSON.stringify(request).toLowerCase();
    if (/(credential|secret|token|password|refresh|private)/.test(serialized)) {
      throw new KnowledgeBaseRagValidationError([
        "connection placeholder request must not include credentials or secrets"
      ]);
    }
  }
}

