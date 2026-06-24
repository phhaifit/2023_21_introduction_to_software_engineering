import { useReducer, useRef, useState } from "react";
import type { TaskRoutingSelection } from "@vcp/shared";

import { ProcessingTimeline } from "./components/processing-timeline";
import { RoutingSelector } from "./components/routing-selector";
import { TaskComposer } from "./components/task-composer";
import { TaskStatusBadge } from "./components/task-status-badge";
import {
  createTaskOrchestrationSeedData,
  DEMO_PROMPTS
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
import { toTaskPresentationStatus } from "./model/task-lifecycle";
import {
  ROUTING_MODES,
  type RoutingMode
} from "./model/task-types";

import "./task-orchestration-page.css";

type TaskOrchestrationPageProps = {
  isLoading?: boolean;
  taskCreationClient?: TaskCreationClient;
};

const suggestedPrompts = [
  DEMO_PROMPTS.weeklyProgressReport,
  DEMO_PROMPTS.specificAgentProductDescription,
  DEMO_PROMPTS.researchAndSynthesis
] as const;

const routingOptions = createTaskOrchestrationSeedData();

export function TaskOrchestrationPage({
  isLoading = false,
  taskCreationClient
}: TaskOrchestrationPageProps) {
  const [prompt, setPrompt] = useState("");
  const [routingMode, setRoutingMode] = useState<RoutingMode>(ROUTING_MODES[0]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>();
  const [taskState, dispatchTaskAction] = useReducer(
    taskCreationReducer,
    initialTaskCreationState
  );
  const taskClientRef = useRef(
    taskCreationClient ?? createMockTaskCreationClient()
  );
  const activeTask = getActiveTask(taskState);
  const activeTaskPresentationStatus = activeTask
    ? toTaskPresentationStatus(activeTask.status)
    : null;
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
            <article className="task-workspace__pending" aria-label="Pending task">
              <header className="task-workspace__pending-header">
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
                  <dt>Created</dt>
                  <dd>{activeTask.createdAt}</dd>
                </div>
              </dl>

              <p className="task-workspace__routing-summary">
                {formatRoutingSummary(activeTask.requestedRouting)}
              </p>

              <ProcessingTimeline
                ariaLabel="Initial processing timeline"
                steps={activeTask.timeline}
              />
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

function formatRoutingSummary(routing: TaskRoutingSelection): string {
  if (routing.mode === "specific-agent") {
    return `Routing: Specific agent ${routing.agentId}`;
  }

  if (routing.mode === "predefined-workflow") {
    return `Routing: Predefined workflow ${routing.workflowId}`;
  }

  return "Routing: Auto-routing";
}
