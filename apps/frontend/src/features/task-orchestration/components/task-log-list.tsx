import type { TaskLog, TaskLogLevel } from "../model/task-types";

import "./task-orchestration-components.css";

const LOG_LEVEL_LABELS: Readonly<Record<TaskLogLevel, string>> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error"
};

interface TaskLogListProps {
  logs: readonly TaskLog[];
  ariaLabel?: string;
  emptyMessage?: string;
}

export function TaskLogList({
  logs,
  ariaLabel = "Task processing logs",
  emptyMessage = "No processing logs available."
}: TaskLogListProps) {
  if (logs.length === 0) {
    return (
      <section className="task-log-list" aria-label={ariaLabel}>
        <p className="task-log-list__empty">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="task-log-list" aria-label={ariaLabel}>
      <ul className="task-log-list__items" aria-label={ariaLabel}>
        {logs.map((log) => (
          <li
            className={`task-log-list__item task-log-list__item--${log.level}`}
            key={log.id}
          >
            <div className="task-log-list__header">
              <span
                className={`task-log-list__level task-log-list__level--${log.level}`}
              >
                {LOG_LEVEL_LABELS[log.level]}
              </span>
              <span className="task-log-list__timestamp">{log.timestamp}</span>
            </div>
            <p className="task-log-list__message">{log.message}</p>
            <dl className="task-log-list__metadata">
              <div>
                <dt>Log ID</dt>
                <dd>{log.id}</dd>
              </div>
              <div>
                <dt>Step</dt>
                <dd>{log.stepId}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
