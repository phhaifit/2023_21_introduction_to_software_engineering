import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../authentication/authentication-context.tsx";
import { WorkspaceUserManagementAPI } from "../api.ts";
import { Users, Plus, ShieldAlert } from "lucide-react";
import "./WorkspacesPage.css";

const api = new WorkspaceUserManagementAPI("");

export function WorkspacesPage() {
  const { isAuthenticated, currentUser } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
      loadInvitations();
    }
  }, [isAuthenticated]);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const list = await api.listWorkspaces();
      setWorkspaces(list);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load workspaces.");
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const list = await api.listPendingInvitationsForUser();
      setInvitations(list);
    } catch (err) {
      console.error("Failed to load invitations", err);
    }
  };

  const handleAcceptInvitation = async (code: string) => {
    try {
      setError(null);
      await api.acceptInvitation(code);
      await loadWorkspaces();
      await loadInvitations();
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation.");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) {
      setError("Workspace name cannot be empty.");
      return;
    }

    try {
      setError(null);
      await api.createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName("");
      setIsModalOpen(false);
      loadWorkspaces();
    } catch (err: any) {
      setError(err.message || "Failed to create workspace.");
    }
  };

  // Auth Guard view
  if (!isAuthenticated) {
    return (
      <div className="auth-required-container">
        <div className="auth-required-card">
          <div className="auth-required-icon">
            <ShieldAlert size={48} />
          </div>
          <h2>Authentication Required</h2>
          <p>
            You must be logged in to view or manage workspaces. 
            Please sign in or create an account to proceed.
          </p>
          <Link to="/authentication" className="btn-login-redirect">
            Sign In / Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workspaces-page">
      <div className="page-header">
        <div className="page-title-section">
          <h1>Select Your Workspace</h1>
          <p className="page-subtitle">
            Welcome back, <b>{currentUser?.displayName || currentUser?.email}</b>. Select or create a workspace.
          </p>
        </div>
        <button className="btn-invite" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Create Workspace
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {invitations.length > 0 && (
        <div className="invitations-container">
          <h2 className="invitations-title">Pending Invitations ({invitations.length})</h2>
          <div className="invitations-list">
            {invitations.map((inv) => (
              <div className="invitation-banner-card" key={inv.invitationId}>
                <div className="invitation-banner-info">
                  <div className="invitation-banner-text">
                    You have been invited to join workspace <b>{inv.workspaceName}</b> as a <b>{inv.role === 'admin' ? 'Host' : inv.role}</b>
                  </div>
                  <div className="invitation-banner-sub">
                    Invited by user <b>{inv.invitedByUserId}</b>
                  </div>
                </div>
                <button 
                  className="btn-accept-invite"
                  onClick={() => handleAcceptInvitation(inv.invitationId)}
                >
                  Accept & Enter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--muted)", margin: "32px 0" }}>Loading workspaces...</div>
      ) : (
        <div className="workspaces-grid">
          {workspaces.length === 0 ? (
            <div className="empty-state">
              <Users size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No workspaces exist yet. Create one to get started!</p>
            </div>
          ) : (
            workspaces.map((ws) => (
              <div className={`workspace-card ${!ws.isMember ? 'workspace-card--restricted' : ''}`} key={ws.workspaceId}>
                <div className="workspace-card-info">
                  <div className="workspace-card-header">
                    <h3>{ws.name}</h3>
                    {!ws.isMember && (
                      <span className="badge-not-member">Not a Member</span>
                    )}
                    {ws.isMember && (
                      <span className="badge-member">Member</span>
                    )}
                  </div>
                  <div className="workspace-card-meta">
                    ID: {ws.workspaceId}
                  </div>
                </div>
                {ws.isMember ? (
                  <Link to={`/workspace/${ws.workspaceId}`} className="btn-enter-workspace">
                    Enter Workspace
                  </Link>
                ) : (
                  <button
                    className="btn-enter-workspace btn-enter-workspace--disabled"
                    onClick={() => setError("🚫 You are not a member of this workspace. Please accept the invitation first to gain access.")}
                  >
                    Enter Workspace
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Workspace</h2>
            </div>
            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label htmlFor="ws-name">Workspace Name</label>
                <input
                  id="ws-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. My Awesome Team"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-invite">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
