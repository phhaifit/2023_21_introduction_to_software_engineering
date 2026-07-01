import type { CreatedTaskRecord } from "../model/task-types";
import { toTaskPresentationStatus } from "../model/task-lifecycle";
import { TaskStatusBadge } from "./task-status-badge";

export interface TaskAssistantProgressSummaryProps {
  task: CreatedTaskRecord;
}

type ActivityKind = "agent" | "search" | "tool" | "file" | "message";

interface ActivityLabel {
  readonly kind: ActivityKind;
  readonly label: string;
  readonly hint: string;
}

export function TaskAssistantProgressSummary({ task }: TaskAssistantProgressSummaryProps) {
  const presentationStatus = toTaskPresentationStatus(task.status);
  if (!presentationStatus || (task.status !== "queued" && task.status !== "running")) {
    return null;
  }

  const activeStep = task.processingSnapshot.steps.find((step) => step.status === "active");
  const completedSteps = task.processingSnapshot.steps.filter((step) => step.status === "completed");
  const totalSteps = task.processingSnapshot.steps.length;
  const visibleSteps = task.processingSnapshot.steps.filter(
    (step) => step.status === "active" || step.status === "completed" || step.status === "failed"
  );
  const recentSteps = visibleSteps.slice(-4);
  const currentActivity = resolveActivityLabel(
    activeStep?.label ||
      task.processingSnapshot.logs.at(-1)?.message ||
      (task.status === "queued" ? "Queued" : "Processing")
  );

  const stepSummary =
    task.status === "queued"
      ? "Waiting for runtime"
      : `${currentActivity.label} - ${completedSteps.length}/${totalSteps} steps`;

  return (
    <div className="task-assistant-progress" aria-live="polite">
      <div className="task-assistant-progress__header">
        <TaskStatusBadge status={presentationStatus} />
        {task.status === "running" ? (
          <span
            className={`task-assistant-progress__pulse task-assistant-progress__pulse--${currentActivity.kind}`}
            aria-hidden="true"
          />
        ) : null}
        <span className="task-assistant-progress__steps">{stepSummary}</span>
      </div>

      {recentSteps.length > 0 ? (
        <ol className="task-assistant-progress__mini-steps" aria-label="Recent runtime steps">
          {recentSteps.map((step) => {
            const activity = resolveActivityLabel(step.label);
            return (
              <li
                key={step.id}
                className={`task-assistant-progress__mini-step task-assistant-progress__mini-step--${step.status}`}
              >
                <span className="task-assistant-progress__mini-dot" aria-hidden="true" />
                <span>{activity.label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

export function resolveActivityLabel(rawLabel: string): ActivityLabel {
  const label = rawLabel.trim() || "Processing";
  const lower = label.toLowerCase();

  if (/\b(tool|function|call|calling|execute|command|api)\b/.test(lower)) {
    return {
      kind: "tool",
      label: "Calling tool",
      hint: label
    };
  }

  if (/\b(search|web|browser|browse|retriev|lookup|google)\b/.test(lower)) {
    return {
      kind: "search",
      label: "Searching web",
      hint: label
    };
  }

  if (/\b(file|read|write|document|workspace|artifact)\b/.test(lower)) {
    return {
      kind: "file",
      label: "Reading workspace",
      hint: label
    };
  }

  if (/\b(message|respond|stream|output|final)\b/.test(lower)) {
    return {
      kind: "message",
      label: "Composing response",
      hint: label
    };
  }

  return {
    kind: "agent",
    label,
    hint: "OpenClaw runtime activity"
  };
}
