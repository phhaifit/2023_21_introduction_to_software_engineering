import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, RefreshCw, AlertCircle, ArrowRight, Lock } from "lucide-react";
import { StatCard } from "../../components/shared/StatCard.tsx";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { useToast } from "../../components/shared/Toast.tsx";
import type { WorkspaceSummaryDto } from "@vcp/shared/contracts/workspace-management.ts";
import { listWorkspaces } from "./workspace-management-api-client.ts";

function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function planClass(plan: string): string {
  if (plan === "premium") return "badge running";
  if (plan === "standard") return "badge published";
  return "badge draft";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(iso));
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} aria-hidden="true">
          {[180, 90, 110, 120, 60].map((w, j) => (
            <td key={j}>
              <div
                className="skeleton"
                style={{ height: 16, width: w, borderRadius: 6 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const { showError } = useToast();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkspaces();
      setWorkspaces(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tải danh sách workspace.";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const total    = workspaces.length;
  const running  = workspaces.filter((w) => w.status === "running").length;
  const pending  = workspaces.filter((w) => w.status === "pending").length;
  const failed   = workspaces.filter((w) => w.status === "failed").length;

  return (
    <div className="page-container">
      <PageHeader
        title="Workspaces"
        eyebrow="VCP Platform"
        description="Quản lý các môi trường ảo hóa công ty được vận hành bởi OpenClaw runtime."
        onCreate={() => navigate("/workspaces/new")}
      >
        <button
          type="button"
          className="secondary-action"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Làm mới danh sách"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          Làm mới
        </button>
      </PageHeader>

      <div className="stats-grid">
        <StatCard
          title="Tổng Workspace"
          value={total}
          description="Tất cả workspace đang quản lý"
          icon={<Building2 size={20} color="var(--accent)" />}
        />
        <StatCard
          title="Đang hoạt động"
          value={running}
          description="OpenClaw runtime sẵn sàng"
          icon={<span style={{ fontSize: 18 }}>🟢</span>}
        />
        <StatCard
          title="Đang khởi tạo"
          value={pending}
          description="Đang chờ provisioning"
          icon={<span style={{ fontSize: 18 }}>🟡</span>}
        />
        <StatCard
          title="Lỗi provisioning"
          value={failed}
          description="Cần xử lý hoặc xóa"
          icon={<span style={{ fontSize: 18 }}>🔴</span>}
        />
      </div>

      <article className="panel">
        <div className="panel-heading">
          <h2>Danh sách Workspace</h2>
          <button
            type="button"
            className="primary-action"
            onClick={() => navigate("/workspaces/new")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 14 }}
          >
            <Plus size={16} />
            Tạo mới
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 8, marginBottom: 16,
              background: "var(--danger-soft)", color: "var(--danger)",
              fontSize: 14, border: "1px solid rgba(185,28,28,0.2)"
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {!loading && !error && workspaces.length === 0 ? (
          <article className="empty-state">
            <Building2 size={40} color="var(--accent)" strokeWidth={1.5} />
            <span className="empty-label" style={{ marginTop: 16 }}>Chưa có workspace</span>
            <h2>Tạo workspace đầu tiên</h2>
            <p>
              Workspace là môi trường ảo hóa công ty, nơi bạn cấu hình agents,
              workflows và kết nối công cụ. Mỗi workspace được cung cấp bởi
              OpenClaw runtime riêng biệt.
            </p>
            <button
              type="button"
              className="primary-action"
              onClick={() => navigate("/workspaces/new")}
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={16} />
              Tạo Workspace
            </button>
          </article>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table" aria-label="Danh sách workspace">
              <thead>
                <tr>
                  <th>Tên Workspace</th>
                  <th>Gói dịch vụ</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th aria-label="Hành động" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : (
                  workspaces.map((ws) => (
                    <tr
                      key={ws.workspaceId}
                      style={{ cursor: ws.accessRestricted ? "not-allowed" : "pointer", opacity: ws.accessRestricted ? 0.72 : 1 }}
                      onClick={() => {
                        if (!ws.accessRestricted) {
                          navigate(`/workspaces/${ws.workspaceId}`);
                        }
                      }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                              background: "var(--accent-soft)", display: "grid",
                              placeItems: "center", color: "var(--accent)", fontWeight: 800
                            }}
                          >
                            {ws.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>
                              {ws.name}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {ws.workspaceId}
                            </div>
                            {ws.accessRestricted ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                                <Lock size={12} />
                                Restricted access
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={planClass(ws.plan)} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px" }}>
                          {planLabel(ws.plan)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={ws.status} />
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>
                        {formatDate(ws.createdAt)}
                      </td>
                      <td>
                        {ws.accessRestricted ? (
                          <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600 }}>
                            <Lock size={14} />
                            Restricted
                          </span>
                        ) : (
                          <span style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600 }}>
                            Xem <ArrowRight size={14} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
