import { useState, useEffect, useMemo } from "react";
import { createWorkflowManagementApiClient, type WorkflowManagementApiClient, type WorkflowPublicSummary } from "./api/workflow-api-client.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";

export function WorkflowDashboard({ apiClient: providedApiClient }: { apiClient?: WorkflowManagementApiClient }) {
  const [workflows, setWorkflows] = useState<WorkflowPublicSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const apiClient = useMemo(() => providedApiClient ?? createWorkflowManagementApiClient(), [providedApiClient]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await apiClient.listWorkflows(DEMO_WORKSPACE_ID);
        if (mounted) {
          setWorkflows(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [apiClient]);

  const activeCount = workflows.filter(w => w.status === "active").length;
  const draftCount = workflows.filter(w => w.status === "draft").length;
  const totalSteps = workflows.reduce((sum, w) => sum + w.stepCount, 0);

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
        <div className="skeleton" style={{ height: '100px', marginBottom: '16px', borderRadius: '8px' }}></div>
        <div className="skeleton" style={{ height: '300px', borderRadius: '8px' }}></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="panel" style={{ padding: '24px', textAlign: 'center', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>Tổng số Workflow</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text)' }}>{workflows.length}</div>
        </div>
        <div className="panel" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid #10b981', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>Đang hoạt động (Active)</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>{activeCount}</div>
        </div>
        <div className="panel" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid #f59e0b', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>Bản nháp (Draft)</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{draftCount}</div>
        </div>
        <div className="panel" style={{ padding: '24px', textAlign: 'center', borderTop: '4px solid var(--accent)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>Tổng số bước (Steps)</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)' }}>{totalSteps}</div>
        </div>
      </div>

      <div className="panel" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Cập nhật gần đây</h3>
        {workflows.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '32px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
            Chưa có workflow nào được tạo.
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên Workflow</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật lần cuối</th>
                </tr>
              </thead>
              <tbody>
                {workflows.slice(0, 5).map(w => (
                  <tr key={w.workflowId} style={{ transition: 'background-color 0.2s' }}>
                    <td style={{ fontWeight: 500 }}>{w.name}</td>
                    <td><StatusBadge status={w.status} /></td>
                    <td>{new Date(w.updatedAt).toLocaleDateString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
