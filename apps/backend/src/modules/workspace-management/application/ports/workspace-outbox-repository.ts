import type { WorkspaceSafeFailure } from "../../domain/workspace-failure.ts";
import type {
  CreateOutboxMessageInput,
  OutboxMessageRecord,
  WorkspaceTransaction
} from "./workspace-persistence-types.ts";

export interface WorkspaceOutboxRepository {
  enqueue(
    input: CreateOutboxMessageInput,
    tx: WorkspaceTransaction
  ): Promise<OutboxMessageRecord>;

  claimNextPendingMessage(input: {
    publisherId: string;
    leaseToken: string;
    now: string;
    leaseExpiresAt: string;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null>;

  markPublished(input: {
    outboxMessageId: string;
    leaseToken: string;
    expectedVersion: number;
    publishedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null>;

  schedulePublishRetry(input: {
    outboxMessageId: string;
    leaseToken: string;
    expectedVersion: number;
    nextAttemptAt: string;
    safeFailure: WorkspaceSafeFailure;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null>;

  markDeadLettered(input: {
    outboxMessageId: string;
    leaseToken: string;
    expectedVersion: number;
    failedAt: string;
    safeFailure: WorkspaceSafeFailure;
    tx: WorkspaceTransaction;
  }): Promise<OutboxMessageRecord | null>;
}
