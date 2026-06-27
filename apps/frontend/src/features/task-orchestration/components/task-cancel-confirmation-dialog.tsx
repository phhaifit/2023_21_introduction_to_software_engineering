import { useEffect, useRef, useState } from "react";
import type { CreatedTaskRecord } from "../model/task-types";
import { TaskStatusBadge } from "./task-status-badge";
import { toTaskPresentationStatus } from "../model/task-lifecycle";

export interface TaskCancelConfirmationDialogProps {
  task: CreatedTaskRecord;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function TaskCancelConfirmationDialog({
  task,
  onConfirm,
  onDismiss
}: TaskCancelConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.open = true;
      }
    }
  }, []);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement, Event>) {
    event.preventDefault();
    onDismiss();
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

  function handleConfirmClick() {
    setError(null);
    try {
      onConfirm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Cancellation failed due to a cleanup error. Please try again or continue processing."
      );
    }
  }

  const presentationStatus = toTaskPresentationStatus(task.status);
  const activeStep =
    task.status === "running"
      ? task.processingSnapshot.steps.find((s) => s.status === "active")
      : null;

  return (
    <dialog
      ref={dialogRef}
      className="task-cancel-confirmation-dialog"
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      aria-describedby="cancel-dialog-description"
    >
      <header className="task-cancel-confirmation-dialog__header">
        <h2 id="cancel-dialog-title">Cancel task?</h2>
        <button type="button" onClick={onDismiss} aria-label="Dismiss cancellation">
          Close
        </button>
      </header>
      <div className="task-cancel-confirmation-dialog__body">
        <p id="cancel-dialog-description" className="task-cancel-confirmation-dialog__warning">
          Are you sure you want to cancel this task? All future processing and streaming will be permanently stopped.
        </p>
        {error ? (
          <div className="task-cancel-confirmation-dialog__error" role="alert">
            {error}
          </div>
        ) : null}
        <dl className="task-cancel-confirmation-dialog__meta" aria-label="Task identifiers">
          <div>
            <dt>Work ID</dt>
            <dd>{task.workId}</dd>
          </div>
          {presentationStatus ? (
            <div>
              <dt>Status</dt>
              <dd>
                <TaskStatusBadge status={presentationStatus} />
              </dd>
            </div>
          ) : null}
          {activeStep ? (
            <div>
              <dt>Active Step</dt>
              <dd>{activeStep.label}</dd>
            </div>
          ) : null}
        </dl>
        <div className="task-cancel-confirmation-dialog__actions">
          <button
            type="button"
            className="task-cancel-confirmation-dialog__continue-btn"
            onClick={onDismiss}
          >
            Continue processing
          </button>
          <button
            type="button"
            className="task-cancel-confirmation-dialog__confirm-btn"
            onClick={handleConfirmClick}
          >
            Confirm cancellation
          </button>
        </div>
      </div>
    </dialog>
  );
}
