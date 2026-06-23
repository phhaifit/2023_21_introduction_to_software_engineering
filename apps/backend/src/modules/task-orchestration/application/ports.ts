import type { EntityId } from "@vcp/shared";

/**
 * Application port for generating deterministic task and work identities.
 *
 * This port is injected as a dependency to enable testability and avoid
 * global random state in domain/application code.
 *
 * Implementation deferred to future phase.
 */
export interface TaskIdentityGenerator {
  /**
   * Generate the next Task identifier.
   *
   * @returns Typed Task identifier as EntityId<"taskId">
   */
  nextTaskId(): EntityId<"taskId">;

  /**
   * Generate the next Work identifier for a TaskWork.
   *
   * @returns Typed Work identifier as EntityId<"workId">
   */
  nextWorkId(): EntityId<"workId">;
}

/**
 * Application port for time access.
 *
 * Returns deterministic ISO-8601 string representations.
 * This port is injected as a dependency to avoid global Date.now() calls
 * in domain/application code.
 *
 * Implementation deferred to future phase.
 */
export interface TaskClock {
  /**
   * Get the current timestamp.
   *
   * @returns ISO-8601 string representation of the current moment
   */
  now(): string;
}

/**
 * Application port for verifying and retrieving Agent routing information.
 *
 * This port provides the smallest operation required by routing resolution:
 * verify whether a specific Agent is currently selectable within a workspace.
 *
 * Must not import Agent Management private repositories or persistence entities.
 *
 * Implementation deferred to future phase.
 */
export interface AgentRoutingCatalog {
  /**
   * Check whether an Agent is currently selectable.
   *
   * @param workspaceId - Workspace context
   * @param agentId - Agent identifier
   * @returns Promise<true> if the agent belongs to the workspace and is selectable;
   *          Promise<false> if the agent is missing, inaccessible, or unavailable
   */
  isAgentSelectable(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<boolean>;
}

/**
 * Application port for verifying and retrieving Workflow routing information.
 *
 * This port provides the smallest operation required by routing resolution:
 * verify whether a specific Workflow is currently executable within a workspace.
 *
 * Must not import Workflow Management private repositories or persistence entities.
 *
 * Implementation deferred to future phase.
 */
export interface WorkflowRoutingCatalog {
  /**
   * Check whether a Workflow is currently executable.
   *
   * @param workspaceId - Workspace context
   * @param workflowId - Workflow identifier
   * @returns Promise<true> if the workflow belongs to the workspace and is executable;
   *          Promise<false> if the workflow is missing, inaccessible, or unavailable
   */
  isWorkflowExecutable(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): Promise<boolean>;
}
