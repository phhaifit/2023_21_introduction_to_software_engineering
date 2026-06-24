import { useState } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { EmptyState } from "../../components/shared/EmptyState.tsx";
import { DashboardPage } from "../dashboard/DashboardPage.tsx";
import { WorkflowEditorPage } from "./WorkflowEditorPage.tsx";
import { ExecutionsPage } from "../task-orchestration/ExecutionsPage.tsx";

type SubTab = "dashboard" | "list" | "editor" | "executions";

import { mockWorkflows } from "../../data/workflows.ts";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";

import { useEffect, useMemo } from "react";
import { createWorkflowManagementApiClient, type WorkflowManagementApiClient, type WorkflowPublicSummary } from "./api/workflow-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

function StreamingProgressModal({ workflowName, onClose, eventSourceUrl }: { workflowName: string, onClose: () => void, eventSourceUrl: string }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const es = new EventSource(eventSourceUrl);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "workflow_started") {
        setLogs(prev => [...prev, `[Bắt đầu] Workflow có ${data.totalSteps} bước.`]);
      } else if (data.type === "step_completed") {
        setLogs(prev => [...prev, `[Hoàn thành] Bước ${data.stepOrder} (Agent: ${data.agentId}).`]);
        // Mock progress
        setProgress(prev => Math.min(prev + 30, 90)); 
      } else if (data.type === "workflow_completed") {
        setLogs(prev => [...prev, `[Kết thúc] Workflow đã chạy xong.`]);
        setProgress(100);
        es.close();
      }
    };

    es.onerror = () => {
      setLogs(prev => [...prev, `[Lỗi] Kết nối luồng bị gián đoạn. Workflow có thể chưa sẵn sàng hoặc rỗng.`]);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [eventSourceUrl]);

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
      <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', width: '600px', maxWidth: '90%' }}>
        <h3>Đang chạy: {workflowName}</h3>
        <div style={{ margin: '16px 0', background: 'var(--bg-subtle)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
           <div style={{ width: `${progress}%`, background: 'var(--primary)', height: '100%', transition: 'width 0.3s' }} />
        </div>
        <div style={{ background: '#1e293b', color: '#10b981', padding: '16px', borderRadius: '8px', minHeight: '150px', maxHeight: '300px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px' }}>
          {logs.map((l, i) => <div key={i} style={{ marginBottom: '4px' }}>{l}</div>)}
          {progress < 100 && <div style={{ color: '#94a3b8', fontStyle: 'italic', marginTop: '8px' }}>Đang đợi tiến trình...</div>}
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button onClick={onClose} className="secondary-action">Đóng</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WorkflowsList({ onCreate, onEdit, onExecutionSuccess, apiClient: providedApiClient }: { onCreate: () => void; onEdit: (id: string) => void; onExecutionSuccess?: () => void; apiClient?: WorkflowManagementApiClient }) {
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowPublicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [streamingWorkflowName, setStreamingWorkflowName] = useState<string | null>(null);

  const apiClient = useMemo(() => providedApiClient ?? createWorkflowManagementApiClient(), [providedApiClient]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await apiClient.listWorkflows(DEMO_WORKSPACE_ID);
      setWorkflows(data);
      setError(null);
    } catch (err) {
      setError("Failed to load workflows. Please check your backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      loadWorkflows();
    }
    return () => {
      mounted = false;
    };
  }, [apiClient]);

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRun = async (workflowId: string, workflowName: string) => {
    setExecutingId(workflowId);
    setStreamingUrl(apiClient.getExecutionStreamUrl(DEMO_WORKSPACE_ID, workflowId as EntityId<"workflowId">));
    setStreamingWorkflowName(workflowName);
  };

  const handleStreamingClose = () => {
    setExecutingId(null);
    setStreamingUrl(null);
    setStreamingWorkflowName(null);
    if (onExecutionSuccess) {
      onExecutionSuccess();
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa workflow này không?")) return;
    try {
      await apiClient.deleteWorkflow(DEMO_WORKSPACE_ID, workflowId as EntityId<"workflowId">);
      alert("Xóa thành công!");
      loadWorkflows();
    } catch (err: any) {
      alert("Lỗi khi xóa Workflow: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <SearchBar
          placeholder="Tìm kiếm workflow..."
          value={search}
          onChange={setSearch}
        />
        <button onClick={onCreate} className="primary-action">
          Tạo Workflow
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'var(--bg-red-subtle)', color: 'var(--red)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên Workflow</th>
              <th>Trạng thái</th>
              <th>Số bước</th>
              <th>Cập nhật lần cuối</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  Đang tải danh sách...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  Không tìm thấy workflow nào.
                </td>
              </tr>
            ) : (
              filtered.map(w => (
                <tr key={w.workflowId}>
                  <td style={{ fontWeight: 600 }}>{w.name}</td>
                  <td><StatusBadge status={w.status} /></td>
                  <td>{w.stepCount} bước</td>
                  <td>{new Date(w.updatedAt).toLocaleDateString("vi-VN")}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="text-action" 
                      style={{ marginRight: '8px', color: w.status === "active" ? '#10b981' : '#9ca3af', opacity: w.status === "active" ? 1 : 0.5, cursor: w.status === "active" ? 'pointer' : 'not-allowed' }}
                      title={w.status !== "active" ? "Chỉ Workflow ở trạng thái Active mới có thể chạy" : ""}
                      onClick={() => handleRun(w.workflowId, w.name)}
                      disabled={executingId === w.workflowId || w.status !== "active"}
                    >
                      {executingId === w.workflowId ? "Đang gửi..." : "▶ Chạy"}
                    </button>
                    <button className="text-action" style={{ marginRight: '8px' }} onClick={() => onEdit(w.workflowId)}>Chi tiết / Sửa</button>
                    <button className="text-action" style={{ color: '#ef4444' }} onClick={() => handleDelete(w.workflowId)}>Xóa</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {streamingUrl && streamingWorkflowName && (
        <StreamingProgressModal 
          workflowName={streamingWorkflowName} 
          eventSourceUrl={streamingUrl} 
          onClose={handleStreamingClose} 
        />
      )}
    </div>
  );
}

export function WorkflowsPage({ apiClient }: { apiClient?: WorkflowManagementApiClient }) {
  const [activeTab, setActiveTab] = useState<SubTab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage />;
      case "list":
        return <WorkflowsList onCreate={() => { setEditingId(null); setActiveTab("editor"); }} onEdit={(id) => { setEditingId(id); setActiveTab("editor"); }} onExecutionSuccess={() => setActiveTab("executions")} apiClient={apiClient} />;
      case "editor":
        return <WorkflowEditorPage apiClient={apiClient} workflowId={editingId} onExecutionSuccess={() => setActiveTab("executions")} onCancel={() => setActiveTab("list")} />;
      case "executions":
        return <ExecutionsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Workflows" eyebrow="Workflow Management">
        <nav className="tabs-nav">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          >
            Danh sách
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`tab-btn ${activeTab === "editor" ? "active" : ""}`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab("executions")}
            className={`tab-btn ${activeTab === "executions" ? "active" : ""}`}
          >
            Lịch sử chạy
          </button>
        </nav>
      </PageHeader>

      {renderContent()}
    </div>
  );
}
