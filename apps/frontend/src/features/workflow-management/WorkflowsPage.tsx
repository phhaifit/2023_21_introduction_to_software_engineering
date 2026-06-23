import { useState } from "react";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { EmptyState } from "../../components/shared/EmptyState.tsx";
import { DashboardPage } from "../dashboard/DashboardPage.tsx";
import { WorkflowEditorPage } from "./WorkflowEditorPage.tsx";
import { ExecutionsPage } from "../task-orchestration/ExecutionsPage.tsx";

type SubTab = "dashboard" | "list" | "editor" | "executions";

import { mockWorkflows } from "../../data/workflows.ts";
import { StatusBadge } from "../../components/shared/StatusBadge.tsx";
import { SearchBar } from "../../components/shared/SearchBar.tsx";

function WorkflowsList({ onCreate }: { onCreate: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = mockWorkflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  Không tìm thấy workflow nào.
                </td>
              </tr>
            ) : (
              filtered.map(w => (
                <tr key={w.workflowId}>
                  <td style={{ fontWeight: 600 }}>{w.name}</td>
                  <td><StatusBadge status={w.lastExecutionStatus || w.status} /></td>
                  <td>{w.stepCount} bước</td>
                  <td>{w.updatedAt}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="text-action" onClick={() => {}}>Chi tiết</button>
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

export function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<SubTab>("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage />;
      case "list":
        return <WorkflowsList onCreate={() => setActiveTab("editor")} />;
      case "editor":
        return <WorkflowEditorPage />;
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
