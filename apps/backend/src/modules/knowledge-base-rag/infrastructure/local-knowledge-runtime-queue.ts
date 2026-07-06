import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type KnowledgeRuntimeJob =
  | {
      kind: "google-drive-sync";
      workspaceId: EntityId<"workspaceId">;
      jobId: EntityId<"jobId">;
    }
  | {
      kind: "document-ingestion";
      workspaceId: EntityId<"workspaceId">;
      jobId: EntityId<"jobId">;
    };

export type KnowledgeRuntimeQueue = {
  enqueue(job: KnowledgeRuntimeJob): Promise<void>;
};

export class LocalKnowledgeRuntimeQueue implements KnowledgeRuntimeQueue {
  private readonly pending: KnowledgeRuntimeJob[] = [];
  private readonly handlers: {
    googleDriveSync: (
      job: Extract<KnowledgeRuntimeJob, { kind: "google-drive-sync" }>
    ) => Promise<void>;
    documentIngestion?: (
      job: Extract<KnowledgeRuntimeJob, { kind: "document-ingestion" }>
    ) => Promise<void>;
  };
  private running = false;

  constructor(
    handlers: {
      googleDriveSync: (job: Extract<KnowledgeRuntimeJob, { kind: "google-drive-sync" }>) => Promise<void>;
      documentIngestion?: (job: Extract<KnowledgeRuntimeJob, { kind: "document-ingestion" }>) => Promise<void>;
    }
  ) {
    this.handlers = handlers;
  }

  async enqueue(job: KnowledgeRuntimeJob): Promise<void> {
    this.pending.push(job);
    queueMicrotask(() => void this.drain());
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift()!;
        if (job.kind === "google-drive-sync") {
          await this.handlers.googleDriveSync(job);
        } else if (this.handlers.documentIngestion) {
          await this.handlers.documentIngestion(job);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
