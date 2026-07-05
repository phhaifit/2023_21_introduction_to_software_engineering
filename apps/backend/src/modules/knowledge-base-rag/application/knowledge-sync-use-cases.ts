import type {
  RequestKnowledgeSyncJobRequest,
  GoogleDriveSyncScopeRequest,
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
import type { KnowledgeDataSourceRepository } from "./knowledge-data-source-repository.ts";

export type KnowledgeSyncUseCaseDependencies = {
  syncScopeRepository: KnowledgeSyncScopeRepository;
  syncJobRepository: KnowledgeSyncJobRepository;
  now: () => string;
  generateJobId: () => EntityId<"jobId">;
  dataSourceRepository?: KnowledgeDataSourceRepository;
  enqueueSyncJob?: (input: {
    workspaceId: EntityId<"workspaceId">;
    jobId: EntityId<"jobId">;
  }) => Promise<void>;
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
    if (this.dependencies.enqueueSyncJob) {
      await this.dependencies.enqueueSyncJob({
        workspaceId,
        jobId: job.jobId
      });
    }

    return toSyncJobDto(job);
  }

  async configureGoogleDriveScope(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string,
    request: GoogleDriveSyncScopeRequest
  ): Promise<SyncScopeNodeDto[]> {
    const folderIds = uniqueSafeIds(request.folderIds ?? []);
    const fileIds = uniqueSafeIds(request.fileIds ?? []);
    if (folderIds.length + fileIds.length === 0) {
      throw new KnowledgeBaseRagValidationError([
        "At least one Google Drive folder ID or file ID is required"
      ]);
    }
    const maxFiles = Math.min(500, Math.max(1, request.maxFiles ?? 100));
    const allowedMimeTypes = [
      ...new Set((request.allowedMimeTypes ?? []).map((value) => value.trim()).filter(Boolean))
    ].slice(0, 20);
    const now = this.dependencies.now();
    const existing = await this.dependencies.syncScopeRepository.getSyncScope(
      workspaceId,
      sourceId
    );
    const byExternalId = new Map(existing.map((node) => [node.externalId, node]));
    const requested = [
      ...folderIds.map((externalId) => ({ externalId, nodeType: "folder" as const })),
      ...fileIds.map((externalId) => ({ externalId, nodeType: "file" as const }))
    ];
    const requestedIds = new Set(requested.map((item) => item.externalId));
    const nodes = [
      ...existing.map((node) => ({
        ...node,
        selected: requestedIds.has(node.externalId),
        updatedAt: now
      })),
      ...requested
        .filter((item) => !byExternalId.has(item.externalId))
        .map((item) => ({
          scopeNodeId: `google-drive:${sourceId}:${item.nodeType}:${item.externalId}`,
          workspaceId,
          sourceId,
          externalId: item.externalId,
          nodeType: item.nodeType,
          displayName: `${item.nodeType === "folder" ? "Folder" : "File"} ${item.externalId}`,
          selected: true,
          selectable: true,
          safeMetadata: {
            recursive: request.recursive === true,
            allowedMimeTypes,
            maxFiles
          },
          createdAt: now,
          updatedAt: now
        }))
    ];
    const saved = (
      await this.dependencies.syncScopeRepository.saveSyncScopeNodes(
        workspaceId,
        nodes
      )
    );
    if (this.dependencies.dataSourceRepository) {
      const source =
        await this.dependencies.dataSourceRepository.getDataSourceById(
          workspaceId,
          sourceId
        );
      if (source) {
        await this.dependencies.dataSourceRepository.saveDataSource({
          ...source,
          selectedScopeNodeCount: saved.filter((node) => node.selected).length,
          updatedAt: now
        });
      }
    }
    return saved.map(toSyncScopeNodeDto);
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

function uniqueSafeIds(values: readonly string[]): string[] {
  const ids = values.map((value) => value.trim()).filter(Boolean);
  if (
    ids.length > 100 ||
    ids.some((value) => value.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(value))
  ) {
    throw new KnowledgeBaseRagValidationError([
      "Google Drive folder/file IDs are invalid"
    ]);
  }
  return [...new Set(ids)];
}
