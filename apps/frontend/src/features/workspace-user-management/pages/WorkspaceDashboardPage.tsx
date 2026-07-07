import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { WorkspaceUserManagementAPI } from "../api";
import { useAuth } from "../../authentication/authentication-context.tsx";
import { ArrowLeft, Users, ShieldAlert, Activity, LayoutGrid, ArrowRight } from "lucide-react";
import "./WorkspaceDashboardPage.css";

const api = new WorkspaceUserManagementAPI("");

export const WorkspaceDashboardPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !workspaceId) return;

    setLoading(true);
    // Fetch all workspaces and match name to get friendly name
    api.listWorkspaces()
      .then(list => {
        const found = list.find(ws => ws.workspaceId === workspaceId);
        if (found) {
          setWorkspaceName(found.name);
          // If the user isn't a member of this workspace (checked from API listWorkspaces output)
          // they shouldn't access this dashboard.
          if (!found.isMember) {
            navigate("/workspaces");
          }
        } else {
          setError("Workspace not found");
        }
      })
      .catch(err => {
        setError(err.message || "Failed to load workspace details");
      })
      .finally(() => setLoading(false));
  }, [workspaceId, isAuthenticated, navigate]);

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
            You must be logged in to view workspace details.
            Please sign in or create an account to proceed.
          </p>
          <Link to="/authentication" className="btn-login-redirect">
            Sign In / Register
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "40px", color: "var(--danger)", textAlign: "center" }}>
        <h2>Error loading page</h2>
        <p>{error}</p>
        <div style={{ marginTop: "20px" }}>
          <Link to="/workspaces" className="back-link">
            <ArrowLeft size={14} /> Back to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-dashboard-page">
      <Link to="/workspaces" className="back-link">
        <ArrowLeft size={14} /> Back to Workspaces
      </Link>

      <div className="page-header">
        <div className="page-title-section">
          <h1>{workspaceName || workspaceId}</h1>
          <p className="page-subtitle">
            Workspace ID: <b>{workspaceId}</b>
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* User Management Panel */}
        <div className="dashboard-card">
          <div className="card-icon-container bg-blue">
            <Users size={24} />
          </div>
          <div className="card-content">
            <h3>Workspace User Management</h3>
            <p>
              Manage all team members and their roles. Invite new members, approve invitations, and keep your team aligned.
            </p>
            <Link to={`/workspace/${workspaceId}/members`} className="btn-action">
              <span>View list member</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Placeholder: Agents Panel */}
        <div className="dashboard-card opacity-80">
          <div className="card-icon-container bg-indigo">
            <LayoutGrid size={24} />
          </div>
          <div className="card-content">
            <h3>Workspace Resources & Tools</h3>
            <p>
              Configure agents, orchestrate task executions, and manage knowledge bases for this team workspace.
            </p>
            <div className="btn-action-placeholder">
              <span>Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceDashboardPage;
