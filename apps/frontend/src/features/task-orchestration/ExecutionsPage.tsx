import { useState } from "react";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";
import { mockExecutions } from "../../data/executions.ts";

export function ExecutionsPage() {
  const [search, setSearch] = useState("");
  const filtered = mockExecutions.filter(run =>
    run.workflowName.toLowerCase().includes(search.toLowerCase()) ||
    run.runId.toLowerCase().includes(search.toLowerCase())
  );

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
                <tr key={run.runId}>
                  <td style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{run.runId}</td>
                  <td style={{ fontWeight: 600 }}>{run.workflowName}</td>
                  <td><StatusBadge status={run.status} /></td>
                  <td>{run.duration}</td>
                  <td>{run.startedAt}</td>
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
