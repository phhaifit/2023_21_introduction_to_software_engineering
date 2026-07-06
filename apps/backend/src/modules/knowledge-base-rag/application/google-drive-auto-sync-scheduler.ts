import type { KnowledgeDataSourceRepository } from "./knowledge-data-source-repository.ts";
import type { KnowledgeSyncUseCases } from "./knowledge-sync-use-cases.ts";
import { readGoogleDriveAutoSyncSettings } from "./google-drive-auto-sync.ts";

export class GoogleDriveAutoSyncScheduler {
  private readonly dependencies: {
    dataSourceRepository: KnowledgeDataSourceRepository;
    syncUseCases: Pick<KnowledgeSyncUseCases, "requestScheduledSync">;
    now: () => string;
    pollIntervalMs: number;
  };
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;

  constructor(
    dependencies: {
      dataSourceRepository: KnowledgeDataSourceRepository;
      syncUseCases: Pick<KnowledgeSyncUseCases, "requestScheduledSync">;
      now: () => string;
      pollIntervalMs: number;
    }
  ) {
    this.dependencies = dependencies;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => void this.tick(),
      Math.max(10_000, this.dependencies.pollIntervalMs)
    );
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    try {
      const now = this.dependencies.now();
      const sources =
        await this.dependencies.dataSourceRepository.listAllDataSources({
          provider: "google_drive",
          statuses: ["connected"]
        });
      let queued = 0;
      for (const source of sources) {
        const settings = readGoogleDriveAutoSyncSettings(source.safeMetadata);
        if (
          !settings.enabled ||
          !settings.frequency ||
          source.selectedScopeNodeCount === 0 ||
          !source.connectedByUserId ||
          (settings.nextAutoSyncAt && settings.nextAutoSyncAt > now)
        ) {
          continue;
        }
        const job = await this.dependencies.syncUseCases.requestScheduledSync({
          workspaceId: source.workspaceId,
          sourceId: source.sourceId,
          actorId: source.connectedByUserId
        });
        if (job) queued += 1;
      }
      return queued;
    } finally {
      this.ticking = false;
    }
  }
}
