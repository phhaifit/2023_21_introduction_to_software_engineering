import type { TaskEventPublisher } from "../application/task-event-publisher.ts";
import type { TaskLifecycleEvent } from "../domain/task-events.ts";

export class InMemoryTaskEventPublisher implements TaskEventPublisher {
  readonly events: TaskLifecycleEvent[] = [];

  async publish(event: TaskLifecycleEvent): Promise<void> {
    this.events.push(event);
  }
}
