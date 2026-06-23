import type { EntityId, TaskStatus, TaskRoutingSelection } from "@vcp/shared";

export type Task = {
  readonly taskId: EntityId<"taskId">;
  readonly workspaceId: EntityId<"workspaceId">;
  readonly submittedByUserId: EntityId<"userId">;
  readonly prompt: string;
  readonly requestedRouting: TaskRoutingSelection;
  readonly status: TaskStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateTaskDraft = {
  taskId: EntityId<"taskId">;
  workspaceId: EntityId<"workspaceId">;
  submittedByUserId: EntityId<"userId">;
  prompt: string;
  routing: unknown;
  createdAt: string;
  updatedAt: string;
};

export class TaskValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid task: ${issues.join(", ")}`);
    this.name = "TaskValidationError";
    this.issues = issues;
  }
}

import { parseTaskRoutingSelection } from "./routing-validation.ts";

export function createTask(draft: CreateTaskDraft): Task {
  const issues: string[] = [];

  // Validate prompt
  if (typeof draft.prompt !== "string") {
    issues.push("prompt must be a string");
  } else if (draft.prompt.trim().length === 0) {
    issues.push("prompt must not be empty or whitespace-only");
  }

  // Validate all identities are present
  if (!draft.taskId || typeof draft.taskId !== "string") {
    issues.push("taskId is required");
  }
  if (!draft.workspaceId || typeof draft.workspaceId !== "string") {
    issues.push("workspaceId is required");
  }
  if (!draft.submittedByUserId || typeof draft.submittedByUserId !== "string") {
    issues.push("submittedByUserId is required");
  }

  // Validate timestamps
  if (!draft.createdAt || typeof draft.createdAt !== "string") {
    issues.push("createdAt is required");
  }
  if (!draft.updatedAt || typeof draft.updatedAt !== "string") {
    issues.push("updatedAt is required");
  }

  if (issues.length > 0) {
    throw new TaskValidationError(issues);
  }

  // Parse and normalize routing - returns canonical object, never aliases caller's input
  const requestedRouting = parseTaskRoutingSelection(draft.routing);

  return {
    taskId: draft.taskId,
    workspaceId: draft.workspaceId,
    submittedByUserId: draft.submittedByUserId,
    prompt: draft.prompt.trim(),
    requestedRouting,
    status: "queued",
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}
