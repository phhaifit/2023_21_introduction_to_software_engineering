import {
  WorkspaceEventPublishFailure,
  type WorkspaceEventPublisherPort
} from "../application/ports/workspace-event-publisher-port.ts";
import type { WorkspaceDomainEvent } from "../application/services/workspace-event-factory.ts";
import type { WorkspaceVisibilityProjectionRepository } from "../application/ports/workspace-visibility-projection-repository.ts";
import type { WorkspaceTransaction } from "../application/ports/workspace-persistence-types.ts";

const TX = {} as WorkspaceTransaction;

export class LocalDevWorkspaceEventPublisher implements WorkspaceEventPublisherPort {
  private readonly visibility: WorkspaceVisibilityProjectionRepository;

  constructor(visibility: WorkspaceVisibilityProjectionRepository) {
    this.visibility = visibility;
  }

  async publish(event: WorkspaceDomainEvent<unknown>): Promise<void> {
    console.log(`[WorkspaceEvent] ${event.eventType} | aggregate=${event.aggregateId}`);

    if (event.eventType === "workspace.created.v1") {
      const payload = event.payload as { workspaceId?: string; createdByUserId?: string };
      if (payload.workspaceId && payload.createdByUserId) {
        await this.visibility.upsertAccess({
          userId: payload.createdByUserId,
          workspaceId: payload.workspaceId,
          canRead: true,
          canDelete: true,
          membershipVersion: 1,
          projectionUpdatedAt: event.occurredAt,
          tx: TX
        });
      }
    }

    if (event.eventType === "workspace.deleted.v1") {
      const payload = event.payload as { workspaceId?: string };
      if (payload.workspaceId) {
        // No-op for now: visibility record stays but workspace is deleted
      }
    }
  }
}
