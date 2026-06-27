import type { CreatedTaskRecord } from "../model/task-types";
import { selectAccumulatedPartialText } from "../model/task-streaming";
import { TaskCompletedResult } from "./task-completed-result";
import { TaskPartialResult } from "./task-partial-result";
import { TaskFailedState } from "./task-failed-state";
import { TaskCanceledState } from "./task-canceled-state";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";

export interface TaskConversationProps {
  task: CreatedTaskRecord;
  clipboardWriter: TaskClipboardWriter;
}

export function TaskConversation({ task, clipboardWriter }: TaskConversationProps) {
  const partialText = selectAccumulatedPartialText(task.streamingSnapshot);
  const isStreaming = task.streamingSnapshot.phase === "streaming";
  const shouldShowPartialResult =
    task.status === "running" &&
    task.processingSnapshot.steps.some(
      (s) => (s.id === "execute-task" || s.id === "aggregate-result" || s.id === "finalize") && (s.status === "active" || s.status === "completed")
    );

  return (
    <div className="task-conversation" aria-label="Task chat conversation">
      <TaskUserMessage prompt={task.prompt} />
      <TaskAssistantMessage
        task={task}
        partialText={partialText}
        isStreaming={isStreaming}
        shouldShowPartialResult={shouldShowPartialResult}
        clipboardWriter={clipboardWriter}
      />
    </div>
  );
}

export function TaskUserMessage({ prompt }: { prompt: string }) {
  return (
    <div className="task-conversation__message task-conversation__message--user" aria-label="User message">
      <div className="task-conversation__avatar task-conversation__avatar--user" aria-hidden="true">U</div>
      <div className="task-conversation__bubble task-conversation__bubble--user">
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
  clipboardWriter
}: {
  task: CreatedTaskRecord;
  partialText: string;
  isStreaming: boolean;
  shouldShowPartialResult: boolean;
  clipboardWriter: TaskClipboardWriter;
}) {
  const isFailed = task.status === "failed";
  const isCanceled = task.status === "cancelled";
  const isSucceeded = task.status === "succeeded";

  return (
    <div className="task-conversation__message task-conversation__message--assistant" aria-label="Assistant response">
      <div className="task-conversation__avatar task-conversation__avatar--assistant" aria-hidden="true">✦</div>
      <div className="task-conversation__bubble task-conversation__bubble--assistant">
        {isSucceeded && task.finalizedResult ? (
          <TaskCompletedResult result={task.finalizedResult} clipboardWriter={clipboardWriter} />
        ) : isFailed ? (
          <TaskFailedState task={task} />
        ) : isCanceled ? (
          <TaskCanceledState task={task} />
        ) : shouldShowPartialResult ? (
          <TaskPartialResult
            partialText={partialText}
            phase={task.streamingSnapshot.phase}
          />
        ) : (
          <div className="task-conversation__streaming-area">
            {isStreaming ? (
              <div className="task-conversation__indicator task-loading-pulse" role="status">
                Generating partial result...
              </div>
            ) : null}
            <p className="task-conversation__partial-text" aria-live="polite">
              {partialText || (task.status === "queued" ? "Task is queued..." : "Processing started...")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
