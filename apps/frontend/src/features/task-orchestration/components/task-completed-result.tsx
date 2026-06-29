import type { TaskFinalizedResult } from "../model/task-completion";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";

export interface TaskCompletedResultProps {
  result: TaskFinalizedResult;
  clipboardWriter: TaskClipboardWriter;
}

export function TaskCompletedResult({
  result,
  clipboardWriter: _clipboardWriter
}: TaskCompletedResultProps) {
  return (
    <div className="task-completed-result" aria-label="Assistant final response">
      {result.text}
    </div>
  );
}
