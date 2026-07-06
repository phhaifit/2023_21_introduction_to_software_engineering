import type {
  ProcessingStep,
  ProcessingStepStatus
} from "../model/task-types";

import "./task-orchestration-components.css";

const STEP_STATUS_LABELS: Readonly<Record<ProcessingStepStatus, string>> = {
  waiting: "Waiting",
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

interface ProcessingTimelineProps {
  steps: readonly ProcessingStep[];
  ariaLabel?: string;
  emptyMessage?: string;
}

export function ProcessingTimeline({
  steps,
  ariaLabel = "Task processing timeline",
  emptyMessage = "No processing steps available."
}: ProcessingTimelineProps) {
  return (
    <section className="processing-timeline" aria-label={ariaLabel}>
      {steps.length === 0 ? (
        <p className="processing-timeline__empty">{emptyMessage}</p>
      ) : (
        <ol className="processing-timeline__list">
          {steps.map((step) => (
            <li
              className={`processing-timeline__item processing-timeline__item--${step.status}`}
              key={step.id}
              aria-current={step.status === "active" ? "step" : undefined}
            >
              <div className="processing-timeline__summary">
                <span className="processing-timeline__label">{step.label}</span>
                <span
                  className={`processing-timeline__status processing-timeline__status--${step.status}`}
                >
                  {STEP_STATUS_LABELS[step.status]}
                </span>
              </div>

              {step.startedAt || step.completedAt ? (
                <dl className="processing-timeline__timestamps">
                  {step.startedAt ? (
                    <div>
                      <dt>Started</dt>
                      <dd>{step.startedAt}</dd>
                    </div>
                  ) : null}
                  {step.completedAt ? (
                    <div>
                      <dt>Completed</dt>
                      <dd>{step.completedAt}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
