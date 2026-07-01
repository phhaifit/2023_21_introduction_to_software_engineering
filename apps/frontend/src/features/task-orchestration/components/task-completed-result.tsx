import type { TaskFinalizedResult } from "../model/task-completion";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";
import { TaskMarkdown } from "./task-markdown";

export interface TaskCompletedResultProps {
  result: TaskFinalizedResult;
  clipboardWriter: TaskClipboardWriter;
}

export function TaskCompletedResult({
  result,
  clipboardWriter: _clipboardWriter
}: TaskCompletedResultProps) {
  return (
    <TaskMarkdown
      className="task-completed-result task-markdown"
      aria-label="Assistant final response"
      text={result.text}
    />
  );
}
