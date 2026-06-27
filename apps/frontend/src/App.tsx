import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { Sidebar } from "./components/layout/Sidebar.tsx";
// Agent Management
import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";
import { KnowledgeBaseRagPage } from "./features/knowledge-base-rag/knowledge-base-rag-page.tsx";
import { SubscriptionPaymentPage } from "./features/subscription-payment/subscription-payment-page.tsx";
import { TaskOrchestrationPage } from "./features/task-orchestration/task-orchestration-page.tsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.tsx";
import { SettingsPage } from "./features/workspace-management/SettingsPage.tsx";
import { WorkspaceDetailPage } from "./features/workspace-management/pages/workspace-detail-page.tsx";
import { WorkspaceListPage } from "./features/workspace-management/pages/workspace-list-page.tsx";
import { WorkflowEditorPage } from "./features/workflow-management/WorkflowEditorPage.tsx";
import { WorkflowsPage } from "./features/workflow-management/WorkflowsPage.tsx";
import { AuthenticationPage } from "./features/authentication/authentication-page.tsx";

export function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspaces" element={<WorkspaceListPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailRoute />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflow-editor" element={<WorkflowEditorPage />} />
          <Route path="/executions" element={<TaskOrchestrationPage />} />
          <Route path="/agents" element={
            <section aria-label="Agent Management">
              <AgentManagementPage workspaceId={DEMO_WORKSPACE_ID} />
            </section>
          } />
          <Route path="/knowledge-base-rag" element={<KnowledgeBaseRagPage />} />
          <Route path="/billing" element={<SubscriptionPaymentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/authentication" element={<AuthenticationPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function WorkspaceDetailRoute() {
  const params = useParams();
  const workspaceId = params.workspaceId;

  if (!workspaceId) {
    return <Navigate to="/workspaces" replace />;
  }

  return <WorkspaceDetailPage workspaceId={workspaceId} />;
}
