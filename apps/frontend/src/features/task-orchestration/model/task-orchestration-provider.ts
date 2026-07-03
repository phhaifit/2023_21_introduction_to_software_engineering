import type { EntityId } from "@vcp/shared";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { CreatedTaskRecord, TaskError } from "./task-types";
import { createTaskRuntimeRegistry, type TaskRuntimeRegistry } from "./task-runtime-registry";
import { createLocalTaskCreationClient, type TaskCreationClient } from "./task-creation-client";
import { taskCreationReducer, createTaskRecord } from "./task-creation-state";
import { createBrowserTaskProcessingRuntime, type TaskProcessingRuntime } from "./task-processing-runtime";
import { createDefaultTaskStreamingRuntime, DEFAULT_TASK_STREAMING_DELAYS, type TaskStreamingDelays, type TaskStreamingRuntime } from "./task-streaming-runtime";
import { createBrowserTaskCompletionRuntime, DEFAULT_TASK_COMPLETION_DELAYS, type TaskCompletionDelays, type TaskCompletionRuntime } from "./task-completion-runtime";
import type { TaskCancellationCoordinator } from "./task-cancellation-coordinator";
import { DEFAULT_TASK_RUNTIME_TIMINGS } from "../data/task-routing-options";
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
  | { readonly type: "http"; readonly baseUrl: string; readonly timeoutMs?: number };

type RemoteTaskIdentity = Pick<import("@vcp/shared").CreateTaskResponse, "taskId" | "workId">;

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
  createTask(
    input: import("@vcp/shared").CreateTaskRequest,
    options?: { conversationId?: string }
  ): Promise<CreatedTaskRecord>;
  getTask(taskId: string): Promise<CreatedTaskRecord | null>;
  cancelTask(taskId: string): Promise<void>;
  deleteConversation(workspaceId: string, conversationId: string): Promise<void>;
  deleteTask(taskId: string, options?: { conversationId?: string; workspaceId?: string }): Promise<void>;
  subscribeToTaskEvents(
    taskId: string,
    handler: (event: TaskRuntimeEvent) => void
  ): TaskEventSubscription;
  unsubscribeFromTaskEvents(subscription: TaskEventSubscription): void;
  fetchConversations(workspaceId: string): Promise<import("@vcp/shared").Conversation[]>;
}

export class LocalTaskOrchestrationTestProvider implements TaskOrchestrationClient {
  private tasks = new Map<string, CreatedTaskRecord>();
  private subscriptions = new Map<string, Set<(event: TaskRuntimeEvent) => void>>();
  private subscriptionHandles = new Map<string, { taskId: string; handler: (event: TaskRuntimeEvent) => void }>();
  private terminalTasks = new Set<string>();
  private taskConversationIds = new Map<string, string>();
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
    this.taskCreationClient = options?.taskCreationClient ?? createLocalTaskCreationClient();
    const processingRuntime = options?.processingRuntime ?? createBrowserTaskProcessingRuntime();
    this.clock = processingRuntime.clock;
    const processingDelays = options?.processingDelays ?? DEFAULT_TASK_RUNTIME_TIMINGS;
    const streamingRuntime = options?.streamingRuntime ?? createDefaultTaskStreamingRuntime();
    const streamingDelays = options?.streamingDelays ?? {
      fragmentMs: DEFAULT_TASK_RUNTIME_TIMINGS.streamChunkMs ?? DEFAULT_TASK_STREAMING_DELAYS.fragmentMs
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

  async createTask(
    input: import("@vcp/shared").CreateTaskRequest,
    options?: { conversationId?: string }
  ): Promise<CreatedTaskRecord> {
    const response = await this.taskCreationClient.createTask(input);
    const task = createTaskRecord(input, response);
    this.tasks.set(task.taskId as string, task);
    if (options?.conversationId) {
      this.taskConversationIds.set(task.taskId as string, options.conversationId);
    }
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

  async fetchConversations(workspaceId: string): Promise<import("@vcp/shared").Conversation[]> {
    return [];
  }

  async deleteConversation(_workspaceId: string, conversationId: string): Promise<void> {
    const idsToRemove = Array.from(this.taskConversationIds.entries())
      .filter(([, id]) => id === conversationId)
      .map(([taskId]) => taskId);
    for (const taskId of idsToRemove) {
      this.tasks.delete(taskId);
      this.taskConversationIds.delete(taskId);
    }
    this.registry.syncTasks(Array.from(this.tasks.values()));
  }

  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
    this.taskConversationIds.delete(taskId);
    this.registry.syncTasks(Array.from(this.tasks.values()));
  }

  cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || isTerminalTaskStatus(task.status)) {
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

    const subscriptionId = `sub-local-${this.subIdCounter++}`;
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
    this.taskConversationIds.clear();
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
        const targetId = updatedTask.requestedRouting.mode === "specific-agent"
          ? updatedTask.requestedRouting.agentId
          : updatedTask.requestedRouting.mode === "predefined-workflow"
          ? updatedTask.requestedRouting.workflowId
          : undefined;
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
      return;
    }

    const activeStep = updatedTask.processingSnapshot.steps.find((s) => s.status === "active") ?? updatedTask.processingSnapshot.steps[0];
    const stepIndex = updatedTask.processingSnapshot.steps.findIndex((s) => s.id === activeStep.id);
    this.emitEvent({ ...base, kind: "step-started", stepName: activeStep.label ?? activeStep.id, stepIndex: Math.max(0, stepIndex) });
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
  private tasks = new Map<string, CreatedTaskRecord>();
  private eventSources = new Map<string, EventSource>();
  private subscriptionHandlers = new Map<string, { taskId: string; handler: (event: TaskRuntimeEvent) => void }>();
  private subIdCounter = 1;

  constructor(config: { readonly type: "http"; readonly baseUrl: string; readonly timeoutMs?: number }) {
    if (!config.baseUrl) {
      throw new Error("HttpTaskOrchestrationProvider requires a non-empty baseUrl.");
    }
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  async createTask(
    input: import("@vcp/shared").CreateTaskRequest,
    options?: { conversationId?: string }
  ): Promise<CreatedTaskRecord> {
    const response = await this.createRemoteTask(input);
    const task = createTaskRecord(input, response);
    this.tasks.set(task.taskId as string, task);
    void this.startRemoteExecution(input, response, options?.conversationId);
    return task;
  }

  private async createRemoteTask(
    input: import("@vcp/shared").CreateTaskRequest
  ): Promise<import("@vcp/shared").CreateTaskResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => undefined);
      if (!response.ok || payload?.ok === false || !payload?.data?.taskId || !payload?.data?.workId) {
        throw new Error(
          payload?.error?.message ||
            `Task creation failed with status ${response.status}`
        );
      }
      return payload.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async startRemoteExecution(
    input: import("@vcp/shared").CreateTaskRequest,
    identity: RemoteTaskIdentity,
    conversationId?: string
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    let payload: any;
    try {
      const response = await fetch(`${this.baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/executions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: identity.taskId,
          workId: identity.workId,
          workspaceId: DEMO_WORKSPACE_ID as any,
          conversationId: conversationId || (identity.workId as string),
          prompt: input.prompt,
          routing: input.routing
        }),
        signal: controller.signal
      });
      payload = await response.json().catch(() => undefined);
      if (!response.ok || payload?.ok === false || payload?.data?.status === "failed") {
        throw new Error(
          payload?.error?.message ||
            payload?.data?.error?.message ||
            `OpenClaw execution start failed with status ${response.status}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenClaw execution start failed.";
      this.failTaskStart(identity.taskId as string, message);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private failTaskStart(taskId: string, message: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    const timestamp = new Date().toISOString();
    const state = {
      tasks: [task],
      conversations: [],
      isSubmitting: false,
      conversationSequence: 1
    };
    const nextState = taskCreationReducer(state, {
      type: "task-failed",
      taskId: task.taskId,
      error: {
        code: "execution-start-rejected",
        stepId: "execution-start",
        title: "Execution start failed",
        message,
        occurredAt: timestamp
      }
    });
    const updatedTask = nextState.tasks[0];
    if (!updatedTask) {
      return;
    }
    this.tasks.set(taskId, updatedTask);
    this.emitLocalEvent({
      taskId: updatedTask.taskId,
      workId: updatedTask.workId,
      timestamp,
      kind: "task-failed",
      error: updatedTask.error!,
      taskSnapshot: updatedTask
    });
  }

  async getTask(taskId: string): Promise<CreatedTaskRecord | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/executions/${taskId}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.data && data.data.status) {
          // Keep status in sync if needed
        }
      }
    } catch (err) {
      // ignore
    }
    return task;
  }

  private async replayExecutionState(
    taskId: string,
    handler: (event: TaskRuntimeEvent) => void
  ): Promise<void> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/executions/${taskId}/state`
      );
      if (!res.ok) {
        return;
      }
      const payload = await res.json().catch(() => undefined);
      const state = payload?.data;
      if (!state || state.taskId !== taskId) {
        return;
      }

      if (Array.isArray(state.events)) {
        for (const runtimeEvent of state.events) {
          const projected = this.applyRuntimeEventData(taskId, runtimeEvent);
          if (projected) {
            handler(projected);
          }
        }
      }

      const currentTask = this.tasks.get(taskId);
      if (!currentTask || currentTask.status !== "queued") {
        return;
      }
      const timestamp = new Date().toISOString();
      if (state.status === "in-progress") {
        const snapshot = this.applyTaskAction(taskId, {
          type: "provider-processing-started",
          taskId: currentTask.taskId,
          startedAt: timestamp
        });
        if (snapshot) {
          handler({
            taskId: snapshot.taskId,
            workId: snapshot.workId,
            timestamp,
            kind: "task-started",
            taskSnapshot: snapshot
          });
        }
      } else if (state.status === "completed") {
        const snapshot = this.applyTaskAction(taskId, {
          type: "task-completed",
          taskId: currentTask.taskId,
          result: {
            text: "Completed successfully.",
            finalizedAt: timestamp,
            artifacts: [],
            followUpPromptSuggestions: []
          }
        });
        if (snapshot) {
          handler({
            taskId: snapshot.taskId,
            workId: snapshot.workId,
            timestamp,
            kind: "task-completed",
            finalResult: snapshot.finalizedResult!,
            taskSnapshot: snapshot
          });
        }
      }
    } catch (err) {
      console.warn("Failed to replay execution state", err);
    }
  }

  private applyTaskAction(
    taskId: string,
    action: import("./task-creation-state").TaskCreationAction
  ): CreatedTaskRecord | undefined {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }
    const state: import("./task-creation-state").TaskCreationState = {
      tasks: [task],
      conversations: [],
      isSubmitting: false,
      conversationSequence: 1
    };
    const nextState = taskCreationReducer(state, action);
    const updatedTask = nextState.tasks[0];
    if (updatedTask) {
      this.tasks.set(taskId, updatedTask);
    }
    return updatedTask;
  }

  private applyRuntimeEventData(
    taskId: string,
    data: any
  ): TaskRuntimeEvent | null {
    const subscribedTask = this.tasks.get(taskId);
    if (!subscribedTask) return null;

    if (typeof data.taskId === "string" && data.taskId !== taskId) {
      return null;
    }

    if (
      typeof data.workId === "string" &&
      data.workId !== (subscribedTask.workId as string) &&
      !isSyntheticRestoredWorkId(subscribedTask)
    ) {
      return null;
    }

    if (typeof data.timestamp === "string") {
      const eventTime = Date.parse(data.timestamp);
      const taskCreatedTime = Date.parse(subscribedTask.createdAt);
      if (!Number.isNaN(eventTime) && !Number.isNaN(taskCreatedTime) && eventTime < taskCreatedTime) {
        return null;
      }
    }

    const timestamp = data.timestamp || new Date().toISOString();
    const base = {
      taskId: subscribedTask.taskId,
      workId: subscribedTask.workId,
      timestamp
    };

    const ensureProviderProcessingStarted = () => {
      const currentTask = this.tasks.get(taskId);
      if (currentTask?.status === "queued" && currentTask.processingSnapshot.startedAt === undefined) {
        this.applyTaskAction(taskId, {
          type: "provider-processing-started",
          taskId: currentTask.taskId,
          startedAt: timestamp
        });
      }
    };

    let snapshot: CreatedTaskRecord | undefined;
    const currentTask = this.tasks.get(taskId);
    if (currentTask?.status === "queued" && data.type !== "execution-accepted") {
      ensureProviderProcessingStarted();
    }

    if (data.type === "execution-accepted") {
      snapshot = this.applyTaskAction(taskId, {
        type: "provider-processing-started",
        taskId: subscribedTask.taskId,
        startedAt: timestamp
      });
      return { ...base, kind: "task-accepted", taskSnapshot: snapshot };
    }

    if (data.type === "execution-started") {
      ensureProviderProcessingStarted();
      return { ...base, kind: "task-started", taskSnapshot: this.tasks.get(taskId) };
    }

    if (data.type === "step-started") {
      const stepId = data.stepId || "step-1";
      const stepName = data.stepName || stepId;
      ensureProviderProcessingStarted();
      snapshot = this.applyTaskAction(taskId, {
        type: "provider-step-started",
        taskId: subscribedTask.taskId,
        stepId,
        stepName,
        startedAt: timestamp
      });
      const stepIndex = Math.max(0, snapshot?.processingSnapshot.steps.findIndex((s) => s.id === stepId) ?? 0);
      return { ...base, kind: "step-started", stepName, stepIndex, taskSnapshot: snapshot };
    }

    if (data.type === "step-completed") {
      const stepId = data.stepId || "step-1";
      const stepName = data.stepName || stepId;
      ensureProviderProcessingStarted();
      snapshot = this.applyTaskAction(taskId, {
        type: "provider-step-completed",
        taskId: subscribedTask.taskId,
        stepId,
        stepName,
        completedAt: timestamp
      });
      const stepIndex = Math.max(0, snapshot?.processingSnapshot.steps.findIndex((s) => s.id === stepId) ?? 0);
      return { ...base, kind: "step-completed", stepName, stepIndex, taskSnapshot: snapshot };
    }

    if (
      data.type === "sub-activity" ||
      data.type === "tool-call" ||
      data.type === "tool-call-started" ||
      data.type === "tool-started" ||
      data.type === "web-search" ||
      data.type === "web-search-started" ||
      data.type === "reading" ||
      data.type === "document-reading" ||
      data.type === "file-reading" ||
      data.activityType
    ) {
      const activity = resolveRuntimeActivityProjection(data);
      ensureProviderProcessingStarted();
      snapshot = this.applyTaskAction(taskId, {
        type: "provider-step-started",
        taskId: subscribedTask.taskId,
        stepId: activity.stepId,
        stepName: activity.stepName,
        startedAt: timestamp
      });
      snapshot = this.applyTaskAction(taskId, {
        type: "processing-log-appended",
        taskId: subscribedTask.taskId,
        log: {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          stepId: activity.stepId,
          level: data.status === "failed" ? "error" : "info",
          message: activity.details,
          timestamp
        }
      });
      if (data.status === "completed") {
        snapshot = this.applyTaskAction(taskId, {
          type: "provider-step-completed",
          taskId: subscribedTask.taskId,
          stepId: activity.stepId,
          stepName: activity.stepName,
          completedAt: timestamp
        });
      }
      const latestSnapshot = this.tasks.get(taskId) ?? snapshot;
      const stepIndex = Math.max(0, latestSnapshot?.processingSnapshot.steps.findIndex((s) => s.id === activity.stepId) ?? 0);
      return { ...base, kind: "step-started", stepName: activity.stepName, stepIndex, taskSnapshot: latestSnapshot };
    }

    if (data.type === "partial-output-received") {
      const chunkText = data.outputChunk || "";
      ensureProviderProcessingStarted();
      const taskBeforeStreaming = this.tasks.get(taskId);
      if (taskBeforeStreaming?.streamingSnapshot?.phase === "idle") {
        this.applyTaskAction(taskId, {
          type: "streaming-started",
          taskId: subscribedTask.taskId,
          startedAt: timestamp
        });
      }
      snapshot = this.applyTaskAction(taskId, {
        type: "streaming-fragment-appended",
        taskId: subscribedTask.taskId,
        fragmentId: `frag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sequence: (this.tasks.get(taskId)?.streamingSnapshot?.fragments.length || 0) + 1,
        text: chunkText,
        appendedAt: timestamp
      });
      return { ...base, kind: "partial-output", chunkText, taskSnapshot: snapshot };
    }

    if (data.type === "execution-completed") {
      const finalOutput = data.finalOutput || "Completed successfully.";
      ensureProviderProcessingStarted();
      const latestTask = this.tasks.get(taskId);
      const activeStep = latestTask?.processingSnapshot.steps.find((s) => s.status === "active");
      if (activeStep) {
        this.applyTaskAction(taskId, {
          type: "provider-step-completed",
          taskId: subscribedTask.taskId,
          stepId: activeStep.id,
          stepName: activeStep.label,
          completedAt: timestamp
        });
      } else if (latestTask?.processingSnapshot.steps.length === 0) {
        this.applyTaskAction(taskId, {
          type: "provider-step-started",
          taskId: subscribedTask.taskId,
          stepId: "openclaw-execution",
          stepName: "OpenClaw execution",
          startedAt: timestamp
        });
        this.applyTaskAction(taskId, {
          type: "provider-step-completed",
          taskId: subscribedTask.taskId,
          stepId: "openclaw-execution",
          stepName: "OpenClaw execution",
          completedAt: timestamp
        });
      }
      const taskBeforeComplete = this.tasks.get(taskId);
      if (taskBeforeComplete?.streamingSnapshot?.phase === "idle") {
        this.applyTaskAction(taskId, { type: "streaming-started", taskId: subscribedTask.taskId, startedAt: timestamp });
        this.applyTaskAction(taskId, { type: "streaming-exhausted", taskId: subscribedTask.taskId, exhaustedAt: timestamp });
      } else if (taskBeforeComplete?.streamingSnapshot?.phase === "streaming") {
        this.applyTaskAction(taskId, { type: "streaming-exhausted", taskId: subscribedTask.taskId, exhaustedAt: timestamp });
      }
      snapshot = this.applyTaskAction(taskId, {
        type: "task-completed",
        taskId: subscribedTask.taskId,
        result: { text: finalOutput, finalizedAt: timestamp, artifacts: [], followUpPromptSuggestions: [] } as any
      });
      return {
        ...base,
        kind: "task-completed",
        finalResult: { text: finalOutput, artifacts: [], followUpPromptSuggestions: [] } as any,
        taskSnapshot: snapshot
      };
    }

    if (data.type === "execution-failed") {
      ensureProviderProcessingStarted();
      const activeStep = this.tasks.get(taskId)?.processingSnapshot.steps.find((s) => s.status === "active");
      const message = data.errorMessage || data.error?.message || "Execution failed";
      snapshot = this.applyTaskAction(taskId, {
        type: "task-failed",
        taskId: subscribedTask.taskId,
        error: {
          code: "runtime-error",
          stepId: activeStep?.id || "unknown",
          title: "Execution failed",
          message,
          occurredAt: timestamp
        }
      });
      return { ...base, kind: "task-failed", error: { code: "runtime-error", message } as any, taskSnapshot: snapshot };
    }

    if (data.type === "execution-canceled") {
      snapshot = this.applyTaskAction(taskId, {
        type: "task-cancelled",
        taskId: subscribedTask.taskId,
        cancelledAt: timestamp
      });
      return { ...base, kind: "task-canceled", taskSnapshot: snapshot };
    }

    return null;
  }

  async fetchConversations(workspaceId: string): Promise<import("@vcp/shared").Conversation[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/conversations`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.data) {
          return data.data;
        }
      }
    } catch (err) {
      console.warn("Failed to reach backend fetch conversations API", err);
    }
    return [];
  }

  async cancelTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/executions/${taskId}/cancel`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok || payload?.ok === false) {
      throw new Error(
        payload?.error?.message || `OpenClaw execution cancel failed with status ${response.status}`
      );
    }
  }

  async deleteConversation(workspaceId: string, conversationId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/conversations/${conversationId}`, {
      method: "DELETE"
    });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok || payload?.ok === false) {
      throw new Error(
        payload?.error?.message || `Conversation delete failed with status ${response.status}`
      );
    }
  }

  async deleteTask(taskId: string, options?: { conversationId?: string; workspaceId?: string }): Promise<void> {
    const conversationId = options?.conversationId;
    if (!conversationId) {
      this.tasks.delete(taskId);
      return;
    }
    const workspaceId = options?.workspaceId || DEMO_WORKSPACE_ID;
    const response = await fetch(
      `${this.baseUrl}/api/workspaces/${workspaceId}/conversations/${conversationId}/turns/${taskId}`,
      { method: "DELETE" }
    );
    const payload = await response.json().catch(() => undefined);
    if (!response.ok || payload?.ok === false) {
      throw new Error(
        payload?.error?.message || `Conversation turn delete failed with status ${response.status}`
      );
    }
    this.tasks.delete(taskId);
  }

  /**
   * Subscribes to runtime events for a task.
   * Connects to Server-Sent Events (SSE) stream at URL pattern: `${baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/executions/${taskId}/stream`
   */
  subscribeToTaskEvents(taskId: string, handler: (event: TaskRuntimeEvent) => void): TaskEventSubscription {
    const subscriptionId = `sub-http-${this.subIdCounter++}`;
    this.subscriptionHandlers.set(subscriptionId, { taskId, handler });
    void this.replayExecutionState(taskId, handler);
    try {
      const es = new EventSource(`${this.baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/executions/${taskId}/stream`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const projected = this.applyRuntimeEventData(taskId, data);
          if (projected) {
            handler(projected);
          }
        } catch (err) {
          console.error("Failed to parse SSE event", err);
        }
      };
      this.eventSources.set(subscriptionId, es);
    } catch (err) {
      console.warn("EventSource not available or failed to connect", err);
    }
    return { subscriptionId, taskId };
  }

  unsubscribeFromTaskEvents(subscription: TaskEventSubscription): void {
    this.subscriptionHandlers.delete(subscription.subscriptionId);
    const es = this.eventSources.get(subscription.subscriptionId);
    if (es) {
      es.close();
      this.eventSources.delete(subscription.subscriptionId);
    }
  }

  private emitLocalEvent(event: TaskRuntimeEvent): void {
    for (const { taskId, handler } of this.subscriptionHandlers.values()) {
      if (taskId === (event.taskId as string)) {
        handler(event);
      }
    }
  }
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig =
  { type: "http", baseUrl: "http://127.0.0.1:3001" };

export function resolveTaskOrchestrationProvider(
  config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
  _options?: {
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
  return new HttpTaskOrchestrationProvider(config);
}

function resolveRuntimeActivityProjection(data: any): {
  stepId: string;
  stepName: string;
  details: string;
} {
  const activityType = String(data.activityType || inferLegacyActivityType(data));
  const stepName =
    toDisplayText(data.displayLabel) ||
    toDisplayText(data.stepName) ||
    labelForActivityType(activityType, data);
  const details =
    toDisplayText(data.summary) ||
    toDisplayText(data.details) ||
    toDisplayText(data.toolName) ||
    toDisplayText(data.queryPreview) ||
    toDisplayText(data.query) ||
    toDisplayText(data.resourceLabel) ||
    toDisplayText(data.resource) ||
    stepName;
  const stepId =
    toStepId(data.stepId) ||
    `openclaw-${activityType}-${toStepId(data.toolName || data.queryPreview || data.resourceLabel || data.providerEventName || "activity")}`;

  return { stepId, stepName, details };
}

function inferLegacyActivityType(data: any): string {
  const type = String(data.type || "").toLowerCase();
  if (/\b(reasoning|thinking|thought|planning|deliberat|reflect)\b/.test(type)) return "provider-diagnostic";
  if (type.includes("search")) return "web-search";
  if (type.includes("tool")) return "tool-call";
  if (type.includes("reading") || type.includes("read")) return "document-read";
  return "provider";
}

function labelForActivityType(activityType: string, data: any): string {
  switch (activityType) {
    case "web-search":
      return "Searching web";
    case "tool":
    case "tool-call":
      return toDisplayText(data.toolName) ? `Calling ${toDisplayText(data.toolName)}` : "Calling tool";
    case "document-read":
      return toDisplayText(data.resourceLabel) ? `Reading ${toDisplayText(data.resourceLabel)}` : "Reading document";
    case "file-read":
      return toDisplayText(data.resourceLabel) ? `Reading ${toDisplayText(data.resourceLabel)}` : "Reading file";
    case "browser":
      return "Browsing web";
    case "shell":
      return "Running command";
    case "api-call":
      return "Calling API";
    case "routing":
      return "Routing request";
    case "workflow":
      return "Running workflow";
    case "message":
      return "Composing response";
    case "sub-agent":
      return "Agent activity";
    case "provider-diagnostic":
      return /\b(reasoning|thinking|thought|planning|deliberat|reflect)\b/.test(
        String(data.providerEventName || data.summary || data.details || "").toLowerCase()
      )
        ? "Thinking"
        : "Provider diagnostic";
    default:
      return "OpenClaw activity";
  }
}

function toDisplayText(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const text = String(value).trim().replace(/\s+/g, " ");
  if (!text) {
    return undefined;
  }
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function toStepId(value: unknown): string | undefined {
  const text = toDisplayText(value);
  if (!text) {
    return undefined;
  }
  return text.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || undefined;
}

function isSyntheticRestoredWorkId(task: CreatedTaskRecord): boolean {
  return (task.workId as string) === `work-${task.taskId as string}`;
}
