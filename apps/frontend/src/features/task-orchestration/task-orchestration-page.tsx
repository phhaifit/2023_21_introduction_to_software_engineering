import { useEffect, useReducer, useRef, useState } from "react";
import type { TaskRoutingSelection } from "@vcp/shared";

import { ProcessingTimeline } from "./components/processing-timeline";
import { RoutingSelector } from "./components/routing-selector";
import { TaskComposer } from "./components/task-composer";
import { TaskLogList } from "./components/task-log-list";
import { TaskPartialResult } from "./components/task-partial-result";
import { TaskStatusBadge } from "./components/task-status-badge";
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
  initialTaskCreationState,
  taskCreationReducer
} from "./model/task-creation-state";
import { isTerminalTaskStatus, toTaskPresentationStatus } from "./model/task-lifecycle";
import {
  createTaskProcessingController,
  TaskFinalStepBoundaryError,
  type TaskProcessingController,
  type TaskProcessingScheduleHandle
} from "./model/task-processing-controller";
import {
  createBrowserTaskProcessingRuntime,
  type TaskProcessingRuntime
} from "./model/task-processing-runtime";
import { ORDERED_STEP_IDS } from "./model/task-processing";
import { selectAccumulatedPartialText } from "./model/task-streaming";
import {
  createTaskStreamingController,
  type TaskStreamingController
} from "./model/task-streaming-controller";
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
import {
  createTaskCompletionController,
  type TaskCompletionController
} from "./model/task-completion-controller";
import { TaskCompletedResult } from "./components/task-completed-result";
import { TaskProcessingDetailModal } from "./components/task-processing-detail-modal";
import { buildTaskProcessingDetail } from "./model/task-processing-detail";
import {
  ROUTING_MODES,
  type RoutingMode
} from "./model/task-types";

import "./task-orchestration-page.css";

import type { CreatedTaskRecord } from "./model/task-types";

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
};

const suggestedPrompts = [
  DEMO_PROMPTS.weeklyProgressReport,
  DEMO_PROMPTS.specificAgentProductDescription,
  DEMO_PROMPTS.researchAndSynthesis
] as const;

const routingOptions = createTaskOrchestrationSeedData();
const FINAL_STEP_ID = ORDERED_STEP_IDS[ORDERED_STEP_IDS.length - 1];
const STREAMING_START_STEP_ID = "execute-task";

export function TaskOrchestrationPage({
  isLoading = false,
  taskCreationClient,
  onCancelTaskRequested,
  processingRuntime,
  processingDelays,
  streamingRuntime,
  streamingDelays,
  completionRuntime,
  completionDelays
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
  const controllerRef = useRef<TaskProcessingController | null>(null);
  const progressionHandleRef = useRef<TaskProcessingScheduleHandle | null>(null);
  const streamingRuntimeRef = useRef(
    streamingRuntime ?? createDefaultTaskStreamingRuntime()
  );
  const streamingDelaysRef = useRef(
    streamingDelays ?? {
      fragmentMs: DEMO_TIMINGS.streamChunkMs ?? DEFAULT_TASK_STREAMING_DELAYS.fragmentMs
    }
  );
  const streamingControllerRef = useRef<TaskStreamingController | null>(null);

  const completionRuntimeRef = useRef(
    completionRuntime ?? createBrowserTaskCompletionRuntime()
  );
  const completionDelaysRef = useRef(
    completionDelays ?? DEFAULT_TASK_COMPLETION_DELAYS
  );
  const completionControllerRef = useRef<TaskCompletionController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createTaskProcessingController({
      scheduler: runtimeRef.current.scheduler,
      clock: runtimeRef.current.clock,
      logIdentitySource: runtimeRef.current.logIdentitySource,
      actionSink: {
        dispatch: (action) => dispatchRef.current(action)
      },
      pendingDelayMs: delaysRef.current.pendingMs
    });
  }

  if (!streamingControllerRef.current) {
    streamingControllerRef.current = createTaskStreamingController({
      scheduler: streamingRuntimeRef.current.scheduler,
      clock: streamingRuntimeRef.current.clock,
      fragmentIdentitySource: streamingRuntimeRef.current.fragmentIdentitySource,
      fragmentSource: streamingRuntimeRef.current.fragmentSource,
      stateReader: {
        findTask: (taskId) =>
          taskStateRef.current.tasks.find((task) => task.taskId === taskId) ??
          null
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
      fragmentDelayMs: streamingDelaysRef.current.fragmentMs
    });
  }

  if (!completionControllerRef.current) {
    completionControllerRef.current = createTaskCompletionController({
      scheduler: completionRuntimeRef.current.scheduler,
      stateReader: {
        findTask: (taskId) =>
          taskStateRef.current.tasks.find((task) => task.taskId === taskId) ?? null
      },
      resultSource: completionRuntimeRef.current.resultSource,
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
      completionDelayMs: completionDelaysRef.current.completionMs
    });
  }

  const activeTask = getActiveTask(taskState);
  const activeTaskPresentationStatus = activeTask
    ? toTaskPresentationStatus(activeTask.status)
    : null;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      progressionHandleRef.current?.cancel();
      progressionHandleRef.current = null;
      controllerRef.current?.dispose();
      streamingControllerRef.current?.dispose();
      completionControllerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const taskId = activeTask?.taskId;

    setIsDetailModalOpen(false);

    return () => {
      progressionHandleRef.current?.cancel();
      progressionHandleRef.current = null;
      if (taskId) {
        controllerRef.current?.stop(taskId);
        streamingControllerRef.current?.stop(taskId);
        completionControllerRef.current?.stop(taskId);
      }
    };
  }, [activeTask?.taskId]);

  useEffect(() => {
    const controller = controllerRef.current;
    const runtime = runtimeRef.current;
    const delays = delaysRef.current;
    const task = activeTask;

    progressionHandleRef.current?.cancel();
    progressionHandleRef.current = null;

    if (!controller || !task) {
      return;
    }

    const { taskId, status } = task;

    if (isTerminalTaskStatus(status)) {
      controller.stop(taskId);
      return;
    }

    if (status === "queued") {
      controller.scheduleStart(taskId);
      return;
    }

    if (status !== "running") {
      return;
    }

    const activeStep = task.processingSnapshot.steps.find(
      (step) => step.status === "active"
    );

    if (!activeStep || activeStep.id === FINAL_STEP_ID) {
      return;
    }

    progressionHandleRef.current = runtime.scheduler.schedule(delays.stepMs, () => {
      progressionHandleRef.current = null;
      try {
        controller.advance(taskId);
      } catch (error) {
        if (!(error instanceof TaskFinalStepBoundaryError)) {
          throw error;
        }
      }
    });
  }, [
    activeTask?.taskId,
    activeTask?.status,
    activeTask?.processingSnapshot.steps,
    activeTask?.processingSnapshot.logs.length
  ]);

  useEffect(() => {
    const task = activeTask;
    const controller = streamingControllerRef.current;

    if (!task || !controller) {
      return;
    }

    if (isTerminalTaskStatus(task.status)) {
      controller.stop(task.taskId);
      return;
    }

    if (task.status !== "running") {
      return;
    }

    if (task.streamingSnapshot.phase !== "idle") {
      return;
    }

    const activeStep = task.processingSnapshot.steps.find(
      (step) => step.status === "active"
    );

    if (activeStep?.id !== STREAMING_START_STEP_ID) {
      return;
    }

    controller.start(task.taskId);
  }, [
    activeTask?.taskId,
    activeTask?.status,
    activeTask?.streamingSnapshot.phase,
    activeTask?.processingSnapshot.steps
  ]);

  useEffect(() => {
    const task = activeTask;
    const controller = completionControllerRef.current;

    if (!task || !controller) {
      return;
    }

    if (isTerminalTaskStatus(task.status)) {
      controller.stop(task.taskId);
      return;
    }

    if (task.status !== "running") {
      return;
    }

    const finalStep = task.processingSnapshot.steps.at(-1);
    if (finalStep?.id !== FINAL_STEP_ID || finalStep.status !== "active") {
      return;
    }

    if (task.streamingSnapshot.phase !== "exhausted") {
      return;
    }

    if (task.finalizedResult) {
      return;
    }

    controller.start(task.taskId);
  }, [
    activeTask?.taskId,
    activeTask?.status,
    activeTask?.processingSnapshot.steps,
    activeTask?.streamingSnapshot.phase,
    activeTask?.finalizedResult
  ]);

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
        response
      });
      setPrompt("");
    } catch {
      dispatchTaskAction({
        type: "submission-failed",
        message: "Task could not be created. Keep your draft and try again."
      });
    }
  }

  const timelineAriaLabel =
    activeTask?.status === "running"
      ? "Processing timeline"
      : "Initial processing timeline";

  const taskArticleLabel =
    activeTask?.status === "running" ? "In-progress task" : "Pending task";
  const partialText = activeTask
    ? selectAccumulatedPartialText(activeTask.streamingSnapshot)
    : "";
  const shouldShowPartialResult =
    activeTask !== undefined &&
    activeTask.status !== "succeeded" &&
    (activeTask.streamingSnapshot.phase === "streaming" ||
      activeTask.streamingSnapshot.phase === "exhausted" ||
      activeTask.streamingSnapshot.fragments.length > 0);

  return (
    <section className="task-workspace" aria-labelledby="task-workspace-title">
      <aside className="task-workspace__sidebar" aria-label="Task workspace sidebar">
        <div>
          <p className="task-workspace__eyebrow">Conversations</p>
          <h2>Workspace sessions</h2>
        </div>
        <button type="button" disabled>
          New conversation
        </button>
        <section className="task-workspace__history" aria-labelledby="recent-work-title">
          <h3 id="recent-work-title">Recent work</h3>
          <p>No conversations yet.</p>
          <span>New sessions will appear here in a later task.</span>
        </section>
      </aside>

      <div className="task-workspace__main">
        <header className="task-workspace__header">
          <div>
            <p className="task-workspace__eyebrow">Demo workspace</p>
            <h2 id="task-workspace-title">Task &amp; Orchestration</h2>
            <p>Bring a request to your virtual team and keep the work in one conversation.</p>
          </div>
          <span className="task-workspace__label">PA5 workspace</span>
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
          ) : activeTask && activeTaskPresentationStatus ? (
            <article
              className={`task-workspace__task-view${
                activeTask.status === "running" ? " task-workspace__task-view--in-progress" : ""
              }`}
              aria-label={taskArticleLabel}
            >
              <header className="task-workspace__task-header">
                <div>
                  <p className="task-workspace__eyebrow">Submitted request</p>
                  <h3>{activeTask.prompt}</h3>
                </div>
                <TaskStatusBadge status={activeTaskPresentationStatus} />
              </header>

              <dl className="task-workspace__task-meta" aria-label="Task identifiers">
                <div>
                  <dt>Work ID</dt>
                  <dd>{activeTask.workId}</dd>
                </div>
                <div>
                  <dt>Task ID</dt>
                  <dd>{activeTask.taskId}</dd>
                </div>
                <div>
                  <dt>{activeTask.processingSnapshot.startedAt ? "Started" : "Created"}</dt>
                  <dd>
                    {activeTask.processingSnapshot.startedAt ?? activeTask.createdAt}
                  </dd>
                </div>
              </dl>

              <p className="task-workspace__routing-summary">
                {formatRoutingSummary(activeTask.requestedRouting)}
              </p>

              <ProcessingTimeline
                ariaLabel={timelineAriaLabel}
                steps={activeTask.processingSnapshot.steps}
              />

              {activeTask.status === "running" ? (
                <TaskLogList
                  logs={activeTask.processingSnapshot.logs}
                  ariaLabel="Orchestration processing logs"
                />
              ) : null}

              {shouldShowPartialResult ? (
                <TaskPartialResult
                  partialText={partialText}
                  phase={activeTask.streamingSnapshot.phase}
                />
              ) : null}

              {activeTask.status === "succeeded" && activeTask.finalizedResult ? (
                <TaskCompletedResult
                  result={activeTask.finalizedResult}
                  clipboardWriter={completionRuntimeRef.current.clipboard}
                />
              ) : null}

              {activeTask.status === "queued" ? (
                <div className="task-workspace__pending-actions">
                  <button
                    type="button"
                    className="task-workspace__cancel-btn"
                    onClick={() => onCancelTaskRequested?.(activeTask.taskId)}
                  >
                    Cancel task
                  </button>
                </div>
              ) : null}

              {activeTask.status === "succeeded" || activeTask.status === "running" ? (
                <div className="task-workspace__detail-actions">
                  <button type="button" onClick={() => setIsDetailModalOpen(true)}>
                    View processing details
                  </button>
                </div>
              ) : null}
            </article>
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
