import type { EntityId, TaskRoutingSelection } from "@vcp/shared";

/**
 * Authenticated application command for creating a Task.
 *
 * Workspace ID and submitter ID are derived from authenticated RequestContext,
 * not from client input. Task ID, Work ID, status, and timestamps are
 * application-generated, not accepted from the request.
 */
export type CreateTaskCommand = Readonly<{
  workspaceId: EntityId<"workspaceId">;
  submittedByUserId: EntityId<"userId">;
  prompt: string;
  routing: TaskRoutingSelection;
}>;
