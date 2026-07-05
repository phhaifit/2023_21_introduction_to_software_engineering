import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDataSourceRepository } from "./knowledge-data-source-repository.ts";
import type { KnowledgeDocumentRepository } from "./knowledge-document-repository.ts";
import type { KnowledgeSyncJobRepository, KnowledgeSyncScopeRepository } from "./knowledge-sync-repositories.ts";
import type { KnowledgeUploadUseCases } from "./knowledge-upload-use-cases.ts";
import type { GoogleDriveProvider, GoogleDriveScope } from "./google-drive-provider.ts";
import { GoogleDriveProviderError } from "./google-drive-provider.ts";
import type { GoogleDriveOAuthService } from "./google-drive-oauth-service.ts";

const SUPPORTED_DRIVE_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet"
]);

export class GoogleDriveSyncRuntime {
  private readonly dependencies: {
    dataSourceRepository: KnowledgeDataSourceRepository;
    syncScopeRepository: KnowledgeSyncScopeRepository;
    syncJobRepository: KnowledgeSyncJobRepository;
    documentRepository: KnowledgeDocumentRepository;
    uploadUseCases: Pick<KnowledgeUploadUseCases, "importExternalFile">;
    oauthService: Pick<GoogleDriveOAuthService, "getAccessToken">;
    provider: GoogleDriveProvider;
    now: () => string;
    generateEventId: () => string;
  };

  constructor(
    dependencies: {
      dataSourceRepository: KnowledgeDataSourceRepository;
      syncScopeRepository: KnowledgeSyncScopeRepository;
      syncJobRepository: KnowledgeSyncJobRepository;
      documentRepository: KnowledgeDocumentRepository;
      uploadUseCases: Pick<KnowledgeUploadUseCases, "importExternalFile">;
      oauthService: Pick<GoogleDriveOAuthService, "getAccessToken">;
      provider: GoogleDriveProvider;
      now: () => string;
      generateEventId: () => string;
    }
  ) {
    this.dependencies = dependencies;
  }

  async execute(input: {
    workspaceId: EntityId<"workspaceId">;
    jobId: EntityId<"jobId">;
  }): Promise<void> {
    const job = await this.dependencies.syncJobRepository.getSyncJobById(
      input.workspaceId,
      input.jobId
    );
    if (!job || !job.sourceId || !job.requestedByUserId) return;
    const startedAt = this.dependencies.now();
    await this.dependencies.syncJobRepository.saveSyncJob({
      ...job,
      status: "syncing",
      startedAt,
      updatedAt: startedAt
    });
    await this.event(input, "google_drive.sync_started", "syncing", "Google Drive synchronization started.");

    try {
      const source = await this.dependencies.dataSourceRepository.getDataSourceById(
        input.workspaceId,
        job.sourceId
      );
      if (!source || source.provider !== "google_drive" || source.connectionStatus !== "connected") {
        throw new GoogleDriveProviderError(
          "credential_invalid",
          "Google Drive must be connected before synchronization."
        );
      }
      const nodes = (
        await this.dependencies.syncScopeRepository.getSyncScope(
          input.workspaceId,
          source.sourceId
        )
      ).filter((node) => node.selected);
      if (nodes.length === 0) {
        throw new GoogleDriveProviderError(
          "provider_unavailable",
          "Configure at least one Google Drive folder or file before synchronization."
        );
      }
      const accessToken = await this.dependencies.oauthService.getAccessToken(
        input.workspaceId,
        source.sourceId
      );
      const scope = toProviderScope(nodes);
      const files = await this.dependencies.provider.listFiles(accessToken, scope);
      const existingDocuments = await this.dependencies.documentRepository.listDocuments(
        input.workspaceId,
        { sourceId: source.sourceId, page: 1, pageSize: 1000 }
      );
      const byExternalId = new Map(
        existingDocuments.items
          .filter((document) => document.externalId)
          .map((document) => [document.externalId!, document])
      );
      const summary = {
        importedItemCount: 0,
        updatedItemCount: 0,
        skippedUnchangedItemCount: 0,
        skippedUnsupportedItemCount: 0,
        failedItemCount: 0,
        totalChunksCreated: 0,
        totalVectorsIndexed: 0
      };

      for (const file of files) {
        if (!SUPPORTED_DRIVE_TYPES.has(file.mimeType)) {
          summary.skippedUnsupportedItemCount += 1;
          continue;
        }
        const existing = byExternalId.get(file.fileId);
        if (existing?.sourceModifiedAt === file.modifiedTime) {
          summary.skippedUnchangedItemCount += 1;
          continue;
        }
        try {
          const downloaded = await this.dependencies.provider.downloadFile(
            accessToken,
            file
          );
          const result = await this.dependencies.uploadUseCases.importExternalFile(
            input.workspaceId,
            job.requestedByUserId,
            {
              sourceId: source.sourceId,
              externalId: file.fileId,
              sourceModifiedAt: file.modifiedTime,
              fileName: downloaded.fileName,
              mediaType: downloaded.mediaType,
              content: downloaded.content,
              existingDocument: existing
            }
          );
          if (existing) summary.updatedItemCount += 1;
          else summary.importedItemCount += 1;
          summary.totalChunksCreated += result.document.chunkCount;
          summary.totalVectorsIndexed += result.document.indexedChunkCount;
        } catch {
          summary.failedItemCount += 1;
        }
      }

      const completedAt = this.dependencies.now();
      const changed = summary.importedItemCount + summary.updatedItemCount;
      await this.dependencies.syncJobRepository.saveSyncJob({
        ...job,
        status: "completed",
        startedAt,
        completedAt,
        totalItems: files.length,
        syncedItems: changed,
        failedItems: summary.failedItemCount,
        safeSummary: summary,
        updatedAt: completedAt
      });
      await this.dependencies.dataSourceRepository.saveDataSource({
        ...source,
        lastSyncAt: completedAt,
        updatedAt: completedAt
      });
      await this.event(input, "google_drive.sync_completed", "completed", "Google Drive synchronization completed.");
    } catch (error) {
      const failedAt = this.dependencies.now();
      const failure = safeSyncFailure(error);
      await this.dependencies.syncJobRepository.saveSyncJob({
        ...job,
        status: "failed",
        startedAt,
        failedAt,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        updatedAt: failedAt
      });
      await this.event(
        input,
        "google_drive.sync_failed",
        "failed",
        failure.errorMessage,
        failure.errorCode
      );
    }
  }

  private async event(
    input: { workspaceId: EntityId<"workspaceId">; jobId: EntityId<"jobId"> },
    eventType: string,
    status: "syncing" | "completed" | "failed",
    message: string,
    errorCode?: string
  ): Promise<void> {
    const now = this.dependencies.now();
    await this.dependencies.syncJobRepository.appendSyncJobEvent({
      syncJobEventId: this.dependencies.generateEventId(),
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      eventType,
      status,
      message,
      errorCode,
      occurredAt: now,
      createdAt: now
    });
  }
}

function toProviderScope(
  nodes: Awaited<ReturnType<KnowledgeSyncScopeRepository["getSyncScope"]>>
): GoogleDriveScope {
  const metadata = nodes.find((node) => node.safeMetadata)?.safeMetadata;
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  return {
    folderIds: nodes.filter((node) => node.nodeType === "folder").map((node) => node.externalId),
    fileIds: nodes.filter((node) => node.nodeType === "file").map((node) => node.externalId),
    recursive: record.recursive === true,
    allowedMimeTypes: Array.isArray(record.allowedMimeTypes)
      ? record.allowedMimeTypes.filter((item): item is string => typeof item === "string")
      : [],
    maxFiles:
      typeof record.maxFiles === "number"
        ? Math.min(500, Math.max(1, record.maxFiles))
        : 100
  };
}

function safeSyncFailure(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof GoogleDriveProviderError) {
    return {
      errorCode: `google_drive.${error.code}`,
      errorMessage: error.message
    };
  }
  return {
    errorCode: "google_drive.sync_failed",
    errorMessage: "Google Drive synchronization failed. Try again later."
  };
}
