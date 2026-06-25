import type {
  CreateTaskRequest,
  CreateTaskResponse,
  EntityId,
  TaskRoutingSelection
} from "@vcp/shared";

import {
  appendProcessingLog,
  activateNextStep,
  completeActiveStep,
  createInitialProcessingSnapshot,
  startProcessing
} from "./task-processing";
import {
  appendStreamingFragment,
  createInitialStreamingSnapshot,
  exhaustStreaming,
  startStreaming
} from "./task-streaming";
import {
  isTaskReadyForCompletion,
  isValidFinalizedResult,
  type TaskFinalizedResult
} from "./task-completion";
import type { TaskLog } from "./task-types";
import type {
  CreatedTaskRecord,
  RoutingMode
} from "./task-types";
import {
  isTerminalTaskStatus,
  transitionTaskStatus
} from "./task-lifecycle";

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
    }
  | {
      /** Transitions the canonical status from queued → running and
       *  initialises the processing snapshot. */
      type: "processing-started";
      taskId: EntityId<"taskId">;
      startedAt: string;
    }
  | {
      /** Marks a waiting step as active in the processing snapshot. */
      type: "processing-step-activated";
      taskId: EntityId<"taskId">;
      stepId: string;
    }
  | {
      /** Marks the currently active step as completed. */
      type: "processing-step-completed";
      taskId: EntityId<"taskId">;
      stepId: string;
      completedAt: string;
    }
  | {
      /** Appends a log entry to the processing snapshot. */
      type: "processing-log-appended";
      taskId: EntityId<"taskId">;
      log: TaskLog;
    }
  | {
      /** Begins partial-result streaming for a running task. */
      type: "streaming-started";
      taskId: EntityId<"taskId">;
      startedAt: string;
    }
  | {
      /** Appends one streaming fragment to the partial-result snapshot. */
      type: "streaming-fragment-appended";
      taskId: EntityId<"taskId">;
      fragmentId: string;
      sequence: number;
      text: string;
      appendedAt: string;
    }
  | {
      /** Marks partial-result streaming as exhausted. */
      type: "streaming-exhausted";
      taskId: EntityId<"taskId">;
      exhaustedAt: string;
    }
  | {
      /** Atomically stores the finalized result and completes the task. */
      type: "task-completed";
      taskId: EntityId<"taskId">;
      result: TaskFinalizedResult;
    };

export const INITIAL_PROCESSING_STEPS: readonly import("./task-types").ProcessingStep[] = [
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
    case "processing-started": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      // Reject terminal-state start
      if (isTerminalTaskStatus(task.status)) return state;
      // Enforce queued → running lifecycle transition
      const transitionResult = transitionTaskStatus(task, "running");
      if (!transitionResult.ok) return state;
      // Guard duplicate start
      if (task.processingSnapshot.startedAt !== undefined) return state;
      // Use the existing snapshot as base (already initialized on creation)
      const processingResult = startProcessing(task.processingSnapshot, action.startedAt);
      if (!processingResult.ok) return state;
      const updatedTask: CreatedTaskRecord = {
        ...transitionResult.task,
        processingSnapshot: processingResult.snapshot
      };
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId ? updatedTask : t
        )
      };
    }
    case "processing-step-activated": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task || !task.processingSnapshot) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = activateNextStep(task.processingSnapshot, action.stepId);
      if (!result.ok) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? { ...t, processingSnapshot: result.snapshot }
            : t
        )
      };
    }
    case "processing-step-completed": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task || !task.processingSnapshot) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = completeActiveStep(
        task.processingSnapshot,
        action.stepId,
        action.completedAt
      );
      if (!result.ok) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? { ...t, processingSnapshot: result.snapshot }
            : t
        )
      };
    }
    case "processing-log-appended": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task || !task.processingSnapshot) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = appendProcessingLog(task.processingSnapshot, action.log);
      if (!result.ok) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? { ...t, processingSnapshot: result.snapshot }
            : t
        )
      };
    }
    case "streaming-started": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = startStreaming(task.streamingSnapshot, action.startedAt);
      if (!result.ok) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? { ...t, streamingSnapshot: result.snapshot }
            : t
        )
      };
    }
    case "streaming-fragment-appended": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = appendStreamingFragment(task.streamingSnapshot, {
        id: action.fragmentId,
        sequence: action.sequence,
        text: action.text,
        appendedAt: action.appendedAt
      });
      if (!result.ok) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? { ...t, streamingSnapshot: result.snapshot }
            : t
        )
      };
    }
    case "streaming-exhausted": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = exhaustStreaming(
        task.streamingSnapshot,
        action.exhaustedAt
      );
      if (!result.ok) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? { ...t, streamingSnapshot: result.snapshot }
            : t
        )
      };
    }
    case "task-completed": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (!isTaskReadyForCompletion(task)) return state;
      if (!isValidFinalizedResult(action.result)) return state;
      const transitionResult = transitionTaskStatus(task, "succeeded");
      if (!transitionResult.ok) return state;

      const updatedTask: CreatedTaskRecord = {
        ...transitionResult.task,
        processingSnapshot: task.processingSnapshot,
        streamingSnapshot: task.streamingSnapshot,
        finalizedResult: { ...action.result }
      };

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId ? updatedTask : t
        )
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
    processingSnapshot: createInitialProcessingSnapshot(INITIAL_PROCESSING_STEPS),
    streamingSnapshot: createInitialStreamingSnapshot()
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
