import type { TaskStatus } from "../model/task-types";

import "./task-orchestration-components.css";

const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const label = TASK_STATUS_LABELS[status];

  return (
    <span
      className={`task-status-badge task-status-badge--${status}`}
      aria-label={`Task status: ${label}`}
    >
      {label}
    </span>
  );
}
