import { useState } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";
import { mockExecutions, type ExecutionUIModel } from "../../data/executions.ts";
import { TerminalSquare, ListTodo, History } from "lucide-react";

function LogsModal({ execution, onClose }: { execution: ExecutionUIModel, onClose: () => void }) {
  const logs = [
    `> Initializing Workflow: [${execution.workflowName}]`,
    `> Run ID: ${execution.executionId}`,
    `> Allocating resources... OK`,
    execution.status === "Failed" ? `> [Error] Lost connection to server.` : `> [Completed] Step 1 - Agent finished processing.`,
    execution.status === "Failed" ? `> [Error] Workflow was canceled.` : `> [Completed] Step 2 - Agent finished processing.`,
    execution.status === "Success" ? `> [Success] Workflow executed all steps successfully.` : execution.status === "Canceled" ? `> [Warning] Workflow was canceled by user.` : `> [Running] Waiting for process...`,
    execution.status === "Success" ? `> Closing connection stream.` : ``
  ].filter(Boolean);

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
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div>
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
            Run Log: {execution.workflowName}
          </div>
        </div>

        {/* Terminal Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              background: "#020617",
              borderRadius: "8px",
              padding: "16px",
              fontFamily: "'Fira Code', monospace",
              fontSize: "13px",
              lineHeight: 1.6,
              color: "#38bdf8",
              height: "280px",
              overflowY: "auto",
              boxShadow: "inset 0 2px 4px 0 rgba(0,0,0,0.5)",
            }}
          >
            {logs.map((l, i) => (
              <div
                key={i}
                style={{
                  marginBottom: "8px",
                  color: l.includes("[Error]")
                    ? "#f87171"
                    : l.includes("[Success]") || l.includes("[Completed]")
                    ? "#4ade80"
                    : l.includes("[Warning]")
                    ? "#facc15"
                    : "#38bdf8",
                }}
              >
                {l}
              </div>
            ))}
          </div>

          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                background: "#334155",
                color: "white",
                border: "none",
                padding: "10px 24px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#475569")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#334155")}
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ExecutionsPage() {
  const [search, setSearch] = useState("");
  const [selectedExecution, setSelectedExecution] = useState<ExecutionUIModel | null>(null);

  const filtered = mockExecutions.filter(run =>
    run.workflowName.toLowerCase().includes(search.toLowerCase()) ||
    run.executionId.toLowerCase().includes(search.toLowerCase())
  );

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return "Running...";
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const diffInSeconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(diffInSeconds / 60);
    const seconds = diffInSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN", {
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <SearchBar
          placeholder="Search by Name or Run ID..."
          value={search}
          onChange={setSearch}
        />
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Workflow Name</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Started At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--muted)' }}>
                  <History size={48} strokeWidth={1} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--accent)' }} />
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>No run history found</div>
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>Try searching with a different keyword or come back later.</div>
                </td>
              </tr>
            ) : (
              filtered.map(run => (
                <tr key={run.executionId}>
                  <td style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{run.executionId}</td>
                  <td style={{ fontWeight: 600 }}>{run.workflowName}</td>
                  <td><StatusBadge status={run.status.toLowerCase() as any} /></td>
                  <td>{formatDuration(run.startedAt, run.completedAt)}</td>
                  <td>{formatDate(run.startedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="secondary-action" 
                      style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                      onClick={() => setSelectedExecution(run)}
                    >
                      <TerminalSquare size={14} /> View Log
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedExecution && (
        <LogsModal execution={selectedExecution} onClose={() => setSelectedExecution(null)} />
      )}
    </div>
  );
}
