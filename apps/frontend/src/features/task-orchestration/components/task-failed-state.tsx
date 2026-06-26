import type { CreatedTaskRecord } from "../model/task-types";
import { TaskErrorDetails } from "./task-error-details";
import { selectAccumulatedPartialText } from "../model/task-streaming";

export interface TaskFailedStateProps {
  task: CreatedTaskRecord;
}

export function TaskFailedState({ task }: TaskFailedStateProps) {
  if (task.status !== "failed" || !task.error) {
    return null;
  }

  const partialText = selectAccumulatedPartialText(task.streamingSnapshot);
  const hasPartialOutput = task.streamingSnapshot.fragments.length > 0;

  return (
    <section className="task-failed-state" aria-labelledby="task-failed-state-title">
      <header className="task-failed-state__header">
        <h4 id="task-failed-state-title">Task Failed</h4>
        <span className="task-failed-state__badge" aria-label="Status: Failed">
          Failed
        </span>
      </header>
      <div className="task-failed-state__error-wrapper">
        <TaskErrorDetails error={task.error} />
      </div>
      {hasPartialOutput ? (
        <div className="task-failed-state__partial-output" aria-labelledby="failed-partial-title">
          <p className="task-failed-state__eyebrow" id="failed-partial-title">
            Partial output before failure
          </p>
          <div className="task-failed-state__body">{partialText}</div>
        </div>
      ) : null}
    </section>
  );
}
