import type { TaskError } from "../model/task-types";

export interface TaskErrorDetailsProps {
  error: TaskError;
}

export function formatOccurredAt(occurredAt: string): string {
  if (!occurredAt) {
    return "Unavailable";
  }
  try {
    const parsed = new Date(occurredAt);
    if (isNaN(parsed.getTime())) {
      return occurredAt;
    }
    return occurredAt;
  } catch {
    return occurredAt;
  }
}

export function TaskErrorDetails({ error }: TaskErrorDetailsProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="task-error-details" role="alert" aria-labelledby="task-error-details-title">
      <div className="task-error-details__header">
        <h5 id="task-error-details-title">{error.title}</h5>
        <span
          className="task-error-details__time"
          aria-label={`Occurred at: ${formatOccurredAt(error.occurredAt)}`}
        >
          Occurred at: {formatOccurredAt(error.occurredAt)}
        </span>
      </div>
      <div className="task-error-details__body">
        <p>{error.message}</p>
      </div>
      <dl className="task-error-details__meta" aria-label="Error metadata">
        <div>
          <dt>Error code</dt>
          <dd>{error.code}</dd>
        </div>
        <div>
          <dt>Failed step</dt>
          <dd>{error.stepId || "Unknown step"}</dd>
        </div>
      </dl>
    </div>
  );
}
