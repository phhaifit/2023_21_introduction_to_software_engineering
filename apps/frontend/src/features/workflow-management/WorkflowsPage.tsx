import { useState } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { EmptyState } from "../../components/shared/EmptyState.tsx";
import { WorkflowDashboard } from "./WorkflowDashboard.tsx";
import { WorkflowEditorPage } from "./WorkflowEditorPage.tsx";
import { ExecutionsPage } from "../task-orchestration/ExecutionsPage.tsx";

type SubTab = "dashboard" | "list" | "editor" | "executions";

import { mockWorkflows } from "../../data/workflows.ts";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";

import { useEffect, useMemo } from "react";
import {
  createWorkflowManagementApiClient,
  type WorkflowManagementApiClient,
  type WorkflowPublicSummary,
} from "./api/workflow-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

function StreamingProgressModal({
  workflowName,
  onClose,
  eventSourceUrl,
}: {
  workflowName: string;
  onClose: () => void;
  eventSourceUrl: string;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const es = new EventSource(eventSourceUrl);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "workflow_started") {
        setLogs((prev) => [
          ...prev,
          `> Khởi tạo Workflow: [${workflowName}]`,
          `> Tổng số bước cần chạy: ${data.totalSteps}`,
          `> Đang cấp phát tài nguyên... OK`,
        ]);
      } else if (data.type === "step_completed") {
        setLogs((prev) => [
          ...prev,
          `> [Hoàn thành] Bước ${data.stepOrder} - Agent: ${data.agentId} đã xử lý xong.`,
        ]);
        setProgress((prev) => Math.min(prev + 30, 90));
      } else if (data.type === "workflow_completed") {
        setLogs((prev) => [
          ...prev,
          `> [Thành công] Workflow đã thực thi xong toàn bộ các bước.`,
          `> Đóng luồng kết nối.`,
        ]);
        setProgress(100);
        es.close();
      }
    };

    es.onerror = () => {
      setLogs((prev) => [
        ...prev,
        `> [Lỗi] Mất kết nối tới server (Stream Error).`,
        `> Vui lòng kiểm tra lại cấu hình Workflow.`,
      ]);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [eventSourceUrl, workflowName]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15,23,42,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100000,
        animation: "fadeIn 0.2s ease-out",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "12px",
          width: "700px",
          maxWidth: "95%",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            background: "#1e293b",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #334155",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#ef4444",
              }}
            ></div>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#f59e0b",
              }}
            ></div>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#10b981",
              }}
            ></div>
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "monospace",
            }}
          >
            Execution Terminal — {workflowName}
          </div>
        </div>

        {/* Terminal Body */}
        <div style={{ padding: "24px" }}>
          <div
            style={{
              marginBottom: "20px",
              background: "#1e293b",
              height: "6px",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                background: progress === 100 ? "#10b981" : "#3b82f6",
                height: "100%",
                transition: "width 0.4s ease, background-color 0.4s ease",
              }}
            />
          </div>

          <div
            style={{
              background: "#020617",
              color: "#10b981",
              padding: "20px",
              borderRadius: "8px",
              minHeight: "200px",
              maxHeight: "400px",
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "14px",
              lineHeight: "1.6",
              border: "1px solid #1e293b",
            }}
          >
            {logs.map((l, i) => (
              <div
                key={i}
                style={{
                  marginBottom: "8px",
                  opacity: 0,
                  animation: "fadeIn 0.3s forwards",
                }}
              >
                {l}
              </div>
            ))}
            {progress < 100 && (
              <div
                style={{
                  color: "#94a3b8",
                  marginTop: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span className="typing-indicator"></span> Đang đợi tiến
                trình...
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: progress === 100 ? "#10b981" : "#334155",
                color: "white",
                border: "none",
                padding: "10px 24px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                transition: "background 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background =
                  progress === 100 ? "#059669" : "#475569")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background =
                  progress === 100 ? "#10b981" : "#334155")
              }
            >
              {progress === 100 ? "Hoàn thành" : "Đóng cửa sổ"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function WorkflowsList({
  onCreate,
  onEdit,
  onExecutionSuccess,
  apiClient: providedApiClient,
}: {
  onCreate: () => void;
  onEdit: (id: string) => void;
  onExecutionSuccess?: () => void;
  apiClient?: WorkflowManagementApiClient;
}) {
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowPublicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [streamingWorkflowName, setStreamingWorkflowName] = useState<
    string | null
  >(null);
  const [sortField, setSortField] = useState<"name" | "updatedAt">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const apiClient = useMemo(
    () => providedApiClient ?? createWorkflowManagementApiClient(),
    [providedApiClient],
  );

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await apiClient.listWorkflows(DEMO_WORKSPACE_ID);
      setWorkflows(data);
      setError(null);
    } catch (err) {
      setError(
        "Failed to load workflows. Please check your backend connection.",
      );
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

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "name") {
      return sortOrder === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else {
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    }
  });

  const handleRun = async (workflowId: string, workflowName: string) => {
    setExecutingId(workflowId);
    setStreamingUrl(
      apiClient.getExecutionStreamUrl(
        DEMO_WORKSPACE_ID,
        workflowId as EntityId<"workflowId">,
      ),
    );
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
    if (!window.confirm("Bạn có chắc chắn muốn xóa workflow này không?"))
      return;
    try {
      await apiClient.deleteWorkflow(
        DEMO_WORKSPACE_ID,
        workflowId as EntityId<"workflowId">,
      );
      alert("Xóa thành công!");
      loadWorkflows();
    } catch (err: any) {
      alert("Lỗi khi xóa Workflow: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div
      className="panel"
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
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
        <div
          style={{
            padding: "16px",
            background: "var(--bg-red-subtle)",
            color: "var(--red)",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th
                onClick={() => {
                  setSortField("name");
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                Tên Workflow{" "}
                {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th>Trạng thái</th>
              <th>Số bước</th>
              <th
                onClick={() => {
                  setSortField("updatedAt");
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                Cập nhật lần cuối{" "}
                {sortField === "updatedAt" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "24px" }}>
                  <div
                    className="skeleton"
                    style={{
                      height: "32px",
                      marginBottom: "12px",
                      borderRadius: "6px",
                    }}
                  ></div>
                  <div
                    className="skeleton"
                    style={{
                      height: "32px",
                      marginBottom: "12px",
                      borderRadius: "6px",
                    }}
                  ></div>
                  <div
                    className="skeleton"
                    style={{ height: "32px", borderRadius: "6px" }}
                  ></div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: "64px 0", textAlign: "center" }}
                >
                  <EmptyState
                    title="Không tìm thấy Workflow"
                    description={
                      search
                        ? "Không có kết quả phù hợp với từ khóa của bạn."
                        : "Hãy tạo một workflow mới để bắt đầu tự động hóa công việc."
                    }
                    actionLabel={search ? "Xóa bộ lọc" : "Tạo Workflow"}
                    onAction={search ? () => setSearch("") : onCreate}
                  />
                </td>
              </tr>
            ) : (
              sorted.map((w) => (
                <tr
                  key={w.workflowId}
                  style={{ transition: "background-color 0.2s" }}
                >
                  <td style={{ fontWeight: 600 }}>{w.name}</td>
                  <td>
                    <StatusBadge status={w.status} />
                  </td>
                  <td>{w.stepCount ?? 0} bước</td>
                  <td>{new Date(w.updatedAt).toLocaleDateString("vi-VN")}</td>
                  <td style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="secondary-action"
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          background:
                            w.status === "active" ? "#10b981" : "transparent",
                          color: w.status === "active" ? "white" : "#9ca3af",
                          border:
                            w.status === "active"
                              ? "none"
                              : "1px solid var(--line)",
                          opacity: w.status === "active" ? 1 : 0.5,
                          cursor:
                            w.status === "active" ? "pointer" : "not-allowed",
                        }}
                        title={
                          w.status !== "active"
                            ? "Chỉ Workflow ở trạng thái Active mới có thể chạy"
                            : ""
                        }
                        onClick={() => handleRun(w.workflowId, w.name)}
                        disabled={
                          executingId === w.workflowId || w.status !== "active"
                        }
                      >
                        {executingId === w.workflowId
                          ? "⏳ Đang chạy..."
                          : "▶ Chạy"}
                      </button>
                      <button
                        className="secondary-action"
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                        onClick={() => onEdit(w.workflowId)}
                      >
                        Sửa
                      </button>
                      <button
                        className="secondary-action"
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          color: "#ef4444",
                          borderColor: "#fecaca",
                          background: "#fef2f2",
                        }}
                        onClick={() => handleDelete(w.workflowId)}
                      >
                        Xóa
                      </button>
                    </div>
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

export function WorkflowsPage({
  apiClient,
}: {
  apiClient?: WorkflowManagementApiClient;
}) {
  const [activeTab, setActiveTab] = useState<SubTab>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <WorkflowDashboard apiClient={apiClient} />;
      case "list":
        return (
          <WorkflowsList
            onCreate={() => {
              setEditingId(null);
              setActiveTab("editor");
            }}
            onEdit={(id) => {
              setEditingId(id);
              setActiveTab("editor");
            }}
            onExecutionSuccess={() => setActiveTab("executions")}
            apiClient={apiClient}
          />
        );
      case "editor":
        return (
          <WorkflowEditorPage
            apiClient={apiClient}
            workflowId={editingId}
            onExecutionSuccess={() => setActiveTab("executions")}
            onCancel={() => setActiveTab("list")}
          />
        );
      case "executions":
        return <ExecutionsPage />;
      default:
        return <WorkflowDashboard apiClient={apiClient} />;
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
