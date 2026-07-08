import React, { useState } from 'react';
import { WorkspaceUserManagementAPI } from '../api';
import { X } from 'lucide-react';
import type { WorkspaceRole } from '@vcp/shared/contracts/roles.ts';

const api = new WorkspaceUserManagementAPI('');

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: () => void;
  workspaceId: string;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onInviteSuccess,
  workspaceId,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const validateEmail = (emailStr: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await api.inviteMember(workspaceId, { email, role });
      onInviteSuccess();
      setEmail('');
      setRole('viewer');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invite Member</h2>
          <button className="btn-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email-input">Email Address</label>
            <input
              id="email-input"
              type="email"
              className="form-input"
              placeholder="e.g. member@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role-select">Workspace Role</label>
            <select
              id="role-select"
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              disabled={loading}
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor (Can edit resources)</option>
              <option value="admin">Host (Full access & settings)</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-invite" disabled={loading}>
              {loading ? 'Inviting...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
