import type { EntityId } from "@vcp/shared";
import type { CreatedTaskRecord, TaskError } from "./task-types";
import { createTaskRuntimeRegistry, type TaskRuntimeRegistry } from "./task-runtime-registry";
import { createMockTaskCreationClient, type TaskCreationClient } from "./task-creation-client";
import { taskCreationReducer, createTaskRecord } from "./task-creation-state";
import { createBrowserTaskProcessingRuntime, type TaskProcessingRuntime } from "./task-processing-runtime";
import { createDefaultTaskStreamingRuntime, DEFAULT_TASK_STREAMING_DELAYS, type TaskStreamingDelays, type TaskStreamingRuntime } from "./task-streaming-runtime";
import { createBrowserTaskCompletionRuntime, DEFAULT_TASK_COMPLETION_DELAYS, type TaskCompletionDelays, type TaskCompletionRuntime } from "./task-completion-runtime";
import type { TaskCancellationCoordinator } from "./task-cancellation-coordinator";
import { DEMO_TIMINGS } from "../mocks/task-orchestration-mocks";
import { isTerminalTaskStatus } from "./task-lifecycle";

export interface TaskRuntimeEventBase {
  readonly taskId: EntityId<"taskId">;
  readonly workId: EntityId<"workId">;
  readonly timestamp: string;
  readonly taskSnapshot?: CreatedTaskRecord;
}

export interface TaskAcceptedEvent extends TaskRuntimeEventBase {
  readonly kind: "task-accepted";
}

export interface TaskStartedEvent extends TaskRuntimeEventBase {
  readonly kind: "task-started";
}

export interface RoutingResolvedEvent extends TaskRuntimeEventBase {
  readonly kind: "routing-resolved";
  readonly routingMode: string;
  readonly targetId?: string;
}

export interface StepStartedEvent extends TaskRuntimeEventBase {
  readonly kind: "step-started";
  readonly stepName: string;
  readonly stepIndex: number;
}

export interface StepCompletedEvent extends TaskRuntimeEventBase {
  readonly kind: "step-completed";
  readonly stepName: string;
  readonly stepIndex: number;
}

export interface PartialOutputEvent extends TaskRuntimeEventBase {
  readonly kind: "partial-output";
  readonly chunkText: string;
}

export interface TaskCompletedEvent extends TaskRuntimeEventBase {
  readonly kind: "task-completed";
  readonly finalResult: import("./task-completion").TaskFinalizedResult;
}

export interface TaskFailedEvent extends TaskRuntimeEventBase {
  readonly kind: "task-failed";
  readonly error: TaskError;
}

export interface TaskCanceledEvent extends TaskRuntimeEventBase {
  readonly kind: "task-canceled";
}

export type TaskRuntimeEvent =
  | TaskAcceptedEvent
  | TaskStartedEvent
  | RoutingResolvedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | PartialOutputEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskCanceledEvent;

export type ProviderConfig =
  | { readonly type: "mock" }
  | { readonly type: "http"; readonly baseUrl: string; readonly timeoutMs?: number };

export const TASK_RUNTIME_EVENT_STATUS_MAPPING: Record<TaskRuntimeEvent["kind"], import("@vcp/shared").TaskStatus | null> = {
  "task-accepted": "queued",
  "task-started": "running",
  "task-completed": "succeeded",
  "task-failed": "failed",
  "task-canceled": "cancelled",
  "routing-resolved": null,
  "step-started": null,
  "step-completed": null,
  "partial-output": null
};

export interface TaskEventSubscription {
  readonly subscriptionId: string;
  readonly taskId: string;
}

export interface TaskOrchestrationClient {
  createTask(input: import("@vcp/shared").CreateTaskRequest): Promise<CreatedTaskRecord>;
  getTask(taskId: string): Promise<CreatedTaskRecord | null>;
  cancelTask(taskId: string): Promise<void>;
  subscribeToTaskEvents(
    taskId: string,
    handler: (event: TaskRuntimeEvent) => void
  ): TaskEventSubscription;
  unsubscribeFromTaskEvents(subscription: TaskEventSubscription): void;
}

export class MockTaskOrchestrationProvider implements TaskOrchestrationClient {
  private tasks = new Map<string, CreatedTaskRecord>();
  private subscriptions = new Map<string, Set<(event: TaskRuntimeEvent) => void>>();
  private subscriptionHandles = new Map<string, { taskId: string; handler: (event: TaskRuntimeEvent) => void }>();
  private terminalTasks = new Set<string>();
  private subIdCounter = 1;
  private registry: TaskRuntimeRegistry;
  private taskCreationClient: TaskCreationClient;
  private clock: { now(): string };

  constructor(options?: {
    taskCreationClient?: TaskCreationClient;
    processingRuntime?: TaskProcessingRuntime;
    processingDelays?: Readonly<{ pendingMs: number; stepMs: number }>;
    streamingRuntime?: TaskStreamingRuntime;
    streamingDelays?: TaskStreamingDelays;
    completionRuntime?: TaskCompletionRuntime;
    completionDelays?: TaskCompletionDelays;
    cancellationCoordinator?: TaskCancellationCoordinator;
  }) {
    this.taskCreationClient = options?.taskCreationClient ?? createMockTaskCreationClient();
    const processingRuntime = options?.processingRuntime ?? createBrowserTaskProcessingRuntime();
    this.clock = processingRuntime.clock;
    const processingDelays = options?.processingDelays ?? DEMO_TIMINGS;
    const streamingRuntime = options?.streamingRuntime ?? createDefaultTaskStreamingRuntime();
    const streamingDelays = options?.streamingDelays ?? {
      fragmentMs: DEMO_TIMINGS.streamChunkMs ?? DEFAULT_TASK_STREAMING_DELAYS.fragmentMs
    };
    const completionRuntime = options?.completionRuntime ?? createBrowserTaskCompletionRuntime();
    const completionDelays = options?.completionDelays ?? DEFAULT_TASK_COMPLETION_DELAYS;

    this.registry = createTaskRuntimeRegistry({
      processingRuntime,
      processingDelays,
      streamingRuntime,
      streamingDelays,
      completionRuntime,
      completionDelays,
      stateReader: {
        findTask: (taskId) => this.tasks.get(taskId as string)
      },
      actionSink: {
        dispatch: (action) => this.handleAction(action)
      },
      cancellationCoordinator: options?.cancellationCoordinator
    });
  }

  async createTask(input: import("@vcp/shared").CreateTaskRequest): Promise<CreatedTaskRecord> {
    const response = await this.taskCreationClient.createTask(input);
    const task = createTaskRecord(input, response);
    this.tasks.set(task.taskId as string, task);
    this.registry.syncTasks(Array.from(this.tasks.values()));

    const event: TaskRuntimeEvent = {
      taskId: task.taskId,
      workId: task.workId,
      timestamp: this.clock.now(),
      kind: "task-accepted",
      taskSnapshot: task
    };
    setTimeout(() => this.emitEvent(event), 0);

    return task;
  }

  async getTask(taskId: string): Promise<CreatedTaskRecord | null> {
    return this.tasks.get(taskId) ?? null;
  }

  cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return Promise.resolve();
    }
    if (isTerminalTaskStatus(task.status)) {
      return Promise.resolve();
    }
    this.registry.cancelTask(task.taskId);
    return Promise.resolve();
  }

  subscribeToTaskEvents(taskId: string, handler: (event: TaskRuntimeEvent) => void): TaskEventSubscription {
    let handlers = this.subscriptions.get(taskId);
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(taskId, handlers);
    }
    handlers.add(handler);

    const subscriptionId = `sub-${this.subIdCounter++}`;
    this.subscriptionHandles.set(subscriptionId, { taskId, handler });
    return { subscriptionId, taskId };
  }

  unsubscribeFromTaskEvents(subscription: TaskEventSubscription): void {
    const record = this.subscriptionHandles.get(subscription.subscriptionId);
    if (!record) {
      return;
    }
    const handlers = this.subscriptions.get(record.taskId);
    if (handlers) {
      handlers.delete(record.handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(record.taskId);
      }
    }
    this.subscriptionHandles.delete(subscription.subscriptionId);
  }

  reset(): void {
    for (const subId of Array.from(this.subscriptionHandles.keys())) {
      const record = this.subscriptionHandles.get(subId);
      if (record) {
        this.unsubscribeFromTaskEvents({ subscriptionId: subId, taskId: record.taskId });
      }
    }
    this.tasks.clear();
    this.terminalTasks.clear();
    this.registry.stopAll();
  }

  private handleAction(action: import("./task-creation-state").TaskCreationAction): void {
    if (!("taskId" in action) || !action.taskId) {
      return;
    }
    const taskIdStr = action.taskId as string;
    const existingTask = this.tasks.get(taskIdStr);
    if (!existingTask) {
      return;
    }

    const state: import("./task-creation-state").TaskCreationState = {
      tasks: [existingTask],
      conversations: [],
      isSubmitting: false,
      conversationSequence: 1
    };
    const nextState = taskCreationReducer(state, action);
    const updatedTask = nextState.tasks[0];
    if (!updatedTask) {
      return;
    }
    this.tasks.set(taskIdStr, updatedTask);
    this.registry.syncTasks(Array.from(this.tasks.values()));

    const timestamp = this.clock.now();
    const base = {
      taskId: updatedTask.taskId,
      workId: updatedTask.workId,
      timestamp,
      taskSnapshot: updatedTask
    };

    let event: TaskRuntimeEvent | null = null;

    if (action.type === "processing-started") {
      event = { ...base, kind: "task-started" };
    } else if (action.type === "processing-step-activated") {
      const stepIndex = updatedTask.processingSnapshot.steps.findIndex((s) => s.id === action.stepId);
      const stepName = updatedTask.processingSnapshot.steps.find((s) => s.id === action.stepId)?.label ?? action.stepId;
      event = { ...base, kind: "step-started", stepName, stepIndex: Math.max(0, stepIndex) };

      if (action.stepId === "select-routing") {
        const routingMode = updatedTask.requestedRouting.mode;
        const targetId = updatedTask.requestedRouting.mode === "specific-agent" ? updatedTask.requestedRouting.agentId : updatedTask.requestedRouting.mode === "predefined-workflow" ? updatedTask.requestedRouting.workflowId : undefined;
        this.emitEvent({ ...base, kind: "routing-resolved", routingMode, targetId });
      }
    } else if (action.type === "processing-step-completed") {
      const stepIndex = updatedTask.processingSnapshot.steps.findIndex((s) => s.id === action.stepId);
      const stepName = updatedTask.processingSnapshot.steps.find((s) => s.id === action.stepId)?.label ?? action.stepId;
      event = { ...base, kind: "step-completed", stepName, stepIndex: Math.max(0, stepIndex) };
    } else if (action.type === "streaming-fragment-appended") {
      event = { ...base, kind: "partial-output", chunkText: action.text };
    } else if (action.type === "task-completed") {
      event = { ...base, kind: "task-completed", finalResult: action.result };
    } else if (action.type === "task-cancelled") {
      event = { ...base, kind: "task-canceled" };
    } else if (action.type === "task-failed") {
      event = { ...base, kind: "task-failed", error: action.error };
    }

    if (event) {
      this.emitEvent(event);
    } else {
      const activeStep = updatedTask.processingSnapshot.steps.find((s) => s.status === "active") ?? updatedTask.processingSnapshot.steps[0];
      const stepIndex = updatedTask.processingSnapshot.steps.findIndex((s) => s.id === activeStep.id);
      event = { ...base, kind: "step-started", stepName: activeStep.label ?? activeStep.id, stepIndex: Math.max(0, stepIndex) };
      this.emitEvent(event);
    }
  }

  private emitEvent(event: TaskRuntimeEvent): void {
    const taskIdStr = event.taskId as string;
    if (this.terminalTasks.has(taskIdStr)) {
      return;
    }
    if (event.kind === "task-completed" || event.kind === "task-failed" || event.kind === "task-canceled") {
      this.terminalTasks.add(taskIdStr);
    }
    const handlers = this.subscriptions.get(taskIdStr);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }
}

export class HttpTaskOrchestrationProvider implements TaskOrchestrationClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: { readonly type: "http"; readonly baseUrl: string; readonly timeoutMs?: number }) {
    if (!config.baseUrl) {
      throw new Error("HttpTaskOrchestrationProvider requires a non-empty baseUrl.");
    }
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  async createTask(input: import("@vcp/shared").CreateTaskRequest): Promise<CreatedTaskRecord> {
    throw new Error("HttpTaskOrchestrationProvider#createTask not implemented in this change.");
  }

  async getTask(taskId: string): Promise<CreatedTaskRecord | null> {
    throw new Error("HttpTaskOrchestrationProvider#getTask not implemented in this change.");
  }

  async cancelTask(taskId: string): Promise<void> {
    throw new Error("HttpTaskOrchestrationProvider#cancelTask not implemented in this change.");
  }

  /**
   * Subscribes to runtime events for a task.
   * Expected wire-format binding point:
   * Connects to Server-Sent Events (SSE) stream at URL pattern: `${baseUrl}/api/workspaces/tasks/${taskId}/events`
   */
  subscribeToTaskEvents(taskId: string, handler: (event: TaskRuntimeEvent) => void): TaskEventSubscription {
    throw new Error("HttpTaskOrchestrationProvider#subscribeToTaskEvents not implemented in this change.");
  }

  unsubscribeFromTaskEvents(subscription: TaskEventSubscription): void {
    throw new Error("HttpTaskOrchestrationProvider#unsubscribeFromTaskEvents not implemented in this change.");
  }
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = { type: "mock" };

export function resolveTaskOrchestrationProvider(
  config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
  options?: {
    taskCreationClient?: TaskCreationClient;
    processingRuntime?: TaskProcessingRuntime;
    processingDelays?: Readonly<{ pendingMs: number; stepMs: number }>;
    streamingRuntime?: TaskStreamingRuntime;
    streamingDelays?: TaskStreamingDelays;
    completionRuntime?: TaskCompletionRuntime;
    completionDelays?: TaskCompletionDelays;
    cancellationCoordinator?: TaskCancellationCoordinator;
  }
): TaskOrchestrationClient {
  if (config.type === "http") {
    return new HttpTaskOrchestrationProvider(config);
  }
  return new MockTaskOrchestrationProvider(options);
}
