import type { CreatedTaskRecord } from "../model/task-types";
import { selectAccumulatedPartialText } from "../model/task-streaming";
import { toTaskPresentationStatus } from "../model/task-lifecycle";
import { TaskCompletedResult } from "./task-completed-result";
import { TaskPartialResult } from "./task-partial-result";
import { TaskFailedState } from "./task-failed-state";
import { TaskCanceledState } from "./task-canceled-state";
import { TaskTurnActionsMenu } from "./task-turn-actions-menu";
import { TaskAssistantProgressSummary } from "./task-assistant-progress-summary";
import { TaskStatusBadge } from "./task-status-badge";import type { TaskClipboardWriter } from "../model/task-completion-runtime";

export interface TaskConversationProps {
  task: CreatedTaskRecord;
  routingSummary: string;
  clipboardWriter: TaskClipboardWriter;
  canDeleteTask: boolean;
  deleteTaskDisabledReason?: string;
  onOpenDetails: () => void;
  onDeleteTask: () => void;
}

export function TaskConversation({
  task,
  routingSummary,
  clipboardWriter,
  canDeleteTask,
  deleteTaskDisabledReason,
  onOpenDetails,
  onDeleteTask
}: TaskConversationProps) {
  const partialText = selectAccumulatedPartialText(task.streamingSnapshot);
  const isStreaming = task.streamingSnapshot.phase === "streaming";
  const shouldShowPartialResult =
    task.status === "running" &&
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
        canDeleteTask={canDeleteTask}
        deleteTaskDisabledReason={deleteTaskDisabledReason}
        onOpenDetails={onOpenDetails}
        onDeleteTask={onDeleteTask}
      />
      <TaskAssistantMessage
        task={task}
        partialText={partialText}
        isStreaming={isStreaming}
        shouldShowPartialResult={shouldShowPartialResult}
        clipboardWriter={clipboardWriter}
        canDeleteTask={canDeleteTask}
        deleteTaskDisabledReason={deleteTaskDisabledReason}
        onOpenDetails={onOpenDetails}
        onDeleteTask={onDeleteTask}
      />
    </div>
  );
}

export function TaskUserMessage({
  prompt,
  routingSummary,
  task,
  clipboardWriter,
  canDeleteTask,
  deleteTaskDisabledReason,
  onOpenDetails,
  onDeleteTask
}: {
  prompt: string;
  routingSummary: string;
  task: CreatedTaskRecord;
  clipboardWriter: TaskClipboardWriter;
  canDeleteTask: boolean;
  deleteTaskDisabledReason?: string;
  onOpenDetails: () => void;
  onDeleteTask: () => void;
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
          <TaskTurnActionsMenu
            task={task}
            prompt={prompt}
            clipboardWriter={clipboardWriter}
            canDelete={canDeleteTask}
            deleteDisabledReason={deleteTaskDisabledReason}
            onViewDetails={onOpenDetails}
            onDelete={onDeleteTask}
          />
        </div>
        <p className="task-conversation__prompt">{prompt}</p>
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
  canDeleteTask,
  deleteTaskDisabledReason,
  onOpenDetails,
  onDeleteTask
}: {
  task: CreatedTaskRecord;
  partialText: string;
  isStreaming: boolean;
  shouldShowPartialResult: boolean;
  clipboardWriter: TaskClipboardWriter;
  canDeleteTask: boolean;
  deleteTaskDisabledReason?: string;
  onOpenDetails: () => void;
  onDeleteTask: () => void;
}) {
  const isFailed = task.status === "failed";
  const isCanceled = task.status === "cancelled";
  const isSucceeded = task.status === "succeeded";
  const isNonTerminal = task.status === "queued" || task.status === "running";
  const presentationStatus = toTaskPresentationStatus(task.status);

  return (
    <div
      className="task-conversation__turn task-conversation__turn--assistant"
      aria-label="Assistant response"
    >
      <div
        className="task-conversation__avatar task-conversation__avatar--assistant"
        aria-hidden="true"
      >
        ✦
      </div>
      <div className="task-conversation__bubble task-conversation__bubble--assistant">
        <div className="task-conversation__turn-toolbar">
          <div className="task-conversation__turn-toolbar-labels">
            <span className="task-conversation__assistant-label">Assistant</span>
            {!isNonTerminal && presentationStatus ? (
              <TaskStatusBadge status={presentationStatus} />
            ) : null}
          </div>          <TaskTurnActionsMenu
            task={task}
            prompt={task.prompt}
            clipboardWriter={clipboardWriter}
            canDelete={canDeleteTask}
            deleteDisabledReason={deleteTaskDisabledReason}
            onViewDetails={onOpenDetails}
            onDelete={onDeleteTask}
          />
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
          <div className="task-conversation__streaming-area">
            {isStreaming ? (
              <div className="task-conversation__indicator task-loading-pulse" role="status">
                Generating response...
              </div>
            ) : null}
            <p className="task-conversation__partial-text" aria-live="polite">
              {partialText ||
                (task.status === "queued" ? "Preparing your request..." : "Processing started...")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
