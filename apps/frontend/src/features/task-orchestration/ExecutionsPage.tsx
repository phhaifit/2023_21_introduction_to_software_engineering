import { useState } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";
import { mockExecutions, type ExecutionUIModel } from "../../data/executions.ts";

function LogsModal({ execution, onClose }: { execution: ExecutionUIModel, onClose: () => void }) {
  const logs = [
    `[INFO] Starting execution ${execution.executionId} for workflow '${execution.workflowName}'`,
    `[INFO] Validating workflow definitions... OK`,
    `[INFO] Orchestration engine initialized.`,
    execution.status === "Failed" ? `[ERROR] Connection timeout to Agent Service.` : `[INFO] Step 1 executed successfully.`,
    execution.status === "Failed" ? `[ERROR] Execution aborted.` : `[INFO] Step 2 executed successfully.`,
    execution.status === "Success" ? `[INFO] Workflow completed successfully.` : execution.status === "Canceled" ? `[WARN] Workflow was canceled by user.` : `[INFO] Waiting for further instructions...`
  ];

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
      <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', width: '700px', maxWidth: '90%' }}>
        <h3 style={{ marginBottom: '8px' }}>Log chạy: {execution.workflowName}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>Run ID: {execution.executionId}</p>
        
        <div style={{ background: '#1e293b', color: '#e2e8f0', padding: '16px', borderRadius: '8px', minHeight: '200px', maxHeight: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px' }}>
          {logs.map((l, i) => (
            <div key={i} style={{ marginBottom: '6px', color: l.includes('[ERROR]') ? '#ef4444' : l.includes('[WARN]') ? '#f59e0b' : l.includes('[INFO]') ? '#10b981' : 'inherit' }}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button onClick={onClose} className="secondary-action">Đóng</button>
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
    if (!completedAt) return "Đang chạy...";
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
          placeholder="Tìm kiếm theo Tên hoặc Run ID..."
          value={search}
          onChange={setSearch}
        />
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Tên Workflow</th>
              <th>Trạng thái</th>
              <th>Thời gian chạy</th>
              <th>Bắt đầu lúc</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  Không tìm thấy lịch sử chạy nào.
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
                    <button className="text-action" onClick={() => setSelectedExecution(run)}>Xem Log</button>
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
