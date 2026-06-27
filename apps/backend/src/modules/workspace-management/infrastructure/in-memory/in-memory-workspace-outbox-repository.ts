import type { WorkspaceSafeFailure } from "../../domain/workspace-failure.ts";
import type {
  CreateOutboxMessageInput,
  OutboxMessageRecord,
  WorkspaceTransaction
} from "../../application/ports/workspace-persistence-types.ts";
import type { WorkspaceOutboxRepository } from "../../application/ports/workspace-outbox-repository.ts";

export class InMemoryWorkspaceOutboxRepository implements WorkspaceOutboxRepository {
  readonly records: OutboxMessageRecord[] = [];

  seed(record: OutboxMessageRecord): void {
    this.records.push(record);
  }

  async enqueue(
    input: CreateOutboxMessageInput,
    _tx: WorkspaceTransaction
  ): Promise<OutboxMessageRecord> {
    const record: OutboxMessageRecord = {
      status: "pending",
      attemptCount: 0,
      maxAttempts: 10,
      publishedAt: null,
      deadLetteredAt: null,
      version: 1,
      ...input
    } as OutboxMessageRecord;
    this.records.push(record);
    return record;
  }

  async claimNextPendingMessage(input: {
    publisherId: string;
    leaseToken: string;
    now: string;
    leaseExpiresAt: string;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null> {
    const index = this.records.findIndex(
      (r) =>
        (r.status === "pending" || r.status === "retry_scheduled") &&
        (r.nextAttemptAt === null || r.nextAttemptAt <= input.now)
    );
    if (index < 0) return null;
    const current = this.records[index] as OutboxMessageRecord;
    const claimed: OutboxMessageRecord = {
      ...current,
      status: "publishing",
      leaseToken: input.leaseToken,
      leaseExpiresAt: input.leaseExpiresAt,
      lastAttemptAt: input.now,
      attemptCount: current.attemptCount + 1,
      updatedAt: input.now,
      version: current.version + 1
    };
    this.records[index] = claimed;
    return claimed;
  }

  async markPublished(input: {
    outboxMessageId: string;
    leaseToken: string;
    expectedVersion: number;
    publishedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null> {
    return this.mutate(input, {
      status: "published",
      publishedAt: input.publishedAt,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: input.publishedAt
    });
  }

  async schedulePublishRetry(input: {
    outboxMessageId: string;
    leaseToken: string;
    expectedVersion: number;
    nextAttemptAt: string;
    safeFailure: WorkspaceSafeFailure;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null> {
    return this.mutate(input, {
      status: "retry_scheduled",
      nextAttemptAt: input.nextAttemptAt,
      lastErrorCode: input.safeFailure.code,
      lastErrorMessage: input.safeFailure.message,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: input.nextAttemptAt
    });
  }

  async markDeadLettered(input: {
    outboxMessageId: string;
    leaseToken: string;
    expectedVersion: number;
    failedAt: string;
    safeFailure: WorkspaceSafeFailure;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null> {
    return this.mutate(input, {
      status: "dead_lettered",
      deadLetteredAt: input.failedAt,
      lastErrorCode: input.safeFailure.code,
      lastErrorMessage: input.safeFailure.message,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: input.failedAt
    });
  }

  private mutate(
    input: { outboxMessageId: string; leaseToken: string; expectedVersion: number },
    patch: Partial<OutboxMessageRecord>
  ): OutboxMessageRecord | null {
    const index = this.records.findIndex(
      (r) =>
        r.outboxMessageId === input.outboxMessageId &&
        r.leaseToken === input.leaseToken &&
        r.version === input.expectedVersion
    );
    if (index < 0) return null;
    const current = this.records[index] as OutboxMessageRecord;
    const next: OutboxMessageRecord = { ...current, ...patch, version: current.version + 1 };
    this.records[index] = next;
    return next;
  }
}
