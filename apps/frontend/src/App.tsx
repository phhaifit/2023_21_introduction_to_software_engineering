import { useState } from "react";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { Sidebar } from "./components/layout/Sidebar.tsx";
// Agent Management
import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";
import { KnowledgeBaseRagPage } from "./features/knowledge-base-rag/knowledge-base-rag-page.tsx";
import { SubscriptionPaymentPage } from "./features/subscription-payment/subscription-payment-page.tsx";
import { TaskOrchestrationPage } from "./features/task-orchestration/task-orchestration-page.tsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.tsx";
import { SettingsPage } from "./features/workspace-management/SettingsPage.tsx";
import { WorkflowEditorPage } from "./features/workflow-management/WorkflowEditorPage.tsx";
import { WorkflowsPage } from "./features/workflow-management/WorkflowsPage.tsx";
import type { PageKey } from "./types/navigation.ts";

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("workflows");

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage />;
      case "workflows":
        return <WorkflowsPage />;
      case "workflow-editor":
        return <WorkflowEditorPage />;
      case "executions":
        return <TaskOrchestrationPage />;
      case "agents":
        return (
          <section aria-label="Agent Management">
            <AgentManagementPage workspaceId={DEMO_WORKSPACE_ID} />
          </section>
        );
      case "knowledge-base-rag":
        return <KnowledgeBaseRagPage />;
      case "billing":
        return <SubscriptionPaymentPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <WorkflowsPage />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">{renderPage()}</main>
    </div>
  );
}
