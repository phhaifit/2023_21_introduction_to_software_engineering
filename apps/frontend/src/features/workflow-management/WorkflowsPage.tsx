import { useState } from "react";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { EmptyState } from "../../components/shared/EmptyState.tsx";
import { DashboardPage } from "../dashboard/DashboardPage.tsx";
import { WorkflowEditorPage } from "./WorkflowEditorPage.tsx";
import { ExecutionsPage } from "../task-orchestration/ExecutionsPage.tsx";

type SubTab = "dashboard" | "list" | "editor" | "executions";

function WorkflowsList({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState 
      title="Workflow list shell" 
      description="Search, summary cards, workflow table, and row actions will be implemented in the list sub-issue." 
    />
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
