import type {
  CreateTaskRequest,
  CreateTaskResponse,
  TaskStatus as ProductionTaskStatus
} from "@vcp/shared";

import { createTaskIdentity } from "./task-id";

export interface TaskCreationClient {
  createTask(request: CreateTaskRequest): Promise<CreateTaskResponse>;
}

export interface LocalTaskCreationClientOptions {
  now?: () => string;
  shouldReject?: (request: CreateTaskRequest) => boolean;
}

export function createLocalTaskCreationClient({
  now = () => "2026-06-24T12:00:00.000Z",
  shouldReject = () => false
}: LocalTaskCreationClientOptions = {}): TaskCreationClient {
  return {
    async createTask(request) {
      if (shouldReject(copyCreateTaskRequest(request))) {
        throw new Error("Task creation failed.");
      }

      const identity = createTaskIdentity();

      return {
        ...identity,
        status: "queued" satisfies ProductionTaskStatus,
        createdAt: now()
      };
    }
  };
}

export function copyCreateTaskRequest(
  request: CreateTaskRequest
): CreateTaskRequest {
  if (request.routing.mode === "specific-agent") {
    return {
      prompt: request.prompt,
      routing: {
        mode: "specific-agent",
        agentId: request.routing.agentId
      }
    };
  }

  if (request.routing.mode === "predefined-workflow") {
    return {
      prompt: request.prompt,
      routing: {
        mode: "predefined-workflow",
        workflowId: request.routing.workflowId
      }
    };
  }

  return {
    prompt: request.prompt,
    routing: { mode: "auto" }
  };
}
