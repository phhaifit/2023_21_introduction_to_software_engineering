import type { EntityId, TaskStatus } from "@vcp/shared";

export type ResolvedTaskRouting =
  | {
      destination: "agent";
      agentId: EntityId<"agentId">;
    }
  | {
      destination: "workflow";
      workflowId: EntityId<"workflowId">;
    };

export type TaskWork = {
  readonly workId: EntityId<"workId">;
  readonly taskId: EntityId<"taskId">;
  readonly workspaceId: EntityId<"workspaceId">;
  readonly attemptNumber: number;
  readonly status: TaskStatus;
  readonly resolvedRouting: ResolvedTaskRouting | null;
  readonly result?: unknown;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly queuedAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateTaskWorkDraft = {
  workId: EntityId<"workId">;
  taskId: EntityId<"taskId">;
  workspaceId: EntityId<"workspaceId">;
  createdAt: string;
  updatedAt: string;
};

export class TaskWorkValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid task work: ${issues.join(", ")}`);
    this.name = "TaskWorkValidationError";
    this.issues = issues;
  }
}

export function createInitialTaskWork(draft: CreateTaskWorkDraft): TaskWork {
  const issues: string[] = [];

  // Validate Work ID
  if (!draft.workId || typeof draft.workId !== "string") {
    issues.push("workId is required");
  }

  // Validate Task ID
  if (!draft.taskId || typeof draft.taskId !== "string") {
    issues.push("taskId is required");
  }

  // Validate Workspace ID
  if (!draft.workspaceId || typeof draft.workspaceId !== "string") {
    issues.push("workspaceId is required");
  }

  // Validate timestamps
  if (!draft.createdAt || typeof draft.createdAt !== "string") {
    issues.push("createdAt is required");
  }
  if (!draft.updatedAt || typeof draft.updatedAt !== "string") {
    issues.push("updatedAt is required");
  }

  if (issues.length > 0) {
    throw new TaskWorkValidationError(issues);
  }

  return {
    workId: draft.workId,
    taskId: draft.taskId,
    workspaceId: draft.workspaceId,
    attemptNumber: 1,
    status: "queued",
    resolvedRouting: null,
    queuedAt: draft.createdAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}
