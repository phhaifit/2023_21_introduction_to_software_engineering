import { useEffect, useRef, useState } from "react";
import type { TaskProcessingDetail } from "../model/task-processing-detail";
import { ProcessingTimeline } from "./processing-timeline";
import { TaskLogList } from "./task-log-list";
import { TaskStatusBadge } from "./task-status-badge";
import { TaskErrorDetails } from "./task-error-details";

export interface TaskProcessingDetailModalProps {
  detail: TaskProcessingDetail;
  onClose: () => void;
}

export function TaskProcessingDetailModal({ detail, onClose }: TaskProcessingDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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

        <section aria-labelledby="modal-timeline-title">
          <h3 id="modal-timeline-title" className="task-processing-detail-modal__section-title">Timeline</h3>
          <ProcessingTimeline steps={detail.steps} ariaLabel="Processing timeline details" />
        </section>

        <section aria-labelledby="modal-advanced-title" className="task-advanced-section">
          <button
            type="button"
            id="modal-advanced-title"
            className="task-advanced-section__toggle"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            aria-expanded={isAdvancedOpen}
          >
            {isAdvancedOpen ? "Hide Advanced details" : "Show Advanced details"}
          </button>

          <div className={`task-advanced-section__content${isAdvancedOpen ? " task-advanced-section__content--open" : ""}`}>
            <dl className="task-processing-detail-modal__meta" aria-label="Processing identifiers">
              <div>
                <dt>Work ID</dt>
                <dd>{detail.workId}</dd>
              </div>
              <div>
                <dt>Task ID</dt>
                <dd>{detail.taskId}</dd>
              </div>
              {detail.error ? (
                <div>
                  <dt>Internal error code</dt>
                  <dd>{detail.error.code}</dd>
                </div>
              ) : null}
            </dl>

            <section aria-labelledby="modal-logs-title">
              <h3 id="modal-logs-title" className="task-processing-detail-modal__section-title">Logs</h3>
              {detail.logs.length > 0 ? (
                <TaskLogList logs={detail.logs} ariaLabel="Processing log details" />
              ) : (
                <p>No orchestration logs available.</p>
              )}
            </section>
          </div>
        </section>
      </div>
    </dialog>
  );
}
