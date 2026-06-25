import { useState, useEffect } from "react";
import { fetchMembers, removeMember, revokeInvitation, updateRole, updateInvitationRole } from "../api/workspace-user-management.api.ts";
import { InviteMemberModal } from "./InviteMemberModal.tsx";

export function MembersPage({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<{ members: any[]; invitations: any[]; currentUserRole?: string; currentUserEmail?: string }>({ members: [], invitations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchMembers(workspaceId);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateRole(workspaceId, memberId, newRole);
      loadData();
      showSuccess("Thay đổi quyền thành công!");
    } catch (err: any) {
      alert(err.message);
      loadData(); // Revert the dropdown if API fails
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Bạn có chắc chắn muốn gỡ thành viên này?")) return;
    try {
      await removeMember(workspaceId, memberId);
      loadData();
      showSuccess("Gỡ bỏ thành viên thành công!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInvitationRoleChange = async (invitationId: string, newRole: string) => {
    try {
      await updateInvitationRole(workspaceId, invitationId, newRole);
      loadData();
      showSuccess("Cập nhật quyền lời mời thành công!");
    } catch (err: any) {
      alert(err.message);
      loadData();
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm("Bạn có chắc chắn muốn thu hồi lời mời này?")) return;
    try {
      await revokeInvitation(workspaceId, invitationId);
      loadData();
      showSuccess("Thu hồi lời mời thành công!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="page-container">Loading members...</div>;
  if (error) return <div className="page-container"><p style={{ color: "var(--danger)" }}>{error}</p></div>;

  const currentUserRole = data.currentUserRole || "viewer";
  const canInvite = currentUserRole === "admin_default" || currentUserRole === "admin";

  const canChangeRole = (targetRole: string, targetEmail: string) => {
    if (currentUserRole === "admin_default") return targetEmail !== "mapmobile123456@gmail.com"; // Master can change anyone except self
    if (currentUserRole === "admin") {
      if (targetEmail === "mapmobile123456@gmail.com" || targetRole === "admin") return false; // Admin cannot change Master or other Admins
      return true;
    }
    return false; // Editor/Viewer cannot change anything
  };

  const canRemove = (targetRole: string, targetEmail: string) => {
    if (currentUserRole === "admin_default") {
      if (targetEmail === "mapmobile123456@gmail.com") return false; // cannot remove self
      return true;
    }
    if (currentUserRole === "admin") {
      if (targetRole === "admin" || targetEmail === "mapmobile123456@gmail.com") return false;
      return true;
    }
    return false;
  };

  return (
    <div className="page-container">
      {successMessage && (
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          backgroundColor: "var(--panel, #ffffff)", border: "1px solid var(--success)",
          color: "var(--success)", padding: "20px 40px", borderRadius: "8px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)", zIndex: 9999,
          fontSize: "16px", fontWeight: 500, textAlign: "center",
        }}>
          ✅ {successMessage}
        </div>
      )}
      <header className="page-header" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Workspace: Tunha</h1>
          <p className="eyebrow">Quản lý không gian làm việc giả lập và các thành viên</p>
        </div>
        {canInvite && (
          <button onClick={() => setIsInviteModalOpen(true)} className="primary-action">
            Mời thành viên
          </button>
        )}
      </header>

      <section className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: "16px" }}>Thành viên đang hoạt động</h2>
        </div>
        <div className="data-table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID / Email</th>
                <th>Quyền hạn (Role)</th>
                <th>Ngày tham gia</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.memberId}>
                  <td className="primary-text" style={{ display: "flex", flexDirection: "column" }}>
                    <span>
                      {m.name || m.email}
                      {m.email === data.currentUserEmail && <span style={{ color: "var(--primary)", fontSize: "12px", marginLeft: "8px", fontWeight: 600 }}>(Bạn)</span>}
                    </span>
                    <span className="eyebrow" style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {m.email} {m.email === "mapmobile123456@gmail.com" && "(Master)"}
                    </span>
                  </td>
                  <td>
                    {canChangeRole(m.role, m.email) ? (
                      <select
                        className="form-input"
                        style={{ width: "auto", padding: "6px 10px" }}
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.memberId, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{m.role}</span>
                    )}
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>
                    {canRemove(m.role, m.email) && (
                      <button
                        onClick={() => handleRemoveMember(m.memberId)}
                        className="text-action"
                        style={{ color: "var(--danger)" }}
                      >
                        Gỡ bỏ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.members.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "30px" }} className="eyebrow">
                    Chưa có thành viên nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ padding: 0, marginTop: "24px" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: "16px" }}>Lời mời đang chờ (Pending)</h2>
        </div>
        <div className="data-table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Quyền hạn (Role)</th>
                <th>Ngày mời</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.invitations.map((inv) => (
                <tr key={inv.invitationId}>
                  <td>
                    <span className="eyebrow" style={{ padding: "4px 8px", backgroundColor: "var(--warning-soft)", color: "var(--warning)", borderRadius: "4px" }}>
                      Đang chờ
                    </span>
                    <div className="workflow-name">{inv.email}</div>
                  </td>
                  <td>
                    {canChangeRole(inv.role, inv.email) ? (
                      <select
                        className="form-input"
                        style={{ width: "auto", padding: "6px 10px" }}
                        value={inv.role}
                        onChange={(e) => handleInvitationRoleChange(inv.invitationId, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{inv.role}</span>
                    )}
                  </td>
                  <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>
                    {canRemove(inv.role, inv.email) && (
                      <button
                        onClick={() => handleRevokeInvite(inv.invitationId)}
                        className="text-action"
                        style={{ color: "var(--warning)" }}
                      >
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.invitations.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "30px" }} className="eyebrow">
                    Không có lời mời nào đang chờ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isInviteModalOpen && (
        <InviteMemberModal
          workspaceId={workspaceId}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => {
            setIsInviteModalOpen(false);
            showSuccess("Đã gửi lời mời thành công!");
            loadData();
          }}
        />
      )}
    </div>
  );
}
