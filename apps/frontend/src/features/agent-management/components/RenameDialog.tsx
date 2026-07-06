import React, { useState } from "react";
import { X, SquarePen } from "lucide-react";
import type { AgentRowViewModel } from "../agent-management-view.ts";

export interface RenameDialogProps {
  row: AgentRowViewModel;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
  error?: string | null;
}

export function RenameDialog({ row, disabled, onClose, onSubmit, error }: RenameDialogProps) {
  const [name, setName] = useState(row.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formTitleId = "rename-agent-title";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isSubmitting || !name.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="agent-modal-backdrop" role="presentation">
      <div className="agent-modal agent-modal--small" role="dialog" aria-modal="true" aria-labelledby={formTitleId}>
        <button
          type="button"
          className="agent-modal__close"
          aria-label="Close rename dialog"
          onClick={onClose}
          disabled={disabled || isSubmitting}
        >
          <X size={18} aria-hidden="true" />
        </button>
        
        <form className="agent-form" noValidate aria-busy={disabled || isSubmitting} onSubmit={handleSubmit}>
          <div className="agent-form__header">
            <span className="agent-form__icon" aria-hidden="true">
              <SquarePen size={18} />
            </span>
            <div>
              <h2 id={formTitleId}>Rename agent</h2>
              <p>Choose a new name for {row.name}.</p>
            </div>
          </div>
          
          {error && <p className="agent-form__error" role="alert">{error}</p>}
          
          <div className="agent-form-field">
            <label htmlFor="rename-input" className="agent-form-field__label">Name</label>
            <input
              id="rename-input"
              type="text"
              className="agent-form-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled || isSubmitting}
              autoFocus
              required
            />
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
              type="submit"
              className="agent-primary-button"
              disabled={disabled || isSubmitting || !name.trim() || name === row.name}
            >
              {(disabled || isSubmitting) ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
