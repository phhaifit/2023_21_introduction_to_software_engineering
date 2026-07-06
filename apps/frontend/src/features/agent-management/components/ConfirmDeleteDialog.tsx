import React, { useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import type { AgentRowViewModel } from "../agent-management-view.ts";

export interface ConfirmDeleteDialogProps {
  row: AgentRowViewModel;
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({ row, disabled, onClose, onConfirm }: ConfirmDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleId = "delete-agent-title";

  const handleConfirm = async () => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="agent-modal-backdrop" role="presentation">
      <div className="agent-modal agent-modal--small" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button
          type="button"
          className="agent-modal__close"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={disabled || isSubmitting}
        >
          <X size={18} aria-hidden="true" />
        </button>
        
        <div className="agent-form">
          <div className="agent-form__header agent-form__header--danger">
            <span className="agent-form__icon agent-form__icon--danger" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h2 id={titleId}>Delete agent</h2>
              <p>Are you sure you want to delete {row.name}?</p>
            </div>
          </div>
          
          <div className="agent-dialog-content">
            <p className="agent-dialog-warning">
              This action cannot be undone. Deleting an agent removes it from
              the setup workspace and prevents future selection in Agent
              Management.
            </p>
          </div>
          
          <div className="agent-form-actions">
            <button
              type="button"
              className="agent-secondary-button"
              onClick={onClose}
              disabled={disabled || isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="agent-primary-button agent-primary-button--danger"
              onClick={handleConfirm}
              disabled={disabled || isSubmitting}
            >
              <Trash2 size={16} aria-hidden="true" />
              {(disabled || isSubmitting) ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
