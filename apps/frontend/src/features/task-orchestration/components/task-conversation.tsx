import type { CreatedTaskRecord, TaskPresentationStatus } from "../model/task-types";
import { selectAccumulatedPartialText } from "../model/task-streaming";
import { toTaskPresentationStatus } from "../model/task-lifecycle";
import { TaskCompletedResult } from "./task-completed-result";
import { TaskPartialResult } from "./task-partial-result";
import { TaskFailedState } from "./task-failed-state";
import { TaskCanceledState } from "./task-canceled-state";
import { TaskTurnActionsMenu } from "./task-turn-actions-menu";
import { TaskAssistantProgressSummary } from "./task-assistant-progress-summary";
import { TaskMarkdown } from "./task-markdown";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";

const TASK_STATUS_LABELS: Readonly<Record<TaskPresentationStatus, string>> = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

export interface TaskConversationProps {
  task: CreatedTaskRecord;
  routingSummary: string;
  clipboardWriter: TaskClipboardWriter;
  onOpenDetails: () => void;
}

export function TaskConversation({
  task,
  routingSummary,
  clipboardWriter,
  onOpenDetails
}: TaskConversationProps) {
  const partialText = selectAccumulatedPartialText(task.streamingSnapshot);
  const isStreaming = task.streamingSnapshot.phase === "streaming";
  const shouldShowPartialResult =
    task.status === "running" &&
    partialText.trim().length > 0 &&
    task.processingSnapshot.steps.some(
      (s) =>
        (s.id === "execute-task" ||
          s.id === "aggregate-result" ||
          s.id === "finalize") &&
        (s.status === "active" || s.status === "completed")
    );

  return (
    <div className="task-conversation" aria-label="Task chat conversation">
      <TaskUserMessage
        prompt={task.prompt}
        routingSummary={routingSummary}
        task={task}
        clipboardWriter={clipboardWriter}
        onOpenDetails={onOpenDetails}
      />
      <TaskAssistantMessage
        task={task}
        partialText={partialText}
        isStreaming={isStreaming}
        shouldShowPartialResult={shouldShowPartialResult}
        clipboardWriter={clipboardWriter}
        onOpenDetails={onOpenDetails}
      />
    </div>
  );
}

export function TaskUserMessage({
  prompt,
  routingSummary,
  task,
  clipboardWriter,
  onOpenDetails
}: {
  prompt: string;
  routingSummary: string;
  task: CreatedTaskRecord;
  clipboardWriter: TaskClipboardWriter;
  onOpenDetails: () => void;
}) {
  return (
    <div
      className="task-conversation__turn task-conversation__turn--user"
      aria-label="User message"
    >
      <div className="task-conversation__avatar task-conversation__avatar--user" aria-hidden="true">
        U
      </div>
      <div className="task-conversation__bubble task-conversation__bubble--user">
        <div className="task-conversation__turn-toolbar">
          <span className="task-conversation__routing-summary">{routingSummary}</span>
        </div>
        <p className="task-conversation__prompt">{prompt}</p>
        <TaskTurnActionsMenu
          task={task}
          prompt={prompt}
          clipboardWriter={clipboardWriter}
          variant="query"
          onViewDetails={onOpenDetails}
        />
      </div>
    </div>
  );
}

export function TaskAssistantMessage({
  task,
  partialText,
  isStreaming,
  shouldShowPartialResult,
  clipboardWriter,
  onOpenDetails
}: {
  task: CreatedTaskRecord;
  partialText: string;
  isStreaming: boolean;
  shouldShowPartialResult: boolean;
  clipboardWriter: TaskClipboardWriter;
  onOpenDetails: () => void;
}) {
  const isFailed = task.status === "failed";
  const isCanceled = task.status === "cancelled";
  const isSucceeded = task.status === "succeeded";
  const isNonTerminal = task.status === "queued" || task.status === "running";
  const presentationStatus = toTaskPresentationStatus(task.status);
  const presentationStatusLabel = presentationStatus
    ? TASK_STATUS_LABELS[presentationStatus]
    : null;
  const toolbarStatusLabel = isNonTerminal ? null : presentationStatusLabel;

  return (
    <div
      className="task-conversation__turn task-conversation__turn--assistant"
      aria-label="Assistant response"
    >
      <div
        className="task-conversation__avatar task-conversation__avatar--assistant"
        aria-hidden="true"
      >
        *
      </div>
      <div className="task-conversation__bubble task-conversation__bubble--assistant">
        <div className="task-conversation__turn-toolbar">
          <div className="task-conversation__turn-toolbar-labels">
            <span className="task-conversation__assistant-label">Assistant</span>
            {toolbarStatusLabel ? (
              <span className="sr-only" aria-label={`Task status: ${toolbarStatusLabel}`}>
                {toolbarStatusLabel}
              </span>
            ) : null}
          </div>
        </div>

        {isNonTerminal ? <TaskAssistantProgressSummary task={task} /> : null}

        {isSucceeded && task.finalizedResult ? (
          <TaskCompletedResult result={task.finalizedResult} clipboardWriter={clipboardWriter} />
        ) : isFailed ? (
          <TaskFailedState task={task} />
        ) : isCanceled ? (
          <TaskCanceledState task={task} />
        ) : shouldShowPartialResult ? (
          <TaskPartialResult partialText={partialText} phase={task.streamingSnapshot.phase} />
        ) : (
          <div className="task-conversation__streaming-area task-conversation__streaming-area--compact">
            {isStreaming ? (
              <div className="task-conversation__indicator task-loading-pulse" role="status">
                Generating response...
              </div>
            ) : null}
            <TaskMarkdown
              className="task-conversation__partial-text task-markdown"
              aria-live="polite"
              text={
                partialText ||
                (task.status === "queued" ? "Waiting for runtime..." : "Working on it")
              }
            />
          </div>
        )}
        <TaskTurnActionsMenu
          task={task}
          prompt={task.prompt}
          clipboardWriter={clipboardWriter}
          variant="response"
          onViewDetails={onOpenDetails}
        />
      </div>
    </div>
  );
}
