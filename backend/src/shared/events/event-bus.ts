import type { DomainEvent, DomainEventName } from "../../../../shared/contracts";

export type EventHandler<Name extends DomainEventName = DomainEventName> = (
  event: DomainEvent<Name>
) => Promise<void> | void;

export type EventBus = {
  publish<Name extends DomainEventName>(event: DomainEvent<Name>): Promise<void>;
  subscribe<Name extends DomainEventName>(
    eventName: Name,
    handler: EventHandler<Name>
  ): () => void;
};

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<DomainEventName, Set<EventHandler>>();

  async publish<Name extends DomainEventName>(event: DomainEvent<Name>): Promise<void> {
    const handlers = this.handlers.get(event.name) ?? new Set();

    for (const handler of handlers) {
      await handler(event);
    }
  }

  subscribe<Name extends DomainEventName>(
    eventName: Name,
    handler: EventHandler<Name>
  ): () => void {
    const handlers = this.handlers.get(eventName) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler);
    this.handlers.set(eventName, handlers);

    return () => {
      handlers.delete(handler as EventHandler);
    };
  }
}
