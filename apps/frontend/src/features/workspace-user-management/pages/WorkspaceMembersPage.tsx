import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, ArrowLeft, Check, Clock, Crown, Search, Shield, Trash2, User, UserPlus, X } from "lucide-react";
import type {
  AdminRequestResponse,
  WorkspaceActivityResponse,
  WorkspaceMemberListResponse,
  WorkspaceMemberResponse,
  WorkspaceRole
} from "@vcp/shared/contracts/index.ts";
import { PageHeader } from "../../../components/layout/PageHeader.tsx";
import { useToast } from "../../../components/shared/Toast.tsx";
import { useAuth } from "../../authentication/authentication-context.tsx";
import { WorkspaceUserManagementAPI } from "../api.ts";
import { ConfirmationModal } from "../components/ConfirmationModal.tsx";
import "./WorkspaceMembersPage.css";

const api = new WorkspaceUserManagementAPI("");

const roleLabels: Record<WorkspaceRole, string> = {
  host: "Host",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer"
};

type MemberStatusFilter = "active";

const memberStatusLabels: Record<MemberStatusFilter, string> = {
  active: "Active"
};

export function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [data, setData] = useState<WorkspaceMemberListResponse | null>(null);
  const [activities, setActivities] = useState<WorkspaceActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilters, setRoleFilters] = useState<WorkspaceRole[]>([]);
  const [memberStatusFilters, setMemberStatusFilters] = useState<MemberStatusFilter[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("viewer");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedUserToTransfer, setSelectedUserToTransfer] = useState<WorkspaceMemberResponse | null>(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    onConfirm: () => {}
  });

  const currentRole = data?.currentUserRole;
  const permissions = data?.permissions;
  const canInvite = permissions?.canInvite ?? false;
  const inviteRoles: WorkspaceRole[] = currentRole === "host" ? ["admin", "editor", "viewer"] : ["editor", "viewer"];
  const adminRequests = data?.adminRequests ?? [];
  const currentAdminRequest = adminRequests.find((request) => request.requester === currentUser?.userId && request.status === "pending");
  const pendingAdminRequests = adminRequests.filter((request) => request.status === "pending");
  const canRequestAdmin = (currentRole === "editor" || currentRole === "viewer") && !currentAdminRequest;

  function refresh() {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      api.listMembers(workspaceId),
      api.listWorkspaceEvents(workspaceId)
    ])
      .then(([membersData, workspaceActivities]) => {
        setData(membersData);
        setActivities(workspaceActivities);
        setError("");
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load workspace members.";
        setError(message);
        showError(message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, [workspaceId]);

  const filteredMembers = useMemo(() => {
    return filterMembers(data?.members ?? [], roleFilters, memberStatusFilters, query);
  }, [data?.members, roleFilters, memberStatusFilters, query]);

  const hasActiveFilters = roleFilters.length > 0 ||
    memberStatusFilters.length > 0 ||
    query.trim().length > 0;

  function canChangeMemberRole(member: WorkspaceMemberResponse): boolean {
    if (!permissions?.canChangeMemberRoles) return false;
    if (currentRole === "host") return member.role !== "host";
    if (currentRole === "admin") return member.role === "editor" || member.role === "viewer";
    return false;
  }

  function roleOptionsForMember(member: WorkspaceMemberResponse): WorkspaceRole[] {
    if (currentRole === "host" && member.role !== "host") return ["admin", "editor", "viewer"];
    if (currentRole === "admin" && (member.role === "editor" || member.role === "viewer")) return ["editor", "viewer"];
    return [member.role];
  }

  function canRemoveMember(member: WorkspaceMemberResponse): boolean {
    if (!permissions?.canRemoveMembers) return false;
    if (member.userId === currentUser?.userId && member.role === "host") return false;
    if (currentRole === "host") return member.role !== "host";
    if (currentRole === "admin") return member.role === "editor" || member.role === "viewer";
    return false;
  }

  function canTransferHost(member: WorkspaceMemberResponse): boolean {
    return (permissions?.canTransferHost ?? false) && currentRole === "host" && member.role !== "host";
  }

  function openTransferHostModal(member: WorkspaceMemberResponse) {
    setSelectedUserToTransfer(member);
    setIsTransferModalOpen(true);
  }

  function closeTransferHostModal() {
    setIsTransferModalOpen(false);
    setSelectedUserToTransfer(null);
  }

  function toggleRoleFilter(role: WorkspaceRole) {
    setRoleFilters((current) => toggleValue(current, role));
  }

  function toggleMemberStatusFilter(status: MemberStatusFilter) {
    setMemberStatusFilters((current) => toggleValue(current, status));
  }

  function clearFilters() {
    setRoleFilters([]);
    setMemberStatusFilters([]);
    setQuery("");
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const email = inviteEmail.trim().toLowerCase();
    setInviteError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setInviteSubmitting(true);
    try {
      await api.inviteMember(workspaceId, { email, role: inviteRole });
      showSuccess("Invitation sent.");
      setInviteEmail("");
      setInviteRole("viewer");
      setIsInviteOpen(false);
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not send invitation.";
      setInviteError(message);
      showError(message);
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function changeRole(memberId: string, role: WorkspaceRole) {
    if (!workspaceId) return;
    try {
      await api.updateRole(workspaceId, memberId, { role });
      showSuccess("Member role updated.");
      refresh();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not update role.");
    }
  }

  async function requestAdminPermission() {
    if (!workspaceId) return;
    try {
      await api.requestAdminRole(workspaceId);
      showSuccess("Admin request submitted.");
      refresh();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not submit Admin request.");
    }
  }

  function confirmTransferHost() {
    if (!workspaceId || !selectedUserToTransfer) return;
    const member = selectedUserToTransfer;
    closeTransferHostModal();

    void api.transferHost(workspaceId, member.memberId)
      .then(() => {
        showSuccess("Host ownership transferred.");
        refresh();
      })
      .catch((err: unknown) => showError(err instanceof Error ? err.message : "Could not transfer Host."));
  }

  function confirmRemove(member: WorkspaceMemberResponse) {
    setConfirmModal({
      isOpen: true,
      title: "Remove Member",
      message: `Remove ${member.email || member.userId} from this workspace?`,
      confirmText: "Remove",
      onConfirm: () => {
        if (!workspaceId) return;
        void api.removeMember(workspaceId, member.memberId)
          .then(() => {
            showSuccess("Member removed.");
            refresh();
          })
          .catch((err: unknown) => showError(err instanceof Error ? err.message : "Could not remove member."));
      }
    });
  }

  async function approveAdminRequest(request: AdminRequestResponse) {
    if (!workspaceId) return;
    try {
      await api.approveAdminRequest(workspaceId, request.requestId);
      showSuccess("Admin request approved.");
      refresh();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not approve Admin request.");
    }
  }

  async function rejectAdminRequest(request: AdminRequestResponse) {
    if (!workspaceId) return;
    try {
      await api.rejectAdminRequest(workspaceId, request.requestId);
      showSuccess("Admin request rejected.");
      refresh();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not reject Admin request.");
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Workspace Members"
        eyebrow="Workspace User Management"
        description={workspaceId ? `Workspace ID: ${workspaceId}` : undefined}
      >
        <button
          type="button"
          className="secondary-action"
          onClick={() => navigate(`/workspaces/${workspaceId}`)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={15} />
          Workspace
        </button>
        {canInvite ? (
          <button
            type="button"
            className="primary-action"
            onClick={() => setIsInviteOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <UserPlus size={16} />
            Invite Member
          </button>
        ) : null}
        {canRequestAdmin ? (
          <button
            type="button"
            className="secondary-action"
            onClick={() => void requestAdminPermission()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Shield size={16} />
            Request Admin Permission
          </button>
        ) : null}
        {currentAdminRequest ? <span className="wum-pending-note">Admin request pending</span> : null}
      </PageHeader>

      {error ? <div className="wum-error" role="alert">{error}</div> : null}

      <section className="wum-filter-bar" aria-label="Member filters">
        <div className="wum-filter-topline">
          <div className="wum-searchbox">
            <Search size={16} />
            <input
              aria-label="Search members by name or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or email"
            />
          </div>
          {hasActiveFilters ? (
            <button type="button" className="wum-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <FilterGroup label="Role">
          {(Object.keys(roleLabels) as WorkspaceRole[]).map((role) => (
            <button
              key={role}
              type="button"
              className={`filter-chip ${roleFilters.includes(role) ? "filter-chip-active" : ""}`}
              onClick={() => toggleRoleFilter(role)}
            >
              {roleLabels[role]}
            </button>
          ))}
        </FilterGroup>
        <FilterGroup label="Member Status">
          {(Object.keys(memberStatusLabels) as MemberStatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              className={`filter-chip ${memberStatusFilters.includes(status) ? "filter-chip-active" : ""}`}
              onClick={() => toggleMemberStatusFilter(status)}
            >
              {memberStatusLabels[status]}
            </button>
          ))}
        </FilterGroup>
      </section>

      {canInvite && isInviteOpen ? (
        <div className="wum-modal-backdrop" onClick={() => !inviteSubmitting && setIsInviteOpen(false)}>
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-member-title"
            className="wum-invite-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <h2 id="invite-member-title">Invite Member</h2>
            </div>
            {inviteError ? <div className="wum-error" role="alert">{inviteError}</div> : null}
            <form className="wum-invite-form" onSubmit={(event) => void submitInvite(event)}>
              <label>
                Email
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="member@example.com"
                  disabled={inviteSubmitting}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
                  disabled={inviteSubmitting}
                >
                  {inviteRoles.map((role) => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
                </select>
              </label>
              <div className="wum-inline-actions">
                <button type="button" className="secondary-action" onClick={() => setIsInviteOpen(false)} disabled={inviteSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={inviteSubmitting}>
                  {inviteSubmitting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <h2>Member List</h2>
          <span className="wum-count">{filteredMembers.length} members</span>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table" aria-label="Workspace member list">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>Loading members...</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={5}>No members match your search.</td></tr>
              ) : filteredMembers.map((member) => (
                <tr key={member.memberId}>
                  <td>
                    <div className="wum-person">
                      <span className="wum-avatar"><User size={15} /></span>
                      <span>
                        <strong>{member.name || member.userId}</strong>
                        <small>{member.email || "No email associated"}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {canChangeMemberRole(member) ? (
                      <select
                        className="wum-select"
                        value={member.role}
                        onChange={(event) => void changeRole(member.memberId, event.target.value as WorkspaceRole)}
                      >
                        {roleOptionsForMember(member).map((role) => (
                          <option key={role} value={role}>{roleLabels[role]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`wum-role wum-role-${member.role}`}>
                        {member.role === "host" ? <Crown size={13} /> : <Shield size={13} />}
                        {roleLabels[member.role]}
                      </span>
                    )}
                  </td>
                  <td>{member.status}</td>
                  <td>{new Date(member.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="wum-actions">
                      {canTransferHost(member) ? (
                        <button type="button" className="secondary-action" onClick={() => openTransferHostModal(member)}>
                          Transfer Host
                        </button>
                      ) : null}
                      {canRemoveMember(member) ? (
                        <button
                          type="button"
                          className="wum-icon-danger"
                          onClick={() => confirmRemove(member)}
                          aria-label="Remove member"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Workspace Activity</h2>
          <span className="wum-count">{activities.length} events</span>
        </div>
        {currentRole === "host" && pendingAdminRequests.length > 0 ? (
          <div className="wum-admin-requests">
            {pendingAdminRequests.map((request) => (
              <div key={request.requestId} className="wum-admin-request">
                <span>
                  <strong>{request.requester}</strong>
                  <small> requested Admin permission</small>
                </span>
                <div className="wum-inline-actions">
                  <button type="button" className="secondary-action" onClick={() => void rejectAdminRequest(request)}>
                    <X size={14} /> Reject
                  </button>
                  <button type="button" className="primary-action" onClick={() => void approveAdminRequest(request)}>
                    <Check size={14} /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="wum-timeline" aria-label="Workspace Activity">
          {activities.length === 0 ? (
            <p className="wum-empty-activity">No activity yet.</p>
          ) : activities.map((activity) => (
            <article key={activity.eventId} className="wum-timeline-item">
              <span className={`wum-timeline-icon ${activityClass(activity.type)}`}>
                <Activity size={15} />
              </span>
              <div>
                <div className="wum-activity-main">
                  <strong>{formatActivityType(activity.type)}</strong>
                  <span>{activity.description}</span>
                </div>
                <div className="wum-activity-meta">
                  {activity.actor ? <span>Actor: {activity.actor}</span> : null}
                  {activity.target ? <span>Target: {activity.target}</span> : null}
                  <span><Clock size={12} /> {new Date(activity.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ConfirmationModal
        isOpen={isTransferModalOpen}
        title="Transfer Host"
        message={
          selectedUserToTransfer
            ? `Are you sure you want to transfer the host role to this user? ${selectedUserToTransfer.email || selectedUserToTransfer.userId} will become Host and you will become an Admin.`
            : "Are you sure you want to transfer the host role to this user?"
        }
        confirmText="Confirm"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={confirmTransferHost}
        onClose={closeTransferHostModal}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((current) => ({ ...current, isOpen: false }))}
      />
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="wum-filter-group">
      <span>{label}</span>
      <div className="wum-filter-chip-row">{children}</div>
    </div>
  );
}

function filterMembers(
  rows: WorkspaceMemberResponse[],
  roleFilters: WorkspaceRole[],
  memberStatusFilters: MemberStatusFilter[],
  query: string
): WorkspaceMemberResponse[] {
  if (memberStatusFilters.length > 0 && !memberStatusFilters.includes("active")) return [];
  return rows
    .filter((member) => roleFilters.length === 0 || roleFilters.includes(member.role))
    .filter((member) => textMatches(query, [member.name, member.email, member.userId]));
}

function textMatches(query: string, values: Array<string | undefined>): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalized));
}

function toggleValue<T>(values: T[], target: T): T[] {
  return values.includes(target)
    ? values.filter((value) => value !== target)
    : [...values, target];
}

function formatActivityType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function activityClass(type: string): string {
  if (type.includes("REMOVED") || type.includes("REJECTED") || type.includes("REVOKED")) return "wum-activity-danger";
  if (type.includes("REQUEST")) return "wum-activity-warning";
  if (type.includes("TRANSFER") || type.includes("ROLE")) return "wum-activity-info";
  return "wum-activity-success";
}
