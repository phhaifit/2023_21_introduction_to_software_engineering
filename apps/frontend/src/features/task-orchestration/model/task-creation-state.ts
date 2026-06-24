import type {
  CreateTaskRequest,
  CreateTaskResponse,
  EntityId,
  TaskRoutingSelection
} from "@vcp/shared";

import type {
  CreatedTaskRecord,
  ProcessingStep,
  RoutingMode
} from "./task-types";

export interface TaskCreationDraft {
  prompt: string;
  routingMode: RoutingMode;
  selectedAgentId?: string;
  selectedWorkflowId?: string;
}

export interface TaskCreationState {
  tasks: CreatedTaskRecord[];
  activeTaskId?: EntityId<"taskId">;
  isSubmitting: boolean;
  validationError?: string;
  submissionError?: string;
}

export type TaskCreationAction =
  | { type: "submit-started" }
  | { type: "submit-rejected"; message: string }
  | { type: "submission-failed"; message: string }
  | {
      type: "task-created";
      request: CreateTaskRequest;
      response: CreateTaskResponse;
    };

export const INITIAL_PROCESSING_STEPS: readonly ProcessingStep[] = [
  { id: "validate-input", label: "Validate input", status: "waiting" },
  { id: "analyze-request", label: "Analyze request", status: "waiting" },
  { id: "select-routing", label: "Select agent or workflow", status: "waiting" },
  { id: "execute-task", label: "Execute task", status: "waiting" },
  { id: "aggregate-result", label: "Aggregate result", status: "waiting" },
  { id: "finalize", label: "Finalize", status: "waiting" }
];

export const initialTaskCreationState: TaskCreationState = {
  tasks: [],
  isSubmitting: false
};

export type CreateTaskRequestResult =
  | { ok: true; request: CreateTaskRequest }
  | { ok: false; message: string };

export function taskCreationReducer(
  state: TaskCreationState,
  action: TaskCreationAction
): TaskCreationState {
  switch (action.type) {
    case "submit-started":
      return {
        ...state,
        isSubmitting: true,
        validationError: undefined,
        submissionError: undefined
      };
    case "submit-rejected":
      return {
        ...state,
        isSubmitting: false,
        validationError: action.message,
        submissionError: undefined
      };
    case "submission-failed":
      return {
        ...state,
        isSubmitting: false,
        validationError: undefined,
        submissionError: action.message
      };
    case "task-created": {
      const task = createTaskRecord(action.request, action.response);

      return {
        tasks: [...state.tasks, task],
        activeTaskId: task.taskId,
        isSubmitting: false,
        validationError: undefined,
        submissionError: undefined
      };
    }
  }
}

export function buildCreateTaskRequest(
  draft: TaskCreationDraft
): CreateTaskRequestResult {
  const prompt = draft.prompt.trim();

  if (prompt.length === 0) {
    return { ok: false, message: "Enter a task request before sending." };
  }

  const routing = buildRoutingSelection(draft);
  if (!routing.ok) {
    return routing;
  }

  return {
    ok: true,
    request: {
      prompt,
      routing: routing.routing
    }
  };
}

export function createTaskRecord(
  request: CreateTaskRequest,
  response: CreateTaskResponse
): CreatedTaskRecord {
  return {
    taskId: response.taskId,
    workId: response.workId,
    prompt: request.prompt,
    requestedRouting: copyRoutingSelection(request.routing),
    status: response.status,
    createdAt: response.createdAt,
    timeline: INITIAL_PROCESSING_STEPS.map((step) => ({ ...step }))
  };
}

export function getActiveTask(
  state: TaskCreationState
): CreatedTaskRecord | undefined {
  return state.tasks.find((task) => task.taskId === state.activeTaskId);
}

function buildRoutingSelection(
  draft: TaskCreationDraft
):
  | { ok: true; routing: TaskRoutingSelection }
  | { ok: false; message: string } {
  if (draft.routingMode === "specific-agent") {
    if (!draft.selectedAgentId) {
      return { ok: false, message: "Select an available agent before sending." };
    }

    return {
      ok: true,
      routing: {
        mode: "specific-agent",
        agentId: draft.selectedAgentId as EntityId<"agentId">
      }
    };
  }

  if (draft.routingMode === "predefined-workflow") {
    if (!draft.selectedWorkflowId) {
      return { ok: false, message: "Select a predefined workflow before sending." };
    }

    return {
      ok: true,
      routing: {
        mode: "predefined-workflow",
        workflowId: draft.selectedWorkflowId as EntityId<"workflowId">
      }
    };
  }

  return {
    ok: true,
    routing: { mode: "auto" }
  };
}

function copyRoutingSelection(
  routing: TaskRoutingSelection
): TaskRoutingSelection {
  if (routing.mode === "specific-agent") {
    return { mode: "specific-agent", agentId: routing.agentId };
  }

  if (routing.mode === "predefined-workflow") {
    return { mode: "predefined-workflow", workflowId: routing.workflowId };
  }

  return { mode: "auto" };
}
