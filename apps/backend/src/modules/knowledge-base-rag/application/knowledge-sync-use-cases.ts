import type {
  RequestKnowledgeSyncJobRequest,
  SyncJobDto,
  SyncScopeNodeDto,
  UpdateSyncScopeRequest
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeSyncJobListFilters,
  KnowledgeSyncJobRepository,
  KnowledgeSyncScopeRepository
} from "./knowledge-sync-repositories.ts";
import { toSyncJobDto, toSyncScopeNodeDto } from "./dto-mappers.ts";
import { KnowledgeBaseRagValidationError } from "./knowledge-base-rag-errors.ts";

export type KnowledgeSyncUseCaseDependencies = {
  syncScopeRepository: KnowledgeSyncScopeRepository;
  syncJobRepository: KnowledgeSyncJobRepository;
  now: () => string;
  generateJobId: () => EntityId<"jobId">;
};

export class KnowledgeSyncUseCases {
  private readonly dependencies: KnowledgeSyncUseCaseDependencies;

  constructor(dependencies: KnowledgeSyncUseCaseDependencies) {
    this.dependencies = dependencies;
  }

  async getSyncScope(
    workspaceId: EntityId<"workspaceId">,
    sourceId?: string
  ): Promise<SyncScopeNodeDto[]> {
    const nodes = await this.dependencies.syncScopeRepository.getSyncScope(
      workspaceId,
      sourceId
    );

    return nodes.map(toSyncScopeNodeDto);
  }

  async updateSyncScope(
    workspaceId: EntityId<"workspaceId">,
    request: UpdateSyncScopeRequest
  ): Promise<SyncScopeNodeDto[]> {
    const selectedIds = new Set(request.selectedScopeNodeIds ?? []);
    const existing = await this.dependencies.syncScopeRepository.getSyncScope(workspaceId);
    const timestamp = this.dependencies.now();
    const updated = existing.map((node) => ({
      ...node,
      selected: selectedIds.has(node.scopeNodeId),
      updatedAt: timestamp
    }));

    const saved = await this.dependencies.syncScopeRepository.saveSyncScopeNodes(
      workspaceId,
      updated
    );

    return saved.map(toSyncScopeNodeDto);
  }

  async requestManualSync(
    workspaceId: EntityId<"workspaceId">,
    actorId: EntityId<"userId">,
    request: RequestKnowledgeSyncJobRequest = {}
  ): Promise<SyncJobDto> {
    if (!actorId) {
      throw new KnowledgeBaseRagValidationError(["actorId is required"]);
    }

    const timestamp = this.dependencies.now();
    const job = await this.dependencies.syncJobRepository.saveSyncJob({
      jobId: this.dependencies.generateJobId(),
      workspaceId,
      sourceId: request.sourceId,
      status: "pending",
      requestedByUserId: actorId,
      queuedAt: timestamp,
      totalItems: 0,
      syncedItems: 0,
      failedItems: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return toSyncJobDto(job);
  }

  async listSyncJobs(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeSyncJobListFilters = {}
  ): Promise<{ items: SyncJobDto[]; total: number }> {
    const result = await this.dependencies.syncJobRepository.listSyncJobs(
      workspaceId,
      filters
    );

    return {
      items: result.items.map(toSyncJobDto),
      total: result.total
    };
  }

  async getSyncJob(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<SyncJobDto | null> {
    const job = await this.dependencies.syncJobRepository.getSyncJobById(
      workspaceId,
      jobId
    );

    return job ? toSyncJobDto(job) : null;
  }
}

