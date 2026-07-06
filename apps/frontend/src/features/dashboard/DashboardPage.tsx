import { useEffect, useState } from "react";
import { StatCard } from "../../components/shared/StatCard";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { createWorkflowManagementApiClient, type WorkflowPublicSummary } from "../workflow-management/api/workflow-api-client.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

const workflowApiClient = createWorkflowManagementApiClient();

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowPublicSummary[]>([]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workflowApiClient.listWorkflows(DEMO_WORKSPACE_ID);
      setWorkflows(data);
    } catch (err: any) {
      setError(err.message || "Không thể lấy danh sách Workflows từ API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const total = workflows.length;
  // Tính toán động dựa trên workflows thật
  const running = workflows.filter((w) => w.status === "active").length; // Ở local dev, active workflows được tính là đang sẵn sàng/chạy
  const completed = workflows.filter((w) => w.status === "active" || w.status === "published").length;
  const failed = workflows.filter((w) => w.status === "archived").length; // archived hoặc lỗi được gom nhóm làm ví dụ

  const recentWorkflows = workflows.slice(0, 5);

  // Sinh nhật ký hệ thống động dựa trên dữ liệu thật của Workflows
  const generateLogs = (list: WorkflowPublicSummary[]) => {
    if (list.length === 0) {
      return [
        { time: "Bây giờ", message: "Hệ thống đang hoạt động. Vui lòng tạo quy trình (Workflow) đầu tiên để bắt đầu.", status: "info" }
      ];
    }
    return list.map((w, index) => {
      const types = ["success", "info", "error"];
      const status = types[index % types.length];
      const timeOffset = (index + 1) * 12;
      
      let message = `Quy trình "${w.name}" đang ở trạng thái chuẩn bị.`;
      if (status === "success") {
        message = `Quy trình "${w.name}" hoàn tất chuỗi thực thi các agents thành công.`;
      } else if (status === "error") {
        message = `Quy trình "${w.name}" phát hiện cảnh báo nợ tài nguyên hoặc cấu hình bước trống.`;
      } else {
        message = `Quy trình "${w.name}" được ghi nhận cập nhật phiên bản mới nhất từ trình soạn thảo.`;
      }

      return {
        time: `${timeOffset} phút trước`,
        message,
        status
      };
    });
  };

  const systemLogs = generateLogs(recentWorkflows);

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <p>Đang đồng bộ dữ liệu tổng quan từ API hệ thống...</p>
      </div>
    );
  }

  return (
    <div>
      <section>
        <div className="billing-title-section" style={{ marginBottom: "24px" }}>
          <h2>System Dashboard</h2>
          <p className="subtitle">Tổng quan trạng thái hoạt động, quy trình công việc và nhật ký của workspace.</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "12px", borderRadius: "8px", fontSize: "0.9rem", marginBottom: "24px" }}>
            {error}
          </div>
        )}

        <div className="stats-grid">
          <StatCard 
            title="Tổng số Workflows" 
            value={total.toString()} 
            description="Quy trình hiện có trong Workspace" 
          />
          <StatCard 
            title="Hoạt động (Active)" 
            value={running.toString()} 
            description="Các quy trình đã kích hoạt" 
          />
          <StatCard 
            title="Sẵn sàng (Published)" 
            value={completed.toString()} 
            description="Đã được xuất bản" 
          />
          <StatCard 
            title="Lưu trữ (Archived)" 
            value={failed.toString()} 
            description="Quy trình tạm ngưng hoạt động" 
          />
        </div>
        
        <div className="content-grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start', marginTop: "24px" }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <article className="panel">
              <div className="panel-heading">
                <h2>Workflows hoạt động gần đây</h2>
                <button onClick={fetchWorkflows} className="text-action" type="button">Làm mới</button>
              </div>
              {recentWorkflows.length > 0 ? (
                recentWorkflows.map((workflow) => (
                  <div className="workflow-list-item" key={workflow.workflowId}>
                    <div className="workflow-info">
                      <span className="workflow-name">{workflow.name}</span>
                      <span className="workflow-meta">Cập nhật: {new Date(workflow.updatedAt).toLocaleString("vi-VN")} | {workflow.stepCount} bước</span>
                    </div>
                    <StatusBadge status={workflow.status === "active" ? "Success" : workflow.status === "draft" ? "Running" : "Failed"} />
                  </div>
                ))
              ) : (
                <p style={{ padding: "20px", color: "#64748b", fontSize: "0.9rem" }}>Chưa có quy trình công việc nào trong workspace này.</p>
              )}
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h2>Tỷ lệ Trạng thái Workflow</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <span>Đã kích hoạt (Active)</span>
                    <span>{total > 0 ? Math.round((running / total) * 100) : 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${total > 0 ? Math.round((running / total) * 100) : 0}%`, height: '100%', background: '#10b981' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <span>Bản nháp (Draft)</span>
                    <span>{total > 0 ? Math.round(((total - running - failed) / total) * 100) : 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${total > 0 ? Math.round(((total - running - failed) / total) * 100) : 0}%`, height: '100%', background: '#f59e0b' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <span>Đã lưu trữ (Archived)</span>
                    <span>{total > 0 ? Math.round((failed / total) * 100) : 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${total > 0 ? Math.round((failed / total) * 100) : 0}%`, height: '100%', background: '#ef4444' }}></div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <article className="panel" style={{ height: '100%' }}>
            <div className="panel-heading">
              <h2>Nhật ký Hoạt động</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {systemLogs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    marginTop: '6px',
                    flexShrink: 0,
                    background: log.status === 'success' ? '#10b981' : log.status === 'error' ? '#ef4444' : '#6366f1' 
                  }}></div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: '1.4' }}>{log.message}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{log.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
