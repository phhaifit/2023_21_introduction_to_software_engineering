import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWorkspaces, createWorkspace } from "../api/workspace-user-management.api.ts";

export function WorkspaceListPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchWorkspaces();
      setWorkspaces(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName || newWorkspaceName.trim() === "") return;

    try {
      setLoading(true);
      const newWorkspace = await createWorkspace(newWorkspaceName);
      navigate(`/workspace/${newWorkspace.workspaceId}`);
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };

  if (loading) return <div className="page-container">Loading workspaces...</div>;
  if (error) return <div className="page-container"><p style={{color: "var(--danger)"}}>{error}</p></div>;

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Your Workspaces</h1>
          <p className="eyebrow">Danh sách các không gian làm việc của bạn</p>
        </div>
        {!isCreating && (
          <button onClick={() => setIsCreating(true)} className="primary-action">
            Tạo Workspace mới
          </button>
        )}
      </header>

      {isCreating && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <h2>Tạo Workspace mới</h2>
          <form onSubmit={handleCreateWorkspace} style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Tên Workspace..." 
              value={newWorkspaceName} 
              onChange={(e) => setNewWorkspaceName(e.target.value)} 
              autoFocus
            />
            <button type="submit" className="primary-action">Tạo mới</button>
            <button type="button" onClick={() => setIsCreating(false)} className="button-outline">Hủy</button>
          </form>
        </section>
      )}

      <section className="panel" style={{ padding: 0 }}>
        {workspaces.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
            <p>Bạn chưa tham gia Workspace nào.</p>
            <p>Hãy tạo một Workspace mới để bắt đầu!</p>
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên Workspace</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((w) => (
                  <tr key={w.workspaceId}>
                    <td className="primary-text">{w.name}</td>
                    <td className="secondary-text">{new Date(w.createdAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <button 
                        onClick={() => navigate(`/workspace/${w.workspaceId}`)}
                        className="button-outline"
                        style={{ padding: "4px 12px", fontSize: "12px" }}
                      >
                        Vào quản lý
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
