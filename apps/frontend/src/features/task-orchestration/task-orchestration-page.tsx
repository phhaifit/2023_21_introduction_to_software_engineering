import { useEffect, useReducer, useRef, useState } from "react";
import type { TaskRoutingSelection } from "@vcp/shared";

import { RoutingSelector } from "./components/routing-selector";
import { TaskComposer } from "./components/task-composer";
import {
  createTaskOrchestrationSeedData,
  DEMO_PROMPTS,
  DEMO_TIMINGS
} from "./mocks/task-orchestration-mocks";
import {
  createMockTaskCreationClient,
  type TaskCreationClient
} from "./model/task-creation-client";
import {
  buildCreateTaskRequest,
  getActiveTask,
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
import { buildTaskProcessingDetail } from "./model/task-processing-detail";
import type { TaskCancellationCoordinator } from "./model/task-cancellation-coordinator";
import {
  ROUTING_MODES,
  type RoutingMode,
  type CreatedTaskRecord
} from "./model/task-types";
import { TaskConversation } from "./components/task-conversation";
import { TaskOrchestrationDock } from "./components/task-orchestration-dock";
import {
  TaskConversationNavigation,
  type TaskConversationNavigationItem
} from "./components/task-conversation-navigation";
import {
  createTaskRuntimeRegistry,
  type TaskRuntimeRegistry
} from "./model/task-runtime-registry";

import "./task-orchestration-page.css";
import "./task-orchestration-tokens.css";

type TaskCancellationRequestHandler = (
  taskId: CreatedTaskRecord["taskId"]
) => void;

type TaskOrchestrationPageProps = {
  isLoading?: boolean;
  taskCreationClient?: TaskCreationClient;
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
  DEMO_PROMPTS.weeklyProgressReport,
  DEMO_PROMPTS.specificAgentProductDescription,
  DEMO_PROMPTS.researchAndSynthesis
] as const;

const routingOptions = createTaskOrchestrationSeedData();

export function TaskOrchestrationPage({
  isLoading = false,
  taskCreationClient,
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
  const [taskState, dispatchTaskAction] = useReducer(
    taskCreationReducer,
    initialTaskCreationState
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelTargetTaskId, setCancelTargetTaskId] = useState<string | null>(null);
  const taskClientRef = useRef(
    taskCreationClient ?? createMockTaskCreationClient()
  );
  const dispatchRef = useRef(dispatchTaskAction);
  dispatchRef.current = dispatchTaskAction;
  const taskStateRef = useRef(taskState);
  taskStateRef.current = taskState;
  const mountedRef = useRef(false);

  const runtimeRef = useRef(processingRuntime ?? createBrowserTaskProcessingRuntime());
  const delaysRef = useRef(processingDelays ?? DEMO_TIMINGS);
  const streamingRuntimeRef = useRef(
    streamingRuntime ?? createDefaultTaskStreamingRuntime()
  );
  const streamingDelaysRef = useRef(
    streamingDelays ?? {
      fragmentMs: DEMO_TIMINGS.streamChunkMs ?? DEFAULT_TASK_STREAMING_DELAYS.fragmentMs
    }
  );
  const completionRuntimeRef = useRef(
    completionRuntime ?? createBrowserTaskCompletionRuntime()
  );
  const completionDelaysRef = useRef(
    completionDelays ?? DEFAULT_TASK_COMPLETION_DELAYS
  );

  const runtimeRegistryRef = useRef<TaskRuntimeRegistry | null>(null);

  function getOrCreateRuntimeRegistry(): TaskRuntimeRegistry {
    if (runtimeRegistryRef.current) {
      return runtimeRegistryRef.current;
    }

    const registry = createTaskRuntimeRegistry({
      processingRuntime: runtimeRef.current,
      processingDelays: delaysRef.current,
      streamingRuntime: streamingRuntimeRef.current,
      streamingDelays: streamingDelaysRef.current,
      completionRuntime: completionRuntimeRef.current,
      completionDelays: completionDelaysRef.current,
      stateReader: {
        findTask: (taskId) =>
          taskStateRef.current.tasks.find((task) => task.taskId === taskId)
      },
      actionSink: {
        dispatch: (action) => {
          if (mountedRef.current) {
            taskStateRef.current = taskCreationReducer(
              taskStateRef.current,
              action
            );
            dispatchRef.current(action);
          }
        }
      },
      cancellationCoordinator
    });

    runtimeRegistryRef.current = registry;
    return registry;
  }

  const activeConversation = getActiveConversation(taskState);
  const activeConversationTasks = taskState.activeConversationId
    ? getConversationTasks(taskState, taskState.activeConversationId)
    : [];
  const latestActiveConversationTask = taskState.activeConversationId
    ? getLatestConversationTask(taskState, taskState.activeConversationId)
    : undefined;

  const activeTask = latestActiveConversationTask;
  const activeTaskPresentationStatus = activeTask
    ? toTaskPresentationStatus(activeTask.status)
    : null;

  const navigationItems: TaskConversationNavigationItem[] = taskState.conversations.map((conv) => {
    const latestTask = getLatestConversationTask(taskState, conv.conversationId);
    const convTasks = getConversationTasks(taskState, conv.conversationId);
    return {
      conversationId: conv.conversationId,
      title: conv.title,
      latestStatus: latestTask ? toTaskPresentationStatus(latestTask.status) : undefined,
      tasks: convTasks
    };
  });

  function handleSelectConversation(conversationId: string): void {
    setIsDetailModalOpen(false);
    setIsCancelDialogOpen(false);
    setCancelTargetTaskId(null);
    dispatchTaskAction({
      type: "conversation-selected",
      conversationId
    });
  }

  function handleCreateConversation(): void {
    setIsDetailModalOpen(false);
    setIsCancelDialogOpen(false);
    setCancelTargetTaskId(null);
    setPrompt("");
    dispatchTaskAction({
      type: "conversation-created",
      createdAt: runtimeRef.current.clock.now()
    });
  }

  useEffect(() => {
    mountedRef.current = true;

    const registry = getOrCreateRuntimeRegistry();

    return () => {
      mountedRef.current = false;
      registry.dispose();

      if (runtimeRegistryRef.current === registry) {
        runtimeRegistryRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    getOrCreateRuntimeRegistry().syncTasks(taskState.tasks);
  }, [taskState.tasks]);

  useEffect(() => {
    setIsDetailModalOpen(false);
    setIsCancelDialogOpen(false);
    setCancelTargetTaskId(null);
  }, [activeTask?.taskId]);

  const interactionIsDisabled = isLoading || taskState.isSubmitting;

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
      const response = await taskClientRef.current.createTask(requestResult.request);
      dispatchTaskAction({
        type: "task-created",
        request: requestResult.request,
        response,
        conversationId: taskState.activeConversationId
      });
      setPrompt("");
    } catch {
      dispatchTaskAction({
        type: "submission-failed",
        message: "Task could not be created. Keep your draft and try again."
      });
    }
  }

  return (
    <section className="task-workspace" aria-labelledby="task-workspace-title">
      <aside className="task-workspace__sidebar" aria-label="Task workspace sidebar">
        <div>
          <p className="task-workspace__eyebrow">Conversations</p>
          <h2>Workspace sessions</h2>
        </div>
        <TaskConversationNavigation
          items={navigationItems}
          activeConversationId={taskState.activeConversationId}
          onCreateConversation={handleCreateConversation}
          onSelectConversation={handleSelectConversation}
        />
      </aside>

      <div className="task-workspace__main">
        <header className="task-workspace__header">
          <div>
            <p className="task-workspace__eyebrow">Workspace</p>
            <h2 id="task-workspace-title">Task &amp; Orchestration</h2>
            <p>Bring a request to your virtual team and keep the work in one conversation.</p>
          </div>
        </header>

        <section
          className="task-workspace__conversation"
          aria-label="Main conversation region"
        >
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
                      clipboardWriter={completionRuntimeRef.current.clipboard}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="task-workspace__empty">
              <span className="task-workspace__empty-mark" aria-hidden="true">✦</span>
              <p className="task-workspace__eyebrow">Start a conversation</p>
              <h3>What should your virtual team work on?</h3>
              <p>Describe an outcome, choose a suggestion, or prepare your own request.</p>
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

        {isDetailModalOpen && activeTask ? (
          <TaskProcessingDetailModal
            detail={buildTaskProcessingDetail(activeTask)!}
            onClose={() => setIsDetailModalOpen(false)}
          />
        ) : null}

        {(() => {
          const cancelTargetTask = taskState.tasks.find((t) => t.taskId === cancelTargetTaskId);
          return isCancelDialogOpen && cancelTargetTask && (cancelTargetTask.status === "queued" || cancelTargetTask.status === "running") ? (
            <TaskCancelConfirmationDialog
              task={cancelTargetTask}
              onConfirm={() => {
                getOrCreateRuntimeRegistry().cancelTask(cancelTargetTask.taskId);
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

        {activeTask ? (
          <TaskOrchestrationDock
            task={activeTask}
            onOpenDetails={() => setIsDetailModalOpen(true)}
            onCancelClick={() => {
              if (onCancelTaskRequested) {
                onCancelTaskRequested(activeTask.taskId);
              } else {
                setIsCancelDialogOpen(true);
                setCancelTargetTaskId(activeTask.taskId);
              }
            }}
          />
        ) : null}

        <section className="task-composer" aria-label="Task composer area">
          <RoutingSelector
            mode={routingMode}
            selectedAgentId={selectedAgentId}
            selectedWorkflowId={selectedWorkflowId}
            agents={routingOptions.agents}
            workflows={routingOptions.workflows}
            isDisabled={interactionIsDisabled}
            onModeChange={setRoutingMode}
            onAgentChange={setSelectedAgentId}
            onWorkflowChange={setSelectedWorkflowId}
          />
          {taskState.validationError ? (
            <p className="task-workspace__feedback" role="alert">
              {taskState.validationError}
            </p>
          ) : null}
          {taskState.submissionError ? (
            <p className="task-workspace__feedback" role="alert">
              {taskState.submissionError}
            </p>
          ) : null}
          <TaskComposer
            prompt={prompt}
            isDisabled={isLoading}
            isSubmitting={taskState.isSubmitting}
            onPromptChange={setPrompt}
            onSubmit={handleAcceptedSubmission}
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
