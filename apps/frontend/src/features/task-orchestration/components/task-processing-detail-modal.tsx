import { useEffect, useRef, useState } from "react";
import type { TaskProcessingDetail } from "../model/task-processing-detail";
import type { TaskLog, TaskLogLevel } from "../model/task-types";
import { ProcessingTimeline } from "./processing-timeline";
import { TaskStatusBadge } from "./task-status-badge";

const LOG_LEVEL_LABELS: Readonly<Record<TaskLogLevel, string>> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error"
};

export interface TaskProcessingDetailModalProps {
  detail: TaskProcessingDetail;
  onClose: () => void;
}

export function TaskProcessingDetailModal({ detail, onClose }: TaskProcessingDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const hasLogs = detail.logs.length > 0;
  const hasTechnicalDetails = Boolean(detail.taskId || detail.workId || detail.startedAt || detail.error);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement, Event>) {
    event.preventDefault();
    onClose();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          event.preventDefault();
        }
      }
    }
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) {
      return "Unavailable";
    }
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <dialog
      ref={dialogRef}
      className="task-processing-detail-modal"
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      aria-labelledby="processing-detail-title"
    >
      <header className="task-processing-detail-modal__header">
        <h2 id="processing-detail-title">Processing details</h2>
        <button type="button" onClick={onClose} aria-label="Close processing details">
          Close
        </button>
      </header>
      <div className="task-processing-detail-modal__body">
        <div className="task-processing-detail-modal__primary-meta">
          <div>
            <span className="task-type-metadata-label">Status</span>
            <TaskStatusBadge status={detail.status} />
          </div>
          <div>
            <span className="task-type-metadata-label">Duration</span>
            <span>{formatDuration(detail.durationMs)}</span>
          </div>
        </div>
        
        <p className="task-processing-detail-modal__routing">
          {detail.routingSummary}
        </p>

        {detail.status === "failed" && detail.error ? (
          <section aria-labelledby="modal-error-title">
            <h3 id="modal-error-title" className="task-processing-detail-modal__section-title">Error Details</h3>
            <div className="task-processing-detail-modal__user-error">
              <h4>{detail.error.title}</h4>
              <p>{detail.error.message}</p>
              <p className="task-type-metadata-label">Failed step: {detail.error.stepId || "Unknown step"}</p>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="modal-timeline-title" className="task-processing-detail-modal__activity">
          <h3 id="modal-timeline-title" className="task-processing-detail-modal__section-title">Runtime activity</h3>
          <ProcessingTimeline
            steps={detail.steps}
            ariaLabel="Processing timeline details"
            emptyMessage="No runtime activity was captured for this turn."
          />
        </section>

        {hasTechnicalDetails || hasLogs ? (
          <section aria-labelledby="modal-advanced-title" className="task-advanced-section">
            <button
              type="button"
              id="modal-advanced-title"
              className="task-advanced-section__toggle"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              aria-expanded={isAdvancedOpen}
              aria-label={isAdvancedOpen ? "Hide Advanced details" : "Show Advanced details"}
            >
              {isAdvancedOpen ? "Hide Advanced details" : "Show Advanced details"}
              <span className="task-advanced-section__toggle-hint" aria-hidden="true">Technical</span>
            </button>

            <div
              className={`task-advanced-section__content${isAdvancedOpen ? " task-advanced-section__content--open" : ""}`}
              hidden={!isAdvancedOpen}
            >
              <dl className="task-processing-detail-modal__meta" aria-label="Processing identifiers">
                <div>
                  <dt>Task ID</dt>
                  <dd title={detail.taskId}>{formatCompactIdentifier(detail.taskId)}</dd>
                </div>
                <div>
                  <dt>Work ID</dt>
                  <dd title={detail.workId}>{formatCompactIdentifier(detail.workId)}</dd>
                </div>
                <div>
                  <dt>{detail.startedAt ? "Started" : "Created"}</dt>
                  <dd>{formatCompactTimestamp(detail.startedAt ?? detail.createdAt)}</dd>
                </div>
                {detail.error ? (
                  <div>
                    <dt>Error code</dt>
                    <dd>{detail.error.code}</dd>
                  </div>
                ) : null}
              </dl>

              {hasLogs ? (
                <section aria-labelledby="modal-logs-title">
                  <h3 id="modal-logs-title" className="task-processing-detail-modal__section-title">Runtime log</h3>
                  <p className="task-processing-detail-modal__helper">
                    Sanitized provider activity only. Raw payloads and credentials are excluded.
                  </p>
                  <SanitizedRuntimeLogList logs={detail.logs} ariaLabel="Processing log details" />
                </section>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </dialog>
  );
}

function SanitizedRuntimeLogList({
  logs,
  ariaLabel
}: {
  logs: readonly TaskLog[];
  ariaLabel: string;
}) {
  return (
    <section className="task-log-list" aria-label={ariaLabel}>
      <ul className="task-log-list__items" aria-label={ariaLabel}>
        {logs.map((log) => (
          <li
            className={`task-log-list__item task-log-list__item--${log.level}`}
            key={log.id}
          >
            <div className="task-log-list__header">
              <span className={`task-log-list__level task-log-list__level--${log.level}`}>
                {LOG_LEVEL_LABELS[log.level]}
              </span>
              <span className="task-log-list__timestamp">
                {formatCompactTimestamp(log.timestamp)}
              </span>
            </div>
            <p className="task-log-list__message">{log.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatCompactIdentifier(value: string): string {
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatCompactTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
