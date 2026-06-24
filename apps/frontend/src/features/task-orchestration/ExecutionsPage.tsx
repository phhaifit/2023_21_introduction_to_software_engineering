import { useState } from "react";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";
import { mockExecutions } from "../../data/executions.ts";

export function ExecutionsPage() {
  const [search, setSearch] = useState("");
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
                    <button className="text-action" onClick={() => {}}>Xem Log</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
