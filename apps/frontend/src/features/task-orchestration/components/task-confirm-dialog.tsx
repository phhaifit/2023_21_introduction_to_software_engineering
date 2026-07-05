import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface TaskConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function TaskConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onDismiss
}: TaskConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  // Close when clicking the backdrop (outside the dialog content)
  function handleDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!clickedInside) {
      onDismiss();
    }
  }

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement, Event>) {
    event.preventDefault();
    onDismiss();
  }

  return (
    <dialog
      ref={dialogRef}
      className="task-confirm-dialog"
      onCancel={handleCancel}
      onClick={handleDialogClick}
      aria-modal="true"
      aria-labelledby="task-confirm-dialog-title"
      aria-describedby="task-confirm-dialog-description"
    >
      {/* Inner wrapper to absorb clicks inside the dialog box */}
      <div
        className="task-confirm-dialog__inner"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="task-confirm-dialog__header">
          <h2 id="task-confirm-dialog-title">{title}</h2>
          <button
            type="button"
            className="task-confirm-dialog__close-btn"
            onClick={onDismiss}
            aria-label="Close confirmation dialog"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
        <p id="task-confirm-dialog-description" className="task-confirm-dialog__description">
          {description}
        </p>
        <div className="task-confirm-dialog__actions">
          <button type="button" className="task-confirm-dialog__cancel-btn" onClick={onDismiss}>
            {cancelLabel}
          </button>
          <button type="button" className="task-confirm-dialog__confirm-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
