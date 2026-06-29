import type { CreatedTaskRecord } from "../model/task-types";
import { toTaskPresentationStatus } from "../model/task-lifecycle";
import { TaskStatusBadge } from "./task-status-badge";

export interface TaskAssistantProgressSummaryProps {
  task: CreatedTaskRecord;
}

export function TaskAssistantProgressSummary({ task }: TaskAssistantProgressSummaryProps) {
  const presentationStatus = toTaskPresentationStatus(task.status);
  if (!presentationStatus || (task.status !== "queued" && task.status !== "running")) {
    return null;
  }

  const activeStep = task.processingSnapshot.steps.find((step) => step.status === "active");
  const completedSteps = task.processingSnapshot.steps.filter((step) => step.status === "completed");
  const totalSteps = task.processingSnapshot.steps.length;

  const stepSummary =
    task.status === "queued"
      ? "Queued for processing"
      : `${activeStep ? activeStep.label : "Processing"} · ${completedSteps.length}/${totalSteps} steps`;

  return (
    <div className="task-assistant-progress" aria-live="polite">
      {presentationStatus ? <TaskStatusBadge status={presentationStatus} /> : null}
      <span className="task-assistant-progress__steps">{stepSummary}</span>
    </div>
  );
}
