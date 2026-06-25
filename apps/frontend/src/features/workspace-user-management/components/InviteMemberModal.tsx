import { useState } from "react";
import { inviteMember } from "../api/workspace-user-management.api.ts";

type Props = {
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function InviteMemberModal({ workspaceId, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await inviteMember(workspaceId, email, role);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div className="panel" style={modalContentStyle}>
        <div className="topbar" style={{ paddingBottom: "16px", marginBottom: "20px" }}>
          <h2>Mời thành viên mới</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="form-panel" style={{ margin: 0, maxWidth: "100%" }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Quyền hạn (Role)</label>
            <select
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {error && (
            <div style={{ color: "var(--danger)", padding: "10px", background: "var(--danger-soft)", borderRadius: "6px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "10px" }}>
            <button type="button" onClick={onClose} disabled={loading} className="secondary-action">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="primary-action">
              {loading ? "Đang gửi..." : "Gửi lời mời"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  width: "480px",
  maxWidth: "90%",
  padding: "24px",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
};
