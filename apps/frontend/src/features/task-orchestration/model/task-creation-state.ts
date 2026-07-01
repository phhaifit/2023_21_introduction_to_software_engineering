import type {
  CreateTaskRequest,
  CreateTaskResponse,
  EntityId,
  TaskRoutingSelection
} from "@vcp/shared";

import {
  appendProcessingLog,
  activateNextStep,
  activateProviderStep,
  cancelActiveStep,
  completeAllProviderSteps,
  completeActiveStep,
  completeProviderStep,
  createInitialProcessingSnapshot,
  startProcessing,
  startProviderProcessing,
  failActiveStep
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

export interface TaskConversationSession {
  readonly conversationId: string;
  readonly title: string;
  readonly taskIds: readonly EntityId<"taskId">[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TaskCreationState {
  tasks: CreatedTaskRecord[];
  conversations: TaskConversationSession[];
  activeConversationId?: string;
  activeTaskId?: EntityId<"taskId"> | null;
  isSubmitting: boolean;
  validationError?: string;
  submissionError?: string;
  conversationSequence: number;
}

export type TaskCreationAction =
  | { type: "submit-started" }
  | { type: "submit-rejected"; message: string }
  | { type: "submission-failed"; message: string }
  | { type: "feedback-dismissed" }
  | {
      type: "task-created";
      request: CreateTaskRequest;
      response: CreateTaskResponse;
      conversationId?: string;
    }
  | {
      type: "conversation-created";
      createdAt: string;
    }
  | {
      type: "conversation-selected";
      conversationId: string;
    }
  | {
      type: "reset";
    }
  | {
      /** Transitions the canonical status from queued → running and
       *  initialises the processing snapshot. */
      type: "processing-started";
      taskId: EntityId<"taskId">;
      startedAt: string;
    }
  | {
      type: "provider-processing-started";
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
      type: "provider-step-started";
      taskId: EntityId<"taskId">;
      stepId: string;
      stepName: string;
      startedAt: string;
    }
  | {
      /** Marks the currently active step as completed. */
      type: "processing-step-completed";
      taskId: EntityId<"taskId">;
      stepId: string;
      completedAt: string;
    }
  | {
      type: "provider-step-completed";
      taskId: EntityId<"taskId">;
      stepId: string;
      stepName?: string;
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
    }
  | {
      /** Marks the task as cancelled and stops active step. */
      type: "task-cancelled";
      taskId: EntityId<"taskId">;
      cancelledAt: string;
    }
  | {
      /** Marks the task as failed and stops active step. */
      type: "task-failed";
      taskId: EntityId<"taskId">;
      error: import("./task-types").TaskError;
    }
  | {
      /** Updates task state from a received TaskRuntimeEvent. */
      type: "runtime-event";
      event: import("./task-orchestration-provider").TaskRuntimeEvent;
    }
  | {
      type: "conversations-restored";
      conversations: import("@vcp/shared").Conversation[];
    }
  | {
      type: "conversation-deleted";
      conversationId: string;
    }
  | {
      type: "task-deleted";
      taskId: EntityId<"taskId">;
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
  conversations: [],
  isSubmitting: false,
  conversationSequence: 1
};

export type CreateTaskRequestResult =
  | { ok: true; request: CreateTaskRequest }
  | { ok: false; message: string };

export function deriveConversationTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) {
    return "New conversation";
  }
  const MAX_LENGTH = 40;
  if (cleaned.length > MAX_LENGTH) {
    return cleaned.slice(0, MAX_LENGTH).trim() + "…";
  }
  return cleaned;
}

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
    case "feedback-dismissed":
      return {
        ...state,
        validationError: undefined,
        submissionError: undefined
      };
    case "conversation-created": {
      const sequence = state.conversationSequence ?? 1;
      const conversationId = `CONV-${String(sequence).padStart(6, "0")}`;
      const newConversation: TaskConversationSession = {
        conversationId,
        title: "New conversation",
        taskIds: [],
        createdAt: action.createdAt,
        updatedAt: action.createdAt
      };
      return {
        ...state,
        conversations: [...(state.conversations ?? []), newConversation],
        activeConversationId: conversationId,
        activeTaskId: null,
        conversationSequence: sequence + 1
      };
    }
    case "conversation-selected": {
      const conversations = state.conversations ?? [];
      const conversation = conversations.find((c) => c.conversationId === action.conversationId);
      if (!conversation) return state;
      const latestTaskId = conversation.taskIds.length > 0 ? conversation.taskIds[conversation.taskIds.length - 1] : null;
      return {
        ...state,
        activeConversationId: conversation.conversationId,
        activeTaskId: latestTaskId
      };
    }
    case "reset":
      return {
        ...initialTaskCreationState,
        tasks: [],
        conversations: [],
        activeConversationId: undefined,
        activeTaskId: undefined,
        conversationSequence: 1
      };
    case "task-created": {
      const task = createTaskRecord(action.request, action.response);
      const conversations = state.conversations ?? [];
      const targetId = action.conversationId ?? state.activeConversationId;
      let existingConv = conversations.find((c) => c.conversationId === targetId);

      let sequence = state.conversationSequence ?? 1;
      let newConvId = targetId;

      if (!existingConv) {
        newConvId = `CONV-${String(sequence).padStart(6, "0")}`;
        sequence += 1;
        existingConv = {
          conversationId: newConvId,
          title: deriveConversationTitle(task.prompt),
          taskIds: [],
          createdAt: task.createdAt,
          updatedAt: task.createdAt
        };
      }

      const isFirstTask = existingConv.taskIds.length === 0;
      const updatedConv: TaskConversationSession = {
        ...existingConv,
        title: isFirstTask ? deriveConversationTitle(task.prompt) : existingConv.title,
        taskIds: [...existingConv.taskIds.filter((id) => id !== task.taskId), task.taskId],
        updatedAt: task.createdAt
      };

      const updatedConversations = (
        conversations.some((c) => c.conversationId === updatedConv.conversationId)
          ? conversations.map((c) => (c.conversationId === updatedConv.conversationId ? updatedConv : c))
          : [...conversations, updatedConv]
      ).map((c) =>
        c.conversationId === updatedConv.conversationId
          ? c
          : { ...c, taskIds: c.taskIds.filter((id) => id !== task.taskId) }
      );

      const updatedTasks = [...state.tasks.filter((t) => t.taskId !== task.taskId), task];

      return {
        ...state,
        tasks: updatedTasks,
        conversations: updatedConversations,
        activeConversationId: updatedConv.conversationId,
        activeTaskId: task.taskId,
        isSubmitting: false,
        validationError: undefined,
        submissionError: undefined,
        conversationSequence: sequence
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
    case "provider-processing-started": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const transitionResult = transitionTaskStatus(task, "running");
      if (!transitionResult.ok) return state;
      if (task.processingSnapshot.startedAt !== undefined) return state;
      const processingResult = startProviderProcessing(task.processingSnapshot, action.startedAt);
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
    case "provider-step-started": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task || !task.processingSnapshot) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = activateProviderStep(task.processingSnapshot, {
        id: action.stepId,
        label: action.stepName,
        startedAt: action.startedAt
      });
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
    case "provider-step-completed": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task || !task.processingSnapshot) return state;
      if (task.status !== "running") return state;
      if (isTerminalTaskStatus(task.status)) return state;
      const result = completeProviderStep(task.processingSnapshot, {
        id: action.stepId,
        label: action.stepName,
        completedAt: action.completedAt
      });
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
      const finalStep = task.processingSnapshot.steps.at(-1);
      const shouldCompleteProviderSteps = !(finalStep?.id === "finalize" && finalStep.status === "active");

      const updatedTask: CreatedTaskRecord = {
        ...transitionResult.task,
        processingSnapshot: shouldCompleteProviderSteps
          ? completeAllProviderSteps(task.processingSnapshot, action.result.finalizedAt)
          : task.processingSnapshot,
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
    case "task-cancelled": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (isTerminalTaskStatus(task.status)) return state;

      const transitionResult = transitionTaskStatus(task, "cancelled");
      if (!transitionResult.ok) return state;

      const cancelResult = cancelActiveStep(task.processingSnapshot);
      if (!cancelResult.ok) return state;

      const updatedTask: CreatedTaskRecord = {
        ...transitionResult.task,
        processingSnapshot: cancelResult.snapshot,
        cancelledAt: action.cancelledAt
      };

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId ? updatedTask : t
        )
      };
    }
    case "task-failed": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      if (isTerminalTaskStatus(task.status)) return state;

      const transitionResult = transitionTaskStatus(task, "failed");
      if (!transitionResult.ok) return state;

      const failResult = failActiveStep(task.processingSnapshot);
      if (!failResult.ok) return state;

      const updatedTask: CreatedTaskRecord = {
        ...transitionResult.task,
        processingSnapshot: failResult.snapshot,
        error: action.error
      };

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId ? updatedTask : t
        )
      };
    }
    case "runtime-event": {
      if (!action.event.taskSnapshot) {
        return state;
      }
      const updatedTask = action.event.taskSnapshot;
      const exists = state.tasks.some((t) => t.taskId === updatedTask.taskId);
      if (!exists) {
        return state;
      }
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.taskId === updatedTask.taskId ? updatedTask : t))
      };
    }
    case "conversation-deleted": {
      const conversations = state.conversations ?? [];
      const conversation = conversations.find(
        (c) => c.conversationId === action.conversationId
      );
      if (!conversation) {
        return state;
      }

      const removedTaskIds = new Set(conversation.taskIds);
      const remainingTasks = state.tasks.filter(
        (task) => !removedTaskIds.has(task.taskId)
      );
      const remainingConversations = conversations.filter(
        (c) => c.conversationId !== action.conversationId
      );

      let activeConversationId = state.activeConversationId;
      let activeTaskId = state.activeTaskId;

      if (activeConversationId === action.conversationId) {
        const fallbackConversation =
          remainingConversations[remainingConversations.length - 1];
        activeConversationId = fallbackConversation?.conversationId;
        activeTaskId =
          fallbackConversation && fallbackConversation.taskIds.length > 0
            ? fallbackConversation.taskIds[fallbackConversation.taskIds.length - 1]
            : null;
      } else if (
        activeTaskId &&
        removedTaskIds.has(activeTaskId as EntityId<"taskId">)
      ) {
        const activeConv = remainingConversations.find(
          (c) => c.conversationId === activeConversationId
        );
        activeTaskId =
          activeConv && activeConv.taskIds.length > 0
            ? activeConv.taskIds[activeConv.taskIds.length - 1]
            : null;
      }

      return {
        ...state,
        tasks: remainingTasks,
        conversations: remainingConversations,
        activeConversationId,
        activeTaskId
      };
    }
    case "task-deleted": {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) {
        return state;
      }

      const remainingTasks = state.tasks.filter(
        (t) => t.taskId !== action.taskId
      );
      const remainingConversations = (state.conversations ?? []).map((conv) =>
        conv.taskIds.includes(action.taskId)
          ? {
              ...conv,
              taskIds: conv.taskIds.filter((id) => id !== action.taskId)
            }
          : conv
      );

      let activeTaskId = state.activeTaskId;
      if (activeTaskId === action.taskId) {
        const activeConv = remainingConversations.find(
          (c) => c.conversationId === state.activeConversationId
        );
        activeTaskId =
          activeConv && activeConv.taskIds.length > 0
            ? activeConv.taskIds[activeConv.taskIds.length - 1]
            : null;
      }

      return {
        ...state,
        tasks: remainingTasks,
        conversations: remainingConversations,
        activeTaskId
      };
    }
    case "conversations-restored": {
      if (!action.conversations || action.conversations.length === 0) {
        return state;
      }
      const newTasks: CreatedTaskRecord[] = [...state.tasks];
      const newConversations: TaskConversationSession[] = [...state.conversations];
      let sequence = state.conversationSequence ?? 1;

      for (const conv of action.conversations) {
        let existing = newConversations.find((c) => c.conversationId === conv.conversationId);
        const taskIds: EntityId<"taskId">[] = [];
        sequence = Math.max(sequence, getNextConversationSequence(conv.conversationId as string));

        for (const msg of conv.messages || []) {
          if (msg.role === "user") {
            const taskId = msg.messageId as string;
            const assistantMessage = conv.messages.find(
              (m) =>
                m.role === "assistant" &&
                (m.messageId === `${taskId}-assistant` ||
                  m.timestamp >= msg.timestamp)
            );
            taskIds.push(taskId as any);
            if (!newTasks.some((t) => t.taskId === taskId)) {
              newTasks.push(createRestoredTaskRecord({
                taskId,
                prompt: msg.content,
                createdAt: msg.timestamp || conv.createdAt,
                updatedAt: conv.updatedAt,
                assistantMessage
              }));
            }
          }
        }

        if (existing) {
          existing = { ...existing, title: conv.title || existing.title, taskIds: Array.from(new Set([...existing.taskIds, ...taskIds])) };
          newConversations.splice(newConversations.findIndex((c) => c.conversationId === conv.conversationId), 1, existing);
        } else {
          newConversations.push({
            conversationId: conv.conversationId as string,
            title: conv.title || "Restored conversation",
            taskIds,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
          });
        }
      }

      const activeConvId = state.activeConversationId || (newConversations.length > 0 ? newConversations[0].conversationId : undefined);
      const activeConv = newConversations.find((c) => c.conversationId === activeConvId);
      const activeTaskId = activeConv && activeConv.taskIds.length > 0 ? activeConv.taskIds[activeConv.taskIds.length - 1] : state.activeTaskId;

      return {
        ...state,
        tasks: newTasks,
        conversations: newConversations,
        activeConversationId: activeConvId,
        activeTaskId,
        conversationSequence: sequence
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

export function getConversationById(
  state: TaskCreationState,
  conversationId: string
): TaskConversationSession | undefined {
  const conversations = state.conversations ?? [];
  return conversations.find((c) => c.conversationId === conversationId);
}

export function getActiveConversation(
  state: TaskCreationState
): TaskConversationSession | undefined {
  if (!state.activeConversationId) {
    return undefined;
  }
  return getConversationById(state, state.activeConversationId);
}

export function getConversationTasks(
  state: TaskCreationState,
  conversationId: string
): CreatedTaskRecord[] {
  const conversation = getConversationById(state, conversationId);
  if (!conversation) {
    return [];
  }
  const result: CreatedTaskRecord[] = [];
  for (const taskId of conversation.taskIds) {
    const task = state.tasks.find((t) => t.taskId === taskId);
    if (task) {
      result.push(task);
    }
  }
  return result;
}

export function getLatestConversationTask(
  state: TaskCreationState,
  conversationId: string
): CreatedTaskRecord | undefined {
  const conversation = getConversationById(state, conversationId);
  if (!conversation || conversation.taskIds.length === 0) {
    return undefined;
  }
  const latestTaskId = conversation.taskIds[conversation.taskIds.length - 1];
  return state.tasks.find((t) => t.taskId === latestTaskId);
}

export function getActiveTask(
  state: TaskCreationState
): CreatedTaskRecord | undefined {
  return state.tasks.find((task) => task.taskId === state.activeTaskId);
}

export function conversationHasNonTerminalTasks(
  state: TaskCreationState,
  conversationId: string
): boolean {
  return getConversationTasks(state, conversationId).some(
    (task) => !isTerminalTaskStatus(task.status)
  );
}

export function isTaskDeletable(task: CreatedTaskRecord): boolean {
  return isTerminalTaskStatus(task.status);
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

function createRestoredTaskRecord({
  taskId,
  prompt,
  createdAt,
  updatedAt,
  assistantMessage
}: {
  taskId: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  assistantMessage?: import("@vcp/shared").ChatMessage;
}): CreatedTaskRecord {
  const base = {
    taskId: taskId as EntityId<"taskId">,
    workId: `work-${taskId}` as EntityId<"workId">,
    prompt,
    requestedRouting: { mode: "auto" as const },
    createdAt,
    processingSnapshot: createInitialProcessingSnapshot(INITIAL_PROCESSING_STEPS),
    streamingSnapshot: createInitialStreamingSnapshot()
  };

  if (!assistantMessage || assistantMessage.content.trim().length === 0) {
    return {
      ...base,
      status: "queued"
    };
  }

  return {
    ...base,
    status: "succeeded",
    processingSnapshot: createRestoredRuntimeSnapshot(),
    finalizedResult: {
      text: assistantMessage.content,
      finalizedAt: assistantMessage.timestamp || updatedAt,
      artifacts: [],
      followUpPromptSuggestions: []
    }
  };
}

function createRestoredRuntimeSnapshot(): import("./task-processing").ProcessingSnapshot {
  return {
    startedAt: undefined,
    steps: [],
    logs: []
  };
}

function getNextConversationSequence(conversationId: string): number {
  const match = /^CONV-(\d+)$/.exec(conversationId);
  if (!match) {
    return 1;
  }
  return Number.parseInt(match[1], 10) + 1;
}
