import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.tsx";
import { WorkflowsPage } from "./features/workflow-management/WorkflowsPage.tsx";
import { WorkflowEditorPage } from "./features/workflow-management/WorkflowEditorPage.tsx";
import { ExecutionsPage } from "./features/task-orchestration/ExecutionsPage.tsx";
import { SettingsPage } from "./features/workspace-management/SettingsPage.tsx";
import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";
import { SubscriptionPaymentPage } from "./features/subscription-payment/subscription-payment-page.tsx";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { PageKey } from "./types/navigation.ts";

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("workflows");

  const renderPage = () => {
    switch (activePage) {
      case "workflows":
        return <WorkflowsPage />;
      case "agents":
        return <AgentManagementPage workspaceId={DEMO_WORKSPACE_ID} />;
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
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
