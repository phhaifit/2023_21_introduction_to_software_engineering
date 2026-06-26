import type { CreatedTaskRecord } from "../model/task-types";
import { selectAccumulatedPartialText } from "../model/task-streaming";
import { TaskCompletedResult } from "./task-completed-result";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";

export interface TaskConversationProps {
  task: CreatedTaskRecord;
  clipboardWriter: TaskClipboardWriter;
}

export function TaskConversation({ task, clipboardWriter }: TaskConversationProps) {
  const partialText = selectAccumulatedPartialText(task.streamingSnapshot);
  const isStreaming = task.streamingSnapshot.phase === "streaming";

  return (
    <div className="task-conversation" aria-label="Task chat conversation">
      <TaskUserMessage prompt={task.prompt} />
      <TaskAssistantMessage
        task={task}
        partialText={partialText}
        isStreaming={isStreaming}
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
  clipboardWriter
}: {
  task: CreatedTaskRecord;
  partialText: string;
  isStreaming: boolean;
  clipboardWriter: TaskClipboardWriter;
}) {
  const isFailed = task.status === "failed";
  const isCanceled = task.status === "cancelled";
  const isSucceeded = task.status === "succeeded";
  const hasPartialOutput = task.streamingSnapshot.fragments.length > 0;

  return (
    <div className="task-conversation__message task-conversation__message--assistant" aria-label="Assistant response">
      <div className="task-conversation__avatar task-conversation__avatar--assistant" aria-hidden="true">✦</div>
      <div className="task-conversation__bubble task-conversation__bubble--assistant">
        {isSucceeded && task.finalizedResult ? (
          <TaskCompletedResult result={task.finalizedResult} clipboardWriter={clipboardWriter} />
        ) : isFailed ? (
          <div className="task-conversation__system-msg task-conversation__system-msg--failed">
            <p className="task-type-error-text">Task failed: {task.error?.title || "Processing error"}</p>
            {hasPartialOutput ? (
              <div className="task-conversation__partial-backup">
                <p className="task-type-metadata-label">Partial output before failure</p>
                <div className="task-conversation__partial-text">{partialText}</div>
              </div>
            ) : null}
          </div>
        ) : isCanceled ? (
          <div className="task-conversation__system-msg task-conversation__system-msg--canceled">
            <p className="task-type-result-text">Task canceled by user.</p>
          </div>
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
