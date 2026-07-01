import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bot, GitBranch, Wrench,
  AlertCircle, Loader2, ExternalLink, Trash2, X, Users
} from "lucide-react";
import type { WorkspaceDetailDto } from "@vcp/shared/contracts/workspace-management.ts";
import { StatCard } from "../../components/shared/StatCard.tsx";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { useToast } from "../../components/shared/Toast.tsx";
import { getWorkspaceDetail, deleteWorkspace } from "./workspace-management-api-client.ts";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function planLabel(plan: string): string {
  const map: Record<string, string> = { free: "Free", standard: "Standard", premium: "Premium" };
  return map[plan] ?? plan;
}

function planClass(plan: string): string {
  if (plan === "premium") return "badge running";
  if (plan === "standard") return "badge published";
  return "badge draft";
}

function LoadingSkeleton() {
  return (
    <div className="page-container">
      <div className="topbar">
        <div>
          <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 28, width: 240, borderRadius: 8 }} />
        </div>
      </div>
      <div className="stats-grid" style={{ marginTop: 24 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ height: 14, width: 80, borderRadius: 6, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 32, width: 48, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [workspace, setWorkspace] = useState<WorkspaceDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    getWorkspaceDetail(workspaceId)
      .then((data) => { if (!cancelled) setWorkspace(data); })
      .catch((err: unknown) => {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : "Không thể tải thông tin workspace.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [workspaceId]);

  async function handleDelete() {
    if (!workspaceId || !workspace) return;
    setDeleting(true);
    try {
      await deleteWorkspace(workspaceId);
      showSuccess(`Workspace "${workspace.name}" đang được xóa.`);
      navigate("/workspaces");
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Không thể xóa workspace. Vui lòng thử lại.");
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  if (fetchError || !workspace) {
    return (
      <div className="page-container">
        <button
          type="button"
          className="text-action"
          onClick={() => navigate("/workspaces")}
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 14 }}
        >
          <ArrowLeft size={15} />
          Danh sách Workspace
        </button>
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "16px 20px", borderRadius: 10,
            background: "var(--danger-soft)", color: "var(--danger)",
            border: "1px solid rgba(185,28,28,0.2)", fontSize: 14,
          }}
        >
          <AlertCircle size={18} />
          {fetchError ?? "Workspace không tồn tại hoặc bạn không có quyền truy cập."}
        </div>
      </div>
    );
  }

  const isDeletable = workspace.status === "running" || workspace.status === "failed" || workspace.status === "pending";
  const isPending   = workspace.status === "pending";
  const isFailed    = workspace.status === "failed";
  const isRunning   = workspace.status === "running";

  return (
    <div className="page-container">
      <PageHeader
        title={workspace.name}
        eyebrow="Workspaces"
        description={`ID: ${workspace.workspaceId}`}
      >
        <StatusBadge status={workspace.status} />
        <button
          type="button"
          className="secondary-action"
          onClick={() => navigate(`/workspaces/${workspace.workspaceId}/members`)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Users size={15} />
          View Member List
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => navigate("/workspaces")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={15} />
          Danh sách
        </button>
      </PageHeader>

      {/* Provisioning banner */}
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px", borderRadius: 10, marginBottom: 24,
            background: "var(--warning-soft)", color: "var(--warning)",
            border: "1px solid rgba(161,98,7,0.25)", fontSize: 14, fontWeight: 500,
          }}
        >
          <Loader2 size={18} style={{ animation: "spin 1.5s linear infinite", flexShrink: 0 }} />
          Workspace đang được khởi tạo bởi OpenClaw runtime. Trang này sẽ tự cập nhật khi hoàn tất…
        </div>
      )}

      {/* Failed banner */}
      {isFailed && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px", borderRadius: 10, marginBottom: 24,
            background: "var(--danger-soft)", color: "var(--danger)",
            border: "1px solid rgba(185,28,28,0.2)", fontSize: 14, fontWeight: 500,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          Khởi tạo môi trường thất bại. Bạn có thể xóa workspace này và tạo lại.
        </div>
      )}

      {/* Runtime URL panel */}
      {isRunning && workspace.runtimeUrl && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px", borderRadius: 10, marginBottom: 24,
            background: "var(--success-soft)", color: "var(--success)",
            border: "1px solid rgba(21,128,61,0.2)", fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 600 }}>Runtime URL:</span>
          <a
            href={workspace.runtimeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--success)", textDecoration: "underline",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {workspace.runtimeUrl}
            <ExternalLink size={13} />
          </a>
        </div>
      )}

      {/* Resource stats */}
      <div className="stats-grid">
        <StatCard
          title="Agents"
          value={workspace.agentCount}
          description="Đang hoạt động trong workspace"
          icon={<Bot size={20} color="var(--accent)" />}
        />
        <StatCard
          title="Workflows"
          value={workspace.workflowCount}
          description="Luồng tự động hóa"
          icon={<GitBranch size={20} color="var(--accent)" />}
        />
        <StatCard
          title="Kết nối công cụ"
          value={workspace.toolCount}
          description="Tool connections đang kết nối"
          icon={<Wrench size={20} color="var(--accent)" />}
        />
      </div>

      {/* Info + Actions grid */}
      <div className="content-grid">
        {/* Workspace info panel */}
        <article className="panel">
          <div className="panel-heading">
            <h2>Thông tin Workspace</h2>
          </div>
          <dl style={{ display: "flex", flexDirection: "column", gap: 16, margin: 0 }}>
            <InfoRow label="Gói dịch vụ">
              <span className={planClass(workspace.plan)} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px" }}>
                {planLabel(workspace.plan)}
              </span>
            </InfoRow>
            <InfoRow label="Trạng thái">
              <StatusBadge status={workspace.status} />
            </InfoRow>
            <InfoRow label="Ngày tạo">
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{formatDateTime(workspace.createdAt)}</span>
            </InfoRow>
            <InfoRow label="Cập nhật lần cuối">
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{formatDateTime(workspace.updatedAt)}</span>
            </InfoRow>
            <InfoRow label="Workspace ID">
              <code style={{
                fontSize: 12, fontFamily: "monospace", padding: "3px 8px",
                background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 6,
                color: "var(--muted)"
              }}>
                {workspace.workspaceId}
              </code>
            </InfoRow>
          </dl>
        </article>

        {/* Actions panel */}
        {isDeletable && (
          <article className="panel">
            <div className="panel-heading">
              <h2>Hành động</h2>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px" }}>
              Xóa workspace sẽ dừng OpenClaw runtime và xóa toàn bộ dữ liệu liên quan.
              Hành động này không thể hoàn tác.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: "var(--danger-soft)", color: "var(--danger)",
                border: "1px solid rgba(185,28,28,0.25)",
                cursor: "pointer", width: "100%", justifyContent: "center",
                transition: "opacity 0.15s",
              }}
            >
              <Trash2 size={16} />
              Xóa Workspace
            </button>
          </article>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div
          role="presentation"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteDialog(false); }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            style={{
              background: "var(--panel)", borderRadius: 14, padding: "28px 32px",
              maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "var(--danger-soft)", display: "grid", placeItems: "center",
                  color: "var(--danger)",
                }}
              >
                <Trash2 size={20} />
              </div>
              {!deleting && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(false)}
                  aria-label="Đóng"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--muted)", padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <h3 id="delete-dialog-title" style={{ margin: "12px 0 8px", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
              Xóa workspace "{workspace.name}"?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
              Hành động này sẽ dừng OpenClaw runtime và xóa vĩnh viễn toàn bộ dữ liệu
              workspace bao gồm agents, workflows và kết nối công cụ.
              <strong style={{ color: "var(--text)", display: "block", marginTop: 8 }}>
                Không thể hoàn tác.
              </strong>
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                    Đang xóa…
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Xóa vĩnh viễn
                  </>
                )}
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <dt style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>{label}</dt>
      <dd style={{ margin: 0, textAlign: "right" }}>{children}</dd>
    </div>
  );
}
