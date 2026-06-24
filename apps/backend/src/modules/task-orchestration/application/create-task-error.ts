import type { EntityId } from "@vcp/shared";

/**
 * Application-level error for create-task failures.
 *
 * This error is thrown when a CreateTaskCommand fails validation after
 * command construction and domain validation, such as when a requested
 * routing target is unavailable or inaccessible in the workspace.
 *
 * Does not expose Prisma, private Agent/Workflow objects, or HTTP status codes.
 * Distinguishes between Agent target and Workflow target rejection.
 * Preserves workspace-safe target context for debugging.
 */
export class CreateTaskError extends Error {
  readonly errorType: "invalid-agent-target" | "invalid-workflow-target";
  readonly workspaceId: EntityId<"workspaceId">;
  readonly targetId: EntityId<"agentId"> | EntityId<"workflowId">;

  constructor(params: {
    errorType: "invalid-agent-target" | "invalid-workflow-target";
    workspaceId: EntityId<"workspaceId">;
    targetId: EntityId<"agentId"> | EntityId<"workflowId">;
  }) {
    const targetType = params.errorType === "invalid-agent-target" ? "agent" : "workflow";
    super(
      `Cannot create task: requested ${targetType} is not available in workspace ${params.workspaceId}`
    );
    this.name = "CreateTaskError";
    this.errorType = params.errorType;
    this.workspaceId = params.workspaceId;
    this.targetId = params.targetId;
  }
}
