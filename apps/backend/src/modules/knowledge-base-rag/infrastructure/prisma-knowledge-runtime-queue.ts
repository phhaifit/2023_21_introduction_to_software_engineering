import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

import type {
  KnowledgeRuntimeJob,
  KnowledgeRuntimeQueue
} from "./local-knowledge-runtime-queue.ts";

type DurableRuntimeJobStatus =
  | "pending"
  | "leased"
  | "retryable"
  | "completed"
  | "failed";

export type DurableKnowledgeRuntimeJob = KnowledgeRuntimeJob & {
  runtimeJobId: string;
  status: DurableRuntimeJobStatus;
  attemptCount: number;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  nextAttemptAt: string;
};

type RuntimeJobRecord = {
  runtimeJobId: string;
  workspaceId: string;
  targetJobId: string;
  kind: "google-drive-sync" | "document-ingestion";
  status: DurableRuntimeJobStatus;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  nextAttemptAt: string;
};

export class PermanentKnowledgeRuntimeError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, safeMessage: string) {
    super(safeMessage);
    this.name = "PermanentKnowledgeRuntimeError";
    this.errorCode = errorCode;
  }
}

export class PrismaKnowledgeRuntimeQueue implements KnowledgeRuntimeQueue {
  private readonly prisma: PrismaClient;
  private readonly leaseOwner: string;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private readonly handlers: {
    googleDriveSync: (
      job: Extract<KnowledgeRuntimeJob, { kind: "google-drive-sync" }>
    ) => Promise<void>;
    documentIngestion?: (
      job: Extract<KnowledgeRuntimeJob, { kind: "document-ingestion" }>
    ) => Promise<void>;
  };
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;

  constructor(input: {
    prisma: PrismaClient;
    leaseOwner: string;
    leaseMs: number;
    maxAttempts: number;
    pollIntervalMs: number;
    now?: () => Date;
    handlers: {
      googleDriveSync: (
        job: Extract<KnowledgeRuntimeJob, { kind: "google-drive-sync" }>
      ) => Promise<void>;
      documentIngestion?: (
        job: Extract<KnowledgeRuntimeJob, { kind: "document-ingestion" }>
      ) => Promise<void>;
    };
  }) {
    this.prisma = input.prisma;
    this.leaseOwner = input.leaseOwner;
    this.leaseMs = Math.max(1_000, input.leaseMs);
    this.maxAttempts = Math.max(1, input.maxAttempts);
    this.pollIntervalMs = Math.max(250, input.pollIntervalMs);
    this.now = input.now ?? (() => new Date());
    this.handlers = input.handlers;
  }

  async enqueue(job: KnowledgeRuntimeJob): Promise<void> {
    const now = this.now().toISOString();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "knowledge_runtime_jobs"
        ("runtimeJobId", "workspaceId", "targetJobId", "kind", "status",
         "attemptCount", "nextAttemptAt", "queuedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'pending', 0, $5, $5, $5, $5)
       ON CONFLICT ("kind", "targetJobId") DO NOTHING`,
      randomUUID(),
      job.workspaceId,
      job.jobId,
      job.kind,
      now
    );
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    this.timer.unref?.();
    queueMicrotask(() => void this.tick());
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<boolean> {
    if (this.ticking) return false;
    this.ticking = true;
    try {
      const claimed = await this.claimNext();
      if (!claimed) return false;
      const heartbeat = setInterval(
        () => void this.renewLease(claimed.runtimeJobId),
        Math.max(1_000, Math.floor(this.leaseMs / 3))
      );
      heartbeat.unref?.();
      try {
        if (claimed.kind === "google-drive-sync") {
          await this.handlers.googleDriveSync(claimed);
        } else if (this.handlers.documentIngestion) {
          await this.handlers.documentIngestion(claimed);
        } else {
          throw new PermanentKnowledgeRuntimeError(
            "knowledge.runtime_handler_unavailable",
            "The knowledge runtime handler is unavailable."
          );
        }
        await this.complete(claimed.runtimeJobId);
      } catch (error) {
        await this.fail(claimed, error);
      } finally {
        clearInterval(heartbeat);
      }
      return true;
    } finally {
      this.ticking = false;
    }
  }

  async claimNext(): Promise<DurableKnowledgeRuntimeJob | null> {
    const now = this.now();
    const nowIso = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseMs).toISOString();
    const records = await this.prisma.$queryRawUnsafe<RuntimeJobRecord[]>(
      `WITH candidate AS (
         SELECT "runtimeJobId"
         FROM "knowledge_runtime_jobs"
         WHERE (
           ("status" IN ('pending', 'retryable') AND "nextAttemptAt" <= $1)
           OR ("status" = 'leased' AND "leaseExpiresAt" < $1)
         )
         ORDER BY "nextAttemptAt" ASC, "queuedAt" ASC, "runtimeJobId" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE "knowledge_runtime_jobs" AS job
       SET "status" = 'leased',
           "leaseOwner" = $2,
           "leaseExpiresAt" = $3,
           "attemptCount" = job."attemptCount" + 1,
           "startedAt" = COALESCE(job."startedAt", $1),
           "updatedAt" = $1
       FROM candidate
       WHERE job."runtimeJobId" = candidate."runtimeJobId"
       RETURNING job."runtimeJobId", job."workspaceId", job."targetJobId",
                 job."kind", job."status", job."attemptCount", job."leaseOwner",
                 job."leaseExpiresAt", job."nextAttemptAt"`,
      nowIso,
      this.leaseOwner,
      leaseExpiresAt
    );
    return records[0] ? toDurableJob(records[0]) : null;
  }

  async complete(runtimeJobId: string): Promise<void> {
    const now = this.now().toISOString();
    await this.prisma.$executeRawUnsafe(
      `UPDATE "knowledge_runtime_jobs"
       SET "status" = 'completed', "completedAt" = $1, "leaseOwner" = NULL,
           "leaseExpiresAt" = NULL, "failureCode" = NULL,
           "failureMessage" = NULL, "updatedAt" = $1
       WHERE "runtimeJobId" = $2 AND "status" = 'leased'
         AND "leaseOwner" = $3`,
      now,
      runtimeJobId,
      this.leaseOwner
    );
  }

  async renewLease(runtimeJobId: string): Promise<void> {
    const now = this.now();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseMs).toISOString();
    await this.prisma.$executeRawUnsafe(
      `UPDATE "knowledge_runtime_jobs"
       SET "leaseExpiresAt" = $1, "updatedAt" = $2
       WHERE "runtimeJobId" = $3 AND "status" = 'leased'
         AND "leaseOwner" = $4`,
      leaseExpiresAt,
      now.toISOString(),
      runtimeJobId,
      this.leaseOwner
    );
  }

  async fail(
    job: DurableKnowledgeRuntimeJob,
    error: unknown
  ): Promise<void> {
    const now = this.now();
    const permanent = error instanceof PermanentKnowledgeRuntimeError;
    const retryable = !permanent && job.attemptCount < this.maxAttempts;
    const nextAttemptAt = retryable
      ? new Date(
          now.getTime() + Math.min(60_000, 1_000 * 2 ** (job.attemptCount - 1))
        ).toISOString()
      : now.toISOString();
    const failureCode = permanent
      ? error.errorCode
      : retryable
        ? "knowledge.runtime_transient_failure"
        : "knowledge.runtime_attempts_exhausted";
    const failureMessage = permanent
      ? error.message
      : retryable
        ? "Knowledge runtime work will be retried."
        : "Knowledge runtime work failed after the retry limit.";
    await this.prisma.$executeRawUnsafe(
      `UPDATE "knowledge_runtime_jobs"
       SET "status" = $1, "nextAttemptAt" = $2, "failureCode" = $3,
           "failureMessage" = $4, "leaseOwner" = NULL,
           "leaseExpiresAt" = NULL, "updatedAt" = $5
       WHERE "runtimeJobId" = $6 AND "status" = 'leased'
         AND "leaseOwner" = $7`,
      retryable ? "retryable" : "failed",
      nextAttemptAt,
      failureCode,
      failureMessage,
      now.toISOString(),
      job.runtimeJobId,
      this.leaseOwner
    );
  }
}

function toDurableJob(record: RuntimeJobRecord): DurableKnowledgeRuntimeJob {
  return {
    runtimeJobId: record.runtimeJobId,
    kind: record.kind,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    jobId: record.targetJobId as EntityId<"jobId">,
    status: record.status,
    attemptCount: record.attemptCount,
    ...(record.leaseOwner ? { leaseOwner: record.leaseOwner } : {}),
    ...(record.leaseExpiresAt
      ? { leaseExpiresAt: record.leaseExpiresAt }
      : {}),
    nextAttemptAt: record.nextAttemptAt
  } as DurableKnowledgeRuntimeJob;
}
