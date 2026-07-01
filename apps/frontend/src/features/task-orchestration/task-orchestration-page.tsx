import { useEffect, useReducer, useRef, useState } from "react";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { TaskRoutingSelection } from "@vcp/shared";

import { RoutingSelector } from "./components/routing-selector";
import { TaskComposer } from "./components/task-composer";
import {
  createTaskRoutingOptions,
  DEFAULT_TASK_RUNTIME_TIMINGS,
  SUGGESTED_TASK_PROMPTS
} from "./data/task-routing-options";
import {
  createTaskRoutingCatalogClient,
  createLocalTaskRoutingCatalogClient,
  type TaskRoutingCatalogClient
} from "./model/task-routing-catalog-client";
import type { TaskCreationClient } from "./model/task-creation-client";
import {
  buildCreateTaskRequest,
  conversationHasNonTerminalTasks,
  getActiveConversation,
  getConversationTasks,
  getLatestConversationTask,
  initialTaskCreationState,
  taskCreationReducer
} from "./model/task-creation-state";
import { toTaskPresentationStatus } from "./model/task-lifecycle";
import {
  createBrowserTaskProcessingRuntime,
  type TaskProcessingRuntime
} from "./model/task-processing-runtime";
import {
  createDefaultTaskStreamingRuntime,
  DEFAULT_TASK_STREAMING_DELAYS,
  type TaskStreamingDelays,
  type TaskStreamingRuntime
} from "./model/task-streaming-runtime";
import {
  createBrowserTaskCompletionRuntime,
  DEFAULT_TASK_COMPLETION_DELAYS,
  type TaskCompletionDelays,
  type TaskCompletionRuntime
} from "./model/task-completion-runtime";
import { TaskProcessingDetailModal } from "./components/task-processing-detail-modal";
import { TaskCancelConfirmationDialog } from "./components/task-cancel-confirmation-dialog";
import { TaskConfirmDialog } from "./components/task-confirm-dialog";
import { buildTaskProcessingDetail } from "./model/task-processing-detail";
import type { TaskCancellationCoordinator } from "./model/task-cancellation-coordinator";
import {
  ROUTING_MODES,
  type RoutingMode,
  type CreatedTaskRecord
} from "./model/task-types";
import { TaskConversation } from "./components/task-conversation";
import {
  TaskConversationNavigation,
  type TaskConversationNavigationItem
} from "./components/task-conversation-navigation";
import {
  resolveTaskOrchestrationProvider,
  DEFAULT_PROVIDER_CONFIG,
  LocalTaskOrchestrationTestProvider,
  type TaskOrchestrationClient,
  type TaskEventSubscription
} from "./model/task-orchestration-provider";

import "./task-orchestration-page.css";
import "./task-orchestration-tokens.css";

type TaskCancellationRequestHandler = (
  taskId: CreatedTaskRecord["taskId"]
) => void;

type TaskOrchestrationPageProps = {
  isLoading?: boolean;
  isReconnecting?: boolean;
  isProviderUnavailable?: boolean;
  providerMode?: "http" | "neutral";
  taskCreationClient?: TaskCreationClient;
  taskOrchestrationClient?: TaskOrchestrationClient;
  routingCatalogClient?: TaskRoutingCatalogClient;
  onCancelTaskRequested?: TaskCancellationRequestHandler;
  processingRuntime?: TaskProcessingRuntime;
  processingDelays?: Readonly<{
    pendingMs: number;
    stepMs: number;
  }>;
  streamingRuntime?: TaskStreamingRuntime;
  streamingDelays?: TaskStreamingDelays;
  completionRuntime?: TaskCompletionRuntime;
  completionDelays?: TaskCompletionDelays;
  cancellationCoordinator?: TaskCancellationCoordinator;
};

const suggestedPrompts = [
  SUGGESTED_TASK_PROMPTS.weeklyProgressReport,
  SUGGESTED_TASK_PROMPTS.specificAgentProductDescription,
  SUGGESTED_TASK_PROMPTS.researchAndSynthesis
] as const;

const RUNNING_DELETE_REASON =
  "Cannot delete while a task is still running or queued in this conversation.";

function resolveProviderBadgeLabel(options: {
  isReconnecting: boolean;
  isProviderUnavailable: boolean;
  providerMode?: "http" | "neutral";
}): { label: string; tone: "live" | "reconnecting" | "unavailable" | "neutral" } {
  if (options.isReconnecting) {
    return { label: "Reconnecting", tone: "reconnecting" };
  }
  if (options.isProviderUnavailable) {
    return { label: "Provider unavailable", tone: "unavailable" };
  }
  if (options.providerMode === "http") {
    return { label: "HTTP / OpenClaw Gateway", tone: "live" };
  }
  return { label: "Execution provider", tone: "neutral" };
}

export function TaskOrchestrationPage({
  isLoading = false,
  isReconnecting = false,
  isProviderUnavailable = false,
  providerMode = "http",
  taskCreationClient,
  taskOrchestrationClient,
  routingCatalogClient,
  onCancelTaskRequested,
  processingRuntime,
  processingDelays,
  streamingRuntime,
  streamingDelays,
  completionRuntime,
  completionDelays,
  cancellationCoordinator
}: TaskOrchestrationPageProps) {
  const [prompt, setPrompt] = useState("");
  const [routingMode, setRoutingMode] = useState<RoutingMode>(ROUTING_MODES[0]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>();
  const [routingOptions, setRoutingOptions] = useState(createTaskRoutingOptions);
  const [isRoutingCatalogLoading, setIsRoutingCatalogLoading] = useState(true);
  const [routingCatalogError, setRoutingCatalogError] = useState<string | null>(null);
  const [taskState, dispatchTaskAction] = useReducer(
    taskCreationReducer,
    initialTaskCreationState
  );
  const [conversationSidebarCollapsed, setConversationSidebarCollapsed] = useState(false);
  const [detailModalTaskId, setDetailModalTaskId] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelTargetTaskId, setCancelTargetTaskId] = useState<string | null>(null);
  const [providerUnavailableDismissed, setProviderUnavailableDismissed] = useState(false);
  const [deleteConversationTargetId, setDeleteConversationTargetId] = useState<string | null>(
    null
  );
  const dispatchRef = useRef(dispatchTaskAction);
  dispatchRef.current = dispatchTaskAction;
  const taskStateRef = useRef(taskState);
  taskStateRef.current = taskState;
  const mountedRef = useRef(false);

  const runtimeRef = useRef(processingRuntime ?? createBrowserTaskProcessingRuntime());
  const delaysRef = useRef(processingDelays ?? DEFAULT_TASK_RUNTIME_TIMINGS);
  const streamingRuntimeRef = useRef(
    streamingRuntime ?? createDefaultTaskStreamingRuntime()
  );
  const streamingDelaysRef = useRef(
    streamingDelays ?? {
      fragmentMs: DEFAULT_TASK_RUNTIME_TIMINGS.streamChunkMs ?? DEFAULT_TASK_STREAMING_DELAYS.fragmentMs
    }
  );
  const completionRuntimeRef = useRef(
    completionRuntime ?? createBrowserTaskCompletionRuntime()
  );
  const completionDelaysRef = useRef(
    completionDelays ?? DEFAULT_TASK_COMPLETION_DELAYS
  );
  const hasInjectedRuntimeDependencies = Boolean(
    taskCreationClient ||
      processingRuntime ||
      processingDelays ||
      streamingRuntime ||
      streamingDelays ||
      completionRuntime ||
      completionDelays ||
      cancellationCoordinator
  );

  const clientRef = useRef(
    taskOrchestrationClient ??
      (hasInjectedRuntimeDependencies
        ? new LocalTaskOrchestrationTestProvider({
            taskCreationClient,
            processingRuntime: runtimeRef.current,
            processingDelays: delaysRef.current,
            streamingRuntime: streamingRuntimeRef.current,
            streamingDelays: streamingDelaysRef.current,
            completionRuntime: completionRuntimeRef.current,
            completionDelays: completionDelaysRef.current,
            cancellationCoordinator
          })
        : resolveTaskOrchestrationProvider(DEFAULT_PROVIDER_CONFIG, {
            taskCreationClient,
            processingRuntime: runtimeRef.current,
            processingDelays: delaysRef.current,
            streamingRuntime: streamingRuntimeRef.current,
            streamingDelays: streamingDelaysRef.current,
            completionRuntime: completionRuntimeRef.current,
            completionDelays: completionDelaysRef.current,
            cancellationCoordinator
          }))
  );
  const subscriptionsRef = useRef(new Map<string, TaskEventSubscription>());
  const routingCatalogClientRef = useRef(
    routingCatalogClient ??
      (hasInjectedRuntimeDependencies
        ? createLocalTaskRoutingCatalogClient()
        : createTaskRoutingCatalogClient())
  );

  const activeConversation = getActiveConversation(taskState);
  const activeConversationTasks = taskState.activeConversationId
    ? getConversationTasks(taskState, taskState.activeConversationId)
    : [];
  const latestActiveConversationTask = taskState.activeConversationId
    ? getLatestConversationTask(taskState, taskState.activeConversationId)
    : undefined;

  const activeTask = latestActiveConversationTask;
  const cancellableActiveTask =
    activeTask && (activeTask.status === "queued" || activeTask.status === "running")
      ? activeTask
      : undefined;
  const detailModalTask = detailModalTaskId
    ? taskState.tasks.find((task) => task.taskId === detailModalTaskId)
    : undefined;
  const providerBadge = resolveProviderBadgeLabel({
    isReconnecting,
    isProviderUnavailable,
    providerMode
  });

  const navigationItems: TaskConversationNavigationItem[] = taskState.conversations.map((conv) => {
    const latestTask = getLatestConversationTask(taskState, conv.conversationId);
    const convTasks = getConversationTasks(taskState, conv.conversationId);
    const hasRunningTasks = conversationHasNonTerminalTasks(taskState, conv.conversationId);
    return {
      conversationId: conv.conversationId,
      title: conv.title,
      latestStatus: latestTask ? toTaskPresentationStatus(latestTask.status) : undefined,
      updatedAt: conv.updatedAt,
      taskCount: convTasks.length,
      canDelete: !hasRunningTasks,
      deleteDisabledReason: hasRunningTasks ? RUNNING_DELETE_REASON : undefined,
      tasks: convTasks
    };
  });

  function clearModalTargets(): void {
    setDetailModalTaskId(null);
    setIsCancelDialogOpen(false);
    setCancelTargetTaskId(null);
    setDeleteConversationTargetId(null);
  }

  function cleanupTaskSubscriptions(taskIds: readonly string[]): void {
    const client = clientRef.current;
    for (const taskId of taskIds) {
      const sub = subscriptionsRef.current.get(taskId);
      if (sub) {
        client.unsubscribeFromTaskEvents(sub);
        subscriptionsRef.current.delete(taskId);
      }
    }
  }

  function handleSelectConversation(conversationId: string): void {
    clearModalTargets();
    dispatchTaskAction({
      type: "conversation-selected",
      conversationId
    });
  }

  function handleCreateConversation(): void {
    clearModalTargets();
    setPrompt("");
    dispatchTaskAction({
      type: "conversation-created",
      createdAt: runtimeRef.current.clock.now()
    });
  }

  function handleDeleteConversationRequest(conversationId: string): void {
    if (conversationHasNonTerminalTasks(taskState, conversationId)) {
      return;
    }
    setDeleteConversationTargetId(conversationId);
  }

  function getPendingSubmissionConversationId(): string {
    return (
      taskState.activeConversationId ??
      `CONV-${String(taskState.conversationSequence ?? 1).padStart(6, "0")}`
    );
  }

  async function handleConfirmDeleteConversation(): Promise<void> {
    if (!deleteConversationTargetId) {
      return;
    }
    const conversation = taskState.conversations.find(
      (conv) => conv.conversationId === deleteConversationTargetId
    );
    if (!conversation || conversationHasNonTerminalTasks(taskState, conversation.conversationId)) {
      setDeleteConversationTargetId(null);
      return;
    }

    try {
      await clientRef.current.deleteConversation(
        DEMO_WORKSPACE_ID,
        deleteConversationTargetId
      );
    } catch {
      dispatchTaskAction({
        type: "submission-failed",
        message: "Conversation could not be deleted. Try again after sync completes."
      });
      setDeleteConversationTargetId(null);
      return;
    }

    cleanupTaskSubscriptions(conversation.taskIds.map((id) => id as string));
    if (
      detailModalTaskId &&
      conversation.taskIds.some((id) => (id as string) === detailModalTaskId)
    ) {
      setDetailModalTaskId(null);
    }
    if (
      cancelTargetTaskId &&
      conversation.taskIds.some((id) => (id as string) === cancelTargetTaskId)
    ) {
      setIsCancelDialogOpen(false);
      setCancelTargetTaskId(null);
    }

    dispatchTaskAction({
      type: "conversation-deleted",
      conversationId: deleteConversationTargetId
    });
    setDeleteConversationTargetId(null);
  }

  useEffect(() => {
    mountedRef.current = true;
    const client = clientRef.current;
    const subs = subscriptionsRef.current;

    if (client.fetchConversations) {
      client.fetchConversations(DEMO_WORKSPACE_ID).then((conversations) => {
        if (mountedRef.current && conversations && conversations.length > 0) {
          dispatchRef.current({ type: "conversations-restored", conversations });
        }
      });
    }

    return () => {
      mountedRef.current = false;
      for (const sub of subs.values()) {
        client.unsubscribeFromTaskEvents(sub);
      }
      subs.clear();
      if ("reset" in client && typeof (client as { reset?: () => void }).reset === "function") {
        (client as { reset: () => void }).reset();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsRoutingCatalogLoading(true);
    setRoutingCatalogError(null);

    routingCatalogClientRef.current
      .listRoutingCatalog(DEMO_WORKSPACE_ID)
      .then((catalog) => {
        if (cancelled) {
          return;
        }

        setRoutingOptions(catalog);
        setSelectedAgentId((current) =>
          current && catalog.agents.some((agent) => agent.id === current && agent.available)
            ? current
            : undefined
        );
        setSelectedWorkflowId((current) =>
          current && catalog.workflows.some((workflow) => workflow.id === current)
            ? current
            : undefined
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setRoutingOptions(createTaskRoutingOptions());
        setSelectedAgentId(undefined);
        setSelectedWorkflowId(undefined);
        setRoutingCatalogError("Unable to load routing catalog.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsRoutingCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      detailModalTaskId &&
      !taskState.tasks.some((task) => (task.taskId as string) === detailModalTaskId)
    ) {
      setDetailModalTaskId(null);
    }
  }, [detailModalTaskId, taskState.tasks]);

  useEffect(() => {
    setIsCancelDialogOpen(false);
    setCancelTargetTaskId(null);
  }, [activeTask?.taskId]);

  useEffect(() => {
    if (!isProviderUnavailable) {
      setProviderUnavailableDismissed(false);
    }
  }, [isProviderUnavailable]);

  const interactionIsDisabled = isLoading || taskState.isSubmitting;

  function handleCancelActiveTask(): void {
    if (!cancellableActiveTask) {
      return;
    }
    if (onCancelTaskRequested) {
      onCancelTaskRequested(cancellableActiveTask.taskId);
      return;
    }
    setIsCancelDialogOpen(true);
    setCancelTargetTaskId(cancellableActiveTask.taskId);
  }

  async function handleAcceptedSubmission() {
    if (taskState.isSubmitting) {
      return;
    }

    const requestResult = buildCreateTaskRequest({
      prompt,
      routingMode,
      selectedAgentId,
      selectedWorkflowId
    });

    if (!requestResult.ok) {
      dispatchTaskAction({
        type: "submit-rejected",
        message: requestResult.message
      });
      return;
    }

    dispatchTaskAction({ type: "submit-started" });

    try {
      const conversationId = getPendingSubmissionConversationId();
      const response = await clientRef.current.createTask(requestResult.request, {
        conversationId
      });
      dispatchTaskAction({
        type: "task-created",
        request: requestResult.request,
        response,
        conversationId
      });
      setPrompt("");

      const sub = clientRef.current.subscribeToTaskEvents(response.taskId as string, (event) => {
        if (mountedRef.current) {
          dispatchTaskAction({ type: "runtime-event", event });
        }
      });
      subscriptionsRef.current.set(response.taskId as string, sub);
    } catch {
      dispatchTaskAction({
        type: "submission-failed",
        message: "Task could not be created. Keep your draft and try again."
      });
    }
  }

  return (
    <section
      className={`task-workspace${
        conversationSidebarCollapsed ? " task-workspace--sidebar-collapsed" : ""
      }`}
      aria-labelledby="task-workspace-title"
    >
      <aside
        className={`task-workspace__sidebar${
          conversationSidebarCollapsed ? " task-workspace__sidebar--collapsed" : ""
        }`}
        aria-label="Task workspace sidebar"
      >
        {conversationSidebarCollapsed ? (
          <div className="task-workspace__sidebar-rail">
            <TaskConversationNavigation
              items={navigationItems}
              activeConversationId={taskState.activeConversationId}
              isCollapsed
              onCreateConversation={handleCreateConversation}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversationRequest}
            />
            <button
              type="button"
              className="task-workspace__sidebar-toggle task-workspace__sidebar-toggle--expand"
              aria-expanded={false}
              aria-label="Expand conversations"
              title="Expand conversations"
              onClick={() => setConversationSidebarCollapsed(false)}
            >
              ›
            </button>
          </div>
        ) : (
          <>
            <div className="task-workspace__sidebar-header">
              <div>
                <p className="task-workspace__eyebrow">Conversations</p>
                <h2>Workspace sessions</h2>
              </div>
              <button
                type="button"
                className="task-workspace__sidebar-toggle"
                aria-expanded={true}
                aria-label="Collapse conversations"
                title="Collapse conversations"
                onClick={() => setConversationSidebarCollapsed(true)}
              >
                ‹
              </button>
            </div>
            <TaskConversationNavigation
              items={navigationItems}
              activeConversationId={taskState.activeConversationId}
              isCollapsed={false}
              onCreateConversation={handleCreateConversation}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversationRequest}
            />
          </>
        )}
      </aside>

      <div className="task-workspace__main">
        <header className="task-workspace__header">
          <div className="task-workspace__header-copy">
            <div>
              <p className="task-workspace__eyebrow">Workspace</p>
              <h2 id="task-workspace-title">Task &amp; Orchestration</h2>
              {activeConversation ? (
                <p className="task-workspace__active-conversation">
                  {activeConversation.title}
                </p>
              ) : (
                <p className="task-workspace__header-subtitle">
                  Bring a request to your virtual team and keep the work in one conversation.
                </p>
              )}
            </div>
          </div>
          <div
            className={`task-workspace__provider-badge task-workspace__provider-badge--${providerBadge.tone}`}
            aria-label={`Execution provider: ${providerBadge.label}`}
            title={providerBadge.label}
          >
            <span className="task-workspace__provider-dot" aria-hidden="true" />
            <span>{providerBadge.label}</span>
          </div>
        </header>

        <section className="task-workspace__conversation" aria-label="Main conversation region">
          {isReconnecting ? (
            <div className="task-workspace__reconnecting" role="status" aria-live="polite">
              <span
                className="task-workspace__spinner task-workspace__spinner--reconnecting"
                aria-hidden="true"
              />
              <div>
                <h3>Reconnecting to workspace gateway</h3>
                <p>
                  Restoring live synchronization. Your canonical task processing continues in the
                  background.
                </p>
              </div>
            </div>
          ) : null}

          {isProviderUnavailable && !providerUnavailableDismissed ? (
            <div className="task-workspace__provider-unavailable" role="alert">
              <div>
                <h3>Execution Provider Unavailable</h3>
                <p>
                  The external OpenClaw runtime is currently unreachable or stopped. Tasks will
                  remain queued until the Gateway connection is restored.
                </p>
              </div>
              <button
                type="button"
                className="task-workspace__feedback-dismiss"
                aria-label="Dismiss provider unavailable message"
                onClick={() => setProviderUnavailableDismissed(true)}
              >
                x
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="task-workspace__loading" role="status" aria-live="polite">
              <span className="task-workspace__spinner" aria-hidden="true" />
              <div>
                <h3>Preparing your workspace</h3>
                <p>Loading local conversation controls and suggestions.</p>
              </div>
            </div>
          ) : activeConversation && activeConversationTasks.length > 0 ? (
            <div className="task-workspace__feed" aria-label="Conversation task feed">
              {activeConversationTasks.map((task) => {
                const isRunning = task.status === "running";
                const articleLabel =
                  task.status === "running"
                    ? "In-progress task"
                    : task.status === "cancelled"
                    ? "Canceled task"
                    : task.status === "failed"
                    ? "Failed task"
                    : task.status === "succeeded"
                    ? "Completed task"
                    : "Pending task";

                return (
                  <article
                    key={task.taskId as string}
                    className={`task-workspace__task-view${
                      isRunning ? " task-workspace__task-view--in-progress" : ""
                    }`}
                    aria-label={articleLabel}
                  >
                    <TaskConversation
                      task={task}
                      routingSummary={formatCompactRoutingSummary(task.requestedRouting)}
                      clipboardWriter={completionRuntimeRef.current.clipboard}
                      onOpenDetails={() => setDetailModalTaskId(task.taskId as string)}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="task-workspace__empty">
              <span className="task-workspace__empty-mark" aria-hidden="true">
                ✦
              </span>
              <p className="task-workspace__eyebrow">Start a conversation</p>
              <h3>What should your virtual team work on?</h3>
              <p className="task-workspace__empty-subtitle">
                Pick a suggestion or describe your own request below.
              </p>
              <ul className="task-workspace__suggestions" aria-label="Suggested prompts">
                {suggestedPrompts.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => setPrompt(suggestion)}
                      disabled={isLoading}
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {detailModalTask ? (
          <TaskProcessingDetailModal
            detail={buildTaskProcessingDetail(detailModalTask)!}
            onClose={() => setDetailModalTaskId(null)}
          />
        ) : null}

        {(() => {
          const cancelTargetTask = taskState.tasks.find((t) => t.taskId === cancelTargetTaskId);
          return isCancelDialogOpen &&
            cancelTargetTask &&
            (cancelTargetTask.status === "queued" || cancelTargetTask.status === "running") ? (
            <TaskCancelConfirmationDialog
              task={cancelTargetTask}
              onConfirm={() => {
                clientRef.current.cancelTask(cancelTargetTask.taskId as string);
                setIsCancelDialogOpen(false);
                setCancelTargetTaskId(null);
              }}
              onDismiss={() => {
                setIsCancelDialogOpen(false);
                setCancelTargetTaskId(null);
              }}
            />
          ) : null;
        })()}

        {deleteConversationTargetId ? (
          <TaskConfirmDialog
            title="Delete conversation?"
            description="This removes the conversation and its tasks from this session. Running work cannot be deleted."
            confirmLabel="Delete conversation"
            onConfirm={handleConfirmDeleteConversation}
            onDismiss={() => setDeleteConversationTargetId(null)}
          />
        ) : null}

        <section className="task-composer" aria-label="Task composer area">
          {taskState.validationError ? (
            <div className="task-workspace__feedback task-workspace__feedback--inline" role="alert">
              <span>{taskState.validationError}</span>
              <button
                type="button"
                className="task-workspace__feedback-dismiss"
                aria-label="Dismiss task feedback"
                onClick={() => dispatchTaskAction({ type: "feedback-dismissed" })}
              >
                x
              </button>
            </div>
          ) : null}
          {taskState.submissionError ? (
            <div className="task-workspace__feedback task-workspace__feedback--inline" role="alert">
              <span>{taskState.submissionError}</span>
              <button
                type="button"
                className="task-workspace__feedback-dismiss"
                aria-label="Dismiss task feedback"
                onClick={() => dispatchTaskAction({ type: "feedback-dismissed" })}
              >
                x
              </button>
            </div>
          ) : null}
          <TaskComposer
            prompt={prompt}
            isDisabled={isLoading}
            isSubmitting={taskState.isSubmitting}
            cancellableTaskActive={Boolean(cancellableActiveTask)}
            onPromptChange={setPrompt}
            onSubmit={handleAcceptedSubmission}
            onCancelTask={handleCancelActiveTask}
            toolbar={
              <RoutingSelector
                mode={routingMode}
                selectedAgentId={selectedAgentId}
                selectedWorkflowId={selectedWorkflowId}
                agents={routingOptions.agents}
                workflows={routingOptions.workflows}
                isDisabled={interactionIsDisabled}
                isCatalogLoading={isRoutingCatalogLoading}
                catalogError={routingCatalogError}
                createAgentHref="/agents"
                createWorkflowHref="/workflows"
                onModeChange={setRoutingMode}
                onAgentChange={setSelectedAgentId}
                onWorkflowChange={setSelectedWorkflowId}
              />
            }
          />
        </section>
      </div>
    </section>
  );
}

export function formatRoutingSummary(routing: TaskRoutingSelection): string {
  if (routing.mode === "specific-agent") {
    return `Routing: Specific agent ${routing.agentId}`;
  }

  if (routing.mode === "predefined-workflow") {
    return `Routing: Predefined workflow ${routing.workflowId}`;
  }

  return "Routing: Auto-routing";
}

export function formatCompactRoutingSummary(routing: TaskRoutingSelection): string {
  if (routing.mode === "specific-agent") {
    return `Agent · ${routing.agentId}`;
  }

  if (routing.mode === "predefined-workflow") {
    return `Workflow · ${routing.workflowId}`;
  }

  return "Auto-routing";
}
