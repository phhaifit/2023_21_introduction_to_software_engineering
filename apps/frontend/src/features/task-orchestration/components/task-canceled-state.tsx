import type { CreatedTaskRecord } from "../model/task-types";

export interface TaskCanceledStateProps {
  task: CreatedTaskRecord;
}

export function TaskCanceledState({ task }: TaskCanceledStateProps) {
  if (task.status !== "cancelled") {
    return null;
  }

  return (
    <section className="task-canceled-state" aria-labelledby="task-canceled-state-title">
      <div className="task-canceled-state__header">
        <h4 id="task-canceled-state-title">Task Canceled</h4>
        {task.cancelledAt ? (
          <span className="task-canceled-state__time">
            Canceled at: {task.cancelledAt}
          </span>
        ) : null}
      </div>
      <div className="task-canceled-state__body">
        <p>This task was cancelled by the user. All processing and streaming have been permanently stopped.</p>
      </div>
    </section>
  );
}
