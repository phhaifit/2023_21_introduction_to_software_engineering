import { useState } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { EmptyState } from "../../components/shared/EmptyState.tsx";
import { WorkflowDashboard } from "./WorkflowDashboard.tsx";
import { WorkflowEditorPage } from "./WorkflowEditorPage.tsx";
import { ExecutionsPage } from "../task-orchestration/ExecutionsPage.tsx";

type SubTab = "dashboard" | "list" | "editor" | "executions";

import { mockWorkflows } from "../../data/workflows.ts";
import { mockExecutions } from "../../data/executions.ts";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";
import { Play, Edit2, Trash2, Loader2, Workflow as WorkflowIcon, Download, Upload } from "lucide-react";

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
          `> Initializing Workflow: [${workflowName}]`,
          `> Total steps to run: ${data.totalSteps}`,
          `> Allocating resources... OK`,
        ]);
      } else if (data.type === "step_completed") {
        setLogs((prev) => [
          ...prev,
          `> [Completed] Step ${data.stepOrder} - Agent: ${data.agentId} finished processing.`,
        ]);
        setProgress((prev) => Math.min(prev + 30, 90));
      } else if (data.type === "workflow_completed") {
        setLogs((prev) => [
          ...prev,
          `> [Success] Workflow executed all steps successfully.`,
          `> Closing connection stream.`,
        ]);
        setProgress(100);
        es.close();
      }
    };

    es.onerror = () => {
      setLogs((prev) => [
        ...prev,
        `> [Error] Lost connection to server (Stream Error).`,
        `> Please check your Workflow configuration.`,
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
                <span className="typing-indicator"></span> Waiting for process...
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
              {progress === 100 ? "Done" : "Close Window"}
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
  onImportWorkflow
}: {
  onCreate: () => void;
  onEdit: (id: string) => void;
  onExecutionSuccess?: () => void;
  apiClient?: WorkflowManagementApiClient;
  onImportWorkflow?: (data: any) => void;
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
    
    // Update mock executions for local UI demonstration
    if (streamingWorkflowName) {
      mockExecutions.unshift({
        executionId: `exec_mock_${Date.now()}` as any,
        workspaceId: DEMO_WORKSPACE_ID as any,
        workflowId: "wf_run" as any,
        workflowName: streamingWorkflowName,
        status: "Success",
        triggeredBy: "user_1" as any,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    }

    setStreamingWorkflowName(null);
    if (onExecutionSuccess) {
      onExecutionSuccess();
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!window.confirm("Are you sure you want to delete this workflow?"))
      return;
    try {
      await apiClient.deleteWorkflow(
        DEMO_WORKSPACE_ID,
        workflowId as EntityId<"workflowId">,
      );
      alert("Deleted successfully!");
      loadWorkflows();
    } catch (err: any) {
      alert("Error deleting Workflow: " + (err.message || "Unknown error"));
    }
  };

  const handleExport = async (workflowId: string, workflowName: string) => {
    try {
      const data: any = await apiClient.getWorkflow(DEMO_WORKSPACE_ID, workflowId as EntityId<"workflowId">);
      const wf = data.workflow ? data.workflow : data;
      
      const exportPayload = {
        name: `${wf.name} (Imported)`,
        description: wf.description,
        triggerType: wf.triggerType,
        triggerConfig: wf.triggerConfig,
        steps: data.steps ? data.steps.map((s: any) => ({
          agentId: s.agentId,
          stepOrder: s.stepOrder
        })) : []
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-${workflowName.toLowerCase().replace(/\s+/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export workflow");
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (onImportWorkflow) {
          onImportWorkflow(parsed);
        }
      } catch (err: any) {
        console.error("Import error:", err);
        alert("Failed to parse the imported JSON file. Please ensure it's a valid workflow format.");
      }
    };
    reader.readAsText(file);
    // Reset the input value so the same file can be selected again if needed
    event.target.value = "";
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
          placeholder="Search workflows..."
          value={search}
          onChange={setSearch}
        />
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label className="secondary-action" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", margin: 0, padding: "8px 16px" }}>
            <Upload size={16} /> Import Workflow
            <input type="file" accept=".json" style={{ display: "none" }} onChange={handleFileImport} />
          </label>
          <button onClick={onCreate} className="primary-action">
            Create Workflow
          </button>
        </div>
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
                Workflow Name{" "}
                {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th>Status</th>
              <th>Configuration</th>
              <th>Steps</th>
              <th
                onClick={() => {
                  setSortField("updatedAt");
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                Last Updated{" "}
                {sortField === "updatedAt" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: "24px" }}>
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
                  colSpan={6}
                  style={{ padding: "64px 0", textAlign: "center" }}
                >
                  <EmptyState
                    icon={<WorkflowIcon size={48} strokeWidth={1} style={{ marginBottom: "16px", opacity: 0.5, color: "var(--accent)" }} />}
                    title="No Workflows Found"
                    description={
                      search
                        ? "No results match your search."
                        : "Create a new workflow to start automating tasks."
                    }
                    actionLabel={search ? "Clear filters" : "Create Workflow"}
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
                  <td>
                    <div style={{ fontWeight: 600 }}>{w.name}</div>
                    {w.description && (
                      <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px", fontWeight: 400 }}>
                        {w.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={w.status} />
                  </td>
                  <td>
                    {w.triggerType === "webhook" ? (
                      <div style={{ fontSize: "13px", color: "var(--text)" }}>Via Webhook (API)</div>
                    ) : w.triggerType === "schedule" ? (
                      <div style={{ fontSize: "13px", color: "var(--text)" }}>
                        {w.triggerConfig?.frequency === "weekly" ? `Weekly (Day ${w.triggerConfig.dayOfWeek || 2})` : 
                         w.triggerConfig?.frequency === "monthly" ? `Monthly (Day ${w.triggerConfig.dayOfMonth || 1})` : 
                         "Daily"}{" "}
                        at {w.triggerConfig?.time || "08:00"}
                      </div>
                    ) : (
                      <div style={{ fontSize: "13px", color: "var(--text)" }}>Manual</div>
                    )}
                  </td>
                  <td>{w.stepCount ?? 0} steps</td>
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
                        className={`icon-button ${w.status === "active" ? "success" : ""}`}
                        title={
                          w.status !== "active"
                            ? "Only Active workflows can be run"
                            : "Run Workflow"
                        }
                        onClick={() => handleRun(w.workflowId, w.name)}
                        disabled={
                          executingId === w.workflowId || w.status !== "active"
                        }
                      >
                        {executingId === w.workflowId
                          ? <Loader2 size={16} className="spin-animation" />
                          : <Play size={16} />}
                      </button>
                      <button
                        className="icon-button"
                        title="Export Workflow"
                        onClick={() => handleExport(w.workflowId, w.name)}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="icon-button"
                        title="Edit Workflow"
                        onClick={() => onEdit(w.workflowId)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        title="Delete Workflow"
                        onClick={() => handleDelete(w.workflowId)}
                      >
                        <Trash2 size={16} />
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
  const [importedData, setImportedData] = useState<any>(null);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <WorkflowDashboard apiClient={apiClient} />;
      case "list":
        return (
          <WorkflowsList
            onCreate={() => {
              setEditingId(null);
              setImportedData(null);
              setActiveTab("editor");
            }}
            onEdit={(id) => {
              setEditingId(id);
              setImportedData(null);
              setActiveTab("editor");
            }}
            onImportWorkflow={(data) => {
              setEditingId(null);
              setImportedData(data);
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
            importedData={importedData}
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
            List
          </button>
          {activeTab === "editor" && (
            <button
              className="tab-btn active"
            >
              {editingId ? "Edit Workflow" : "Create Workflow"}
            </button>
          )}
          <button
            onClick={() => setActiveTab("executions")}
            className={`tab-btn ${activeTab === "executions" ? "active" : ""}`}
          >
            Run History
          </button>
        </nav>
      </PageHeader>

      {renderContent()}
    </div>
  );
}
