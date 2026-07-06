import type { CreateTaskResponse } from "@vcp/shared";
import type { CreateTaskCommand } from "./create-task-command.ts";

/**
 * Application boundary for the create-task use case.
 *
 * This interface defines the contract for submitting a task intent and
 * receiving confirmation of the initial Task and TaskWork creation.
 *
 * Implementation deferred to future phase.
 */
export interface CreateTaskUseCase {
  /**
   * Execute the create-task command.
   *
   * @param command - Authenticated command with workspace, submitter, prompt, and routing
   * @returns Promise resolving to the created Task and Work identities with initial status
   * @throws TaskValidationError if prompt is empty, whitespace-only, or IDs are invalid
   * @throws TaskRoutingValidationError if routing is malformed
   */
  execute(command: CreateTaskCommand): Promise<CreateTaskResponse>;
}
