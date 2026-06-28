import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { WorkspaceUserManagementAPI } from '../api';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../../authentication/authentication-context.tsx';
import { UserPlus, Shield, User, ArrowLeft, Bell, ShieldAlert, Trash2 } from 'lucide-react';
import type { WorkspaceMemberListResponse } from '@vcp/shared/contracts/index.ts';
import './WorkspaceListPage.css';

const api = new WorkspaceUserManagementAPI('');

export const WorkspaceListPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { isAuthenticated, currentUser } = useAuth();
  
  const [data, setData] = useState<WorkspaceMemberListResponse | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const bellRef = useRef<HTMLDivElement>(null);

  const currentUserMember = data?.members?.find(m => m.userId === currentUser?.userId);
  const isAdmin = data ? currentUserMember?.role === 'admin' : true;

  const handleRoleChange = async (userId: string, newRole: any) => {
    try {
      await api.updateRole(workspaceId!, userId, { role: newRole });
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || "Failed to update member role.");
      setRefreshTrigger(prev => prev + 1); // trigger reload to reset dropdown
    }
  };

  const handleRemoveMember = (targetId: string, nameOrEmail: string, isInvitation: boolean) => {
    setConfirmModal({
      isOpen: true,
      title: isInvitation ? 'Cancel Invitation' : 'Remove Member',
      message: isInvitation
        ? `Are you sure you want to revoke the pending invitation for ${nameOrEmail}?`
        : `Are you sure you want to remove ${nameOrEmail} from this workspace? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.removeMember(workspaceId!, targetId);
          setRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
          alert(err.message || "Failed to remove member.");
        }
      }
    });
  };

  useEffect(() => {
    if (!isAuthenticated || !workspaceId) return;

    setLoading(true);
    Promise.all([
      api.listMembers(workspaceId),
      api.listWorkspaceEvents(workspaceId)
    ])
      .then(([membersData, eventsData]) => {
        setData(membersData);
        setEvents(eventsData);
        setError('');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [workspaceId, refreshTrigger, isAuthenticated]);

  // Click outside to close notification bell dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInviteSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Auth Guard View
  if (!isAuthenticated) {
    return (
      <div className="auth-required-container">
        <div className="auth-required-card">
          <div className="auth-required-icon">
            <ShieldAlert size={48} />
          </div>
          <h2>Authentication Required</h2>
          <p>
            You must be logged in to view workspace members. 
            Please sign in or create an account to proceed.
          </p>
          <Link to="/authentication" className="btn-login-redirect">
            Sign In / Register
          </Link>
        </div>
      </div>
    );
  }

  if (loading && refreshTrigger === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading members...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '40px', color: 'var(--danger)', textAlign: 'center' }}>
        <h2>Error loading page</h2>
        <p>{error}</p>
        <div style={{ marginTop: '20px' }}>
          <Link to="/workspaces" className="back-link">
            <ArrowLeft size={14} /> Back to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  const pendingInvites = data?.invitations || [];

  return (
    <div className="workspace-members-page">
      <Link to={`/workspace/${workspaceId}`} className="back-link">
        <ArrowLeft size={14} /> Back to Workspace Dashboard
      </Link>

      <div className="page-header">
        <div className="page-title-section">
          <h1>Workspace Members</h1>
          <p className="page-subtitle">Manage your team members and roles inside <b>{workspaceId}</b></p>
        </div>
        
        <div className="header-actions">
          {/* Notification Bell for Pending Invitations */}
          {isAdmin && (
            <div className="bell-container" ref={bellRef}>
              <button 
                className="btn-bell" 
                onClick={() => setIsBellOpen(!isBellOpen)}
                aria-label="Pending Invitations"
                title="Pending Invitations"
              >
                <Bell size={20} />
                {pendingInvites.length > 0 && (
                  <span className="bell-badge">{pendingInvites.length}</span>
                )}
              </button>

              {isBellOpen && (
                <div className="bell-popover">
                  <div className="bell-popover-header">
                    Pending Invitations ({pendingInvites.length})
                  </div>
                  <div className="bell-popover-list">
                    {pendingInvites.length === 0 ? (
                      <div className="bell-popover-empty">
                        No pending invitations
                      </div>
                    ) : (
                      pendingInvites.map(inv => (
                        <div className="bell-popover-item" key={inv.invitationId}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="bell-popover-item-email">{inv.email}</div>
                            <div className="bell-popover-item-meta">
                              <span className="role-badge">{inv.role === 'admin' ? 'Host' : inv.role}</span>
                              <span>Invited: {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</span>
                            </div>
                          </div>
                          <button
                            className="btn-revoke-invite"
                            onClick={() => handleRemoveMember(inv.invitationId, inv.email, true)}
                            aria-label="Cancel invitation"
                            title="Cancel invitation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <button className="btn-invite" onClick={() => setIsModalOpen(true)}>
              <UserPlus size={16} />
              Invite Member
            </button>
          )}
        </div>
      </div>

      <div className="workspace-grid-layout">
        <div className="members-section">
          <h2 className="section-title">Active Members ({data?.members?.length || 0})</h2>
          <div className="members-table-container">
            <table className="members-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined At</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data?.members?.map(member => (
                  <tr key={member.memberId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '8px', borderRadius: '50%' }}>
                          <User size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{member.userId}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{member.email || 'No email associated'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="role-select"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value as any)}
                        >
                          <option value="admin">Host</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="role-badge">
                          <Shield size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          {member.role === 'admin' ? 'Host' : member.role}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-active">
                        {member.status === 'active' ? 'Joined' : member.status}
                      </span>
                    </td>
                    <td>{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A'}</td>
                    {isAdmin && (
                      <td>
                        <button
                          className="btn-delete-member"
                          onClick={() => handleRemoveMember(member.userId, member.userId, false)}
                          aria-label="Remove member"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {(!data?.members || data.members.length === 0) && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                      No active members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="activity-section">
          <h2 className="section-title">Workspace Activity Log</h2>
          <div className="activity-feed">
            {events.length === 0 ? (
              <div className="activity-empty">No activity logged yet.</div>
            ) : (
              events.slice().reverse().map(event => (
                <div className="activity-item" key={event.eventId}>
                  <div className="activity-dot"></div>
                  <div className="activity-content">
                    <div className="activity-desc">{event.description}</div>
                    <div className="activity-time">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {workspaceId && (
        <InviteMemberModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onInviteSuccess={handleInviteSuccess}
          workspaceId={workspaceId}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
export default WorkspaceListPage;
