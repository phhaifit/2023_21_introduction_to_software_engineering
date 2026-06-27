import { useState, useEffect, useMemo } from "react";
import { createWorkflowManagementApiClient, type WorkflowManagementApiClient, type WorkflowPublicSummary } from "./api/workflow-api-client.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { LayoutDashboard, Activity, Layers, PenTool, TrendingUp, Calendar } from "lucide-react";

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
  const totalSteps = workflows.reduce((sum, w) => sum + (w.stepCount ?? 0), 0);
  
  const activePercentage = workflows.length > 0 ? Math.round((activeCount / workflows.length) * 100) : 0;
  const draftPercentage = workflows.length > 0 ? Math.round((draftCount / workflows.length) * 100) : 0;

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
        <div className="skeleton" style={{ height: '120px', marginBottom: '24px', borderRadius: '12px' }}></div>
        <div className="skeleton" style={{ height: '300px', borderRadius: '12px' }}></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        
        {/* Total Workflows */}
        <div className="elevated-card" style={{ padding: '24px', borderTop: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px', fontWeight: 700 }}>Total Workflows</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#1e293b', lineHeight: 1 }}>{workflows.length}</div>
            </div>
            <div style={{ background: '#e0e7ff', padding: '12px', borderRadius: '12px', color: '#4f46e5' }}>
              <LayoutDashboard size={24} strokeWidth={2} />
            </div>
          </div>
          {workflows.length > 0 && (
            <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} color="#10b981" />
              <span>Ready for automation</span>
            </div>
          )}
        </div>

        {/* Active Workflows */}
        <div className="elevated-card" style={{ padding: '24px', borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px', fontWeight: 700 }}>Active</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981', lineHeight: 1 }}>{activeCount}</div>
            </div>
            <div style={{ background: '#dcfce7', padding: '12px', borderRadius: '12px', color: '#059669' }}>
              <Activity size={24} strokeWidth={2} />
            </div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${activePercentage}%`, background: '#10b981' }}></div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>
            {activePercentage}% of total
          </div>
        </div>

        {/* Draft Workflows */}
        <div className="elevated-card" style={{ padding: '24px', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px', fontWeight: 700 }}>Drafts</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#f59e0b', lineHeight: 1 }}>{draftCount}</div>
            </div>
            <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '12px', color: '#d97706' }}>
              <PenTool size={24} strokeWidth={2} />
            </div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${draftPercentage}%`, background: '#f59e0b' }}></div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>
            {draftPercentage}% of total
          </div>
        </div>

        {/* Total Steps */}
        <div className="elevated-card" style={{ padding: '24px', borderTop: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px', fontWeight: 700 }}>Total Steps</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#8b5cf6', lineHeight: 1 }}>{totalSteps}</div>
            </div>
            <div style={{ background: '#ede9fe', padding: '12px', borderRadius: '12px', color: '#7c3aed' }}>
              <Layers size={24} strokeWidth={2} />
            </div>
          </div>
          <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--muted)' }}>
            Average {workflows.length ? Math.round(totalSteps / workflows.length) : 0} steps / workflow
          </div>
        </div>

      </div>

      {/* Recent Updates Table */}
      <div className="elevated-card" style={{ padding: '0', background: '#ffffff' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '8px', color: '#475569' }}>
            <Calendar size={18} />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Recent Updates</h3>
        </div>
        
        {workflows.length === 0 ? (
          <div style={{ padding: '64px 32px', textAlign: 'center', color: 'var(--muted)' }}>
            <Layers size={48} strokeWidth={1} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: 500 }}>No workflows created yet</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Switch to the "List" tab to create a new one</div>
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: '0' }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: 'transparent' }}>
                  <th style={{ padding: '16px 24px', color: '#64748b', fontSize: '12px' }}>Workflow Name</th>
                  <th style={{ padding: '16px 24px', color: '#64748b', fontSize: '12px' }}>Status</th>
                  <th style={{ padding: '16px 24px', color: '#64748b', fontSize: '12px', textAlign: 'right' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {workflows.slice(0, 5).map(w => (
                  <tr key={w.workflowId} style={{ transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '16px 24px', fontWeight: 600, color: '#1e293b' }}>{w.name}</td>
                    <td style={{ padding: '16px 24px' }}><StatusBadge status={w.status} /></td>
                    <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '13px', textAlign: 'right' }}>{new Date(w.updatedAt).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
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
