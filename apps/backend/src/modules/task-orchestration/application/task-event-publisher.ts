import type { TaskLifecycleEvent } from "../domain/task-events.ts";

/**
 * Publication boundary for task lifecycle events.
 *
 * The TaskEventPublisher port defines the contract for publishing immutable
 * task lifecycle events. Implementations are responsible for durable publication
 * and retry policies.
 *
 * The publisher depends only on Task & Orchestration event contracts. It must
 * not expose Prisma types, broker types, HTTP types, or private types from
 * other modules.
 *
 * This interface defines no subscription API, retry policy, batch API, or
 * broker-specific configuration.
 */
export interface TaskEventPublisher {
  /**
   * Publish a task lifecycle event.
   *
   * @param event - The immutable lifecycle event to publish.
   * @throws If publication fails and the error is not recovered by retry policy.
   */
  publish(event: TaskLifecycleEvent): Promise<void>;
}
