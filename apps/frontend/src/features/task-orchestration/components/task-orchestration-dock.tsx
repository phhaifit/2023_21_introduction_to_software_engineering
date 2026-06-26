import type { CreatedTaskRecord } from "../model/task-types";
import { toTaskPresentationStatus } from "../model/task-lifecycle";
import { TaskStatusBadge } from "./task-status-badge";

export interface TaskOrchestrationDockProps {
  task: CreatedTaskRecord;
  onOpenDetails: () => void;
  onCancelClick: () => void;
}

export function TaskOrchestrationDock({
  task,
  onOpenDetails,
  onCancelClick
}: TaskOrchestrationDockProps) {
  const presentationStatus = toTaskPresentationStatus(task.status);
  const isRunning = task.status === "running";
  const isQueued = task.status === "queued";
  const canCancel = isQueued || isRunning;

  const activeStep = task.processingSnapshot.steps.find((s) => s.status === "active");
  const completedSteps = task.processingSnapshot.steps.filter((s) => s.status === "completed");
  const totalSteps = task.processingSnapshot.steps.length;

  return (
    <div className="task-orchestration-dock" aria-label="Compact orchestration dock">
      <div className="task-orchestration-dock__status-area">
        {presentationStatus ? <TaskStatusBadge status={presentationStatus} /> : null}
        <div className="task-orchestration-dock__summary">
          {isRunning ? (
            <span className="task-orchestration-dock__step-info">
              {activeStep ? activeStep.label : "Processing"} · {completedSteps.length}/{totalSteps} steps
            </span>
          ) : isQueued ? (
            <span className="task-orchestration-dock__step-info">Queued for processing</span>
          ) : task.status === "succeeded" ? (
            <span className="task-orchestration-dock__terminal-info">Completed</span>
          ) : task.status === "failed" ? (
            <span className="task-orchestration-dock__terminal-info">Failed</span>
          ) : (
            <span className="task-orchestration-dock__terminal-info">Canceled</span>
          )}
        </div>
      </div>

      <div className="task-orchestration-dock__actions">
        {canCancel ? (
          <button
            type="button"
            className="task-workspace__cancel-btn task-orchestration-dock__cancel-btn"
            onClick={onCancelClick}
          >
            Cancel task
          </button>
        ) : null}

        <button
          type="button"
          className="task-orchestration-dock__details-btn"
          onClick={onOpenDetails}
          aria-label="View processing details"
        >
          {task.status === "failed" ? "View error" : "View details"}
        </button>
      </div>
    </div>
  );
}
