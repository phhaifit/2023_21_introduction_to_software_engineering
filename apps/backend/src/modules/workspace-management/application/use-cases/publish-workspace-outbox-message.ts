import type { WorkspaceUnitOfWork } from "../ports/workspace-unit-of-work.ts";
import type { WorkspaceOutboxRepository } from "../ports/workspace-outbox-repository.ts";
import type { WorkspaceEventPublisherPort } from "../ports/workspace-event-publisher-port.ts";
import { WorkspaceEventPublishFailure } from "../ports/workspace-event-publisher-port.ts";
import type { WorkspaceClock } from "../ports/workspace-clock.ts";
import type { WorkspaceSafeFailure } from "../../domain/workspace-failure.ts";
import { decodeWorkspaceDomainEvent } from "../services/workspace-event-factory.ts";

export type PublishOneResult =
  | { readonly kind: "no_message" }
  | { readonly kind: "published"; readonly outboxMessageId: string }
  | { readonly kind: "retry_scheduled"; readonly outboxMessageId: string }
  | { readonly kind: "dead_lettered"; readonly outboxMessageId: string }
  | { readonly kind: "lease_lost"; readonly outboxMessageId: string };

type PublisherInput = {
  readonly publisherId: string;
  readonly now: string;
  readonly leaseToken: string;
  readonly leaseExpiresAt: string;
};

export class PublishWorkspaceOutboxMessageUseCase {
  private readonly unitOfWork: WorkspaceUnitOfWork;
  private readonly outbox: WorkspaceOutboxRepository;
  private readonly publisher: WorkspaceEventPublisherPort;
  private readonly clock: WorkspaceClock;

  constructor(
    unitOfWork: WorkspaceUnitOfWork,
    outbox: WorkspaceOutboxRepository,
    publisher: WorkspaceEventPublisherPort,
    clock: WorkspaceClock
  ) {
    this.unitOfWork = unitOfWork;
    this.outbox = outbox;
    this.publisher = publisher;
    this.clock = clock;
  }

  async publishOne(input: PublisherInput): Promise<PublishOneResult> {
    const message = await this.unitOfWork.run(async (tx) =>
      this.outbox.claimNextPendingMessage({
        publisherId: input.publisherId,
        leaseToken: input.leaseToken,
        now: input.now,
        leaseExpiresAt: input.leaseExpiresAt,
        tx
      })
    );

    if (!message) {
      return { kind: "no_message" };
    }

    let event;
    try {
      event = decodeWorkspaceDomainEvent(message.payload);
    } catch {
      const safeFailure: WorkspaceSafeFailure = {
        code: "outbox.decode_failed",
        message: "Could not decode workspace domain event from outbox payload",
        retryClassification: "terminal"
      };
      await this.unitOfWork.run(async (tx) =>
        this.outbox.markDeadLettered({
          outboxMessageId: message.outboxMessageId,
          leaseToken: input.leaseToken,
          expectedVersion: message.version,
          failedAt: input.now,
          safeFailure,
          tx
        })
      );
      return { kind: "dead_lettered", outboxMessageId: message.outboxMessageId };
    }

    let publishError: { classification: "retryable" | "terminal"; code: string; message: string } | null = null;
    try {
      await this.publisher.publish(event);
    } catch (err) {
      if (err instanceof WorkspaceEventPublishFailure) {
        publishError = { classification: err.classification, code: err.code, message: err.message };
      } else {
        publishError = {
          classification: "retryable",
          code: "outbox.unexpected_error",
          message: "Unexpected error during event publishing"
        };
      }
    }

    if (!publishError) {
      const updated = await this.unitOfWork.run(async (tx) =>
        this.outbox.markPublished({
          outboxMessageId: message.outboxMessageId,
          leaseToken: input.leaseToken,
          expectedVersion: message.version,
          publishedAt: input.now,
          tx
        })
      );
      if (!updated) return { kind: "lease_lost", outboxMessageId: message.outboxMessageId };
      return { kind: "published", outboxMessageId: message.outboxMessageId };
    }

    if (publishError.classification === "retryable") {
      const safeFailure: WorkspaceSafeFailure = {
        code: publishError.code,
        message: publishError.message,
        retryClassification: "retryable"
      };
      const updated = await this.unitOfWork.run(async (tx) =>
        this.outbox.schedulePublishRetry({
          outboxMessageId: message.outboxMessageId,
          leaseToken: input.leaseToken,
          expectedVersion: message.version,
          nextAttemptAt: this.clock.addSeconds(input.now, 30),
          safeFailure,
          tx
        })
      );
      if (!updated) return { kind: "lease_lost", outboxMessageId: message.outboxMessageId };
      return { kind: "retry_scheduled", outboxMessageId: message.outboxMessageId };
    }

    const safeFailure: WorkspaceSafeFailure = {
      code: publishError.code,
      message: publishError.message,
      retryClassification: "terminal"
    };
    const updated = await this.unitOfWork.run(async (tx) =>
      this.outbox.markDeadLettered({
        outboxMessageId: message.outboxMessageId,
        leaseToken: input.leaseToken,
        expectedVersion: message.version,
        failedAt: input.now,
        safeFailure,
        tx
      })
    );
    if (!updated) return { kind: "lease_lost", outboxMessageId: message.outboxMessageId };
    return { kind: "dead_lettered", outboxMessageId: message.outboxMessageId };
  }
}
