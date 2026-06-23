import type { EntityId } from "./ids.ts";
import type { TaskStatus } from "./statuses.ts";

export const TASK_ROUTING_MODES = [
  "auto",
  "specific-agent",
  "predefined-workflow"
] as const;

export type TaskRoutingMode = (typeof TASK_ROUTING_MODES)[number];

export type TaskRoutingSelection =
  | {
      mode: "auto";
      agentId?: never;
      workflowId?: never;
    }
  | {
      mode: "specific-agent";
      agentId: EntityId<"agentId">;
      workflowId?: never;
    }
  | {
      mode: "predefined-workflow";
      workflowId: EntityId<"workflowId">;
      agentId?: never;
    };

export type CreateTaskRequest = {
  prompt: string;
  routing: TaskRoutingSelection;
};

export type CreateTaskResponse = {
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  status: TaskStatus;
  createdAt: string;
};
