import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmationModal.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  isDanger?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
  isDanger = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="confirmation-modal-card">
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="confirmation-modal-header">
          <div className={`warning-icon-wrapper ${isDanger ? 'danger' : 'warning'}`}>
            <AlertTriangle size={24} />
          </div>
          <h3>{title}</h3>
        </div>

        <div className="confirmation-modal-body">
          <p>{message}</p>
        </div>

        <div className="confirmation-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className={`btn-confirm ${isDanger ? 'btn-danger-confirm' : 'btn-primary-confirm'}`} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
