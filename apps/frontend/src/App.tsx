import { Routes, Route, Navigate } from "react-router-dom";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { Sidebar } from "./components/layout/Sidebar.tsx";
// Agent Management
import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";
import { KnowledgeBaseRagPage } from "./features/knowledge-base-rag/knowledge-base-rag-page.tsx";
import { SubscriptionPaymentPage } from "./features/subscription-payment/subscription-payment-page.tsx";
import { TaskOrchestrationPage } from "./features/task-orchestration/task-orchestration-page.tsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.tsx";
import { SettingsPage } from "./features/workspace-management/SettingsPage.tsx";
import { WorkspaceListPage } from "./features/workspace-management/WorkspaceListPage.tsx";
import { WorkspaceCreatePage } from "./features/workspace-management/WorkspaceCreatePage.tsx";
import { WorkspaceDetailPage } from "./features/workspace-management/WorkspaceDetailPage.tsx";
import { WorkspaceMembersPage } from "./features/workspace-user-management/pages/WorkspaceMembersPage.tsx";
import { WorkflowEditorPage } from "./features/workflow-management/WorkflowEditorPage.tsx";
import { WorkflowsPage } from "./features/workflow-management/WorkflowsPage.tsx";
import { AuthenticationPage } from "./features/authentication/authentication-page.tsx";
import { AcceptInvitePage } from "./features/workspace-user-management/pages/AcceptInvitePage.tsx";

export function App() {

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
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
          <Route path="/workspaces" element={<WorkspaceListPage />} />
          <Route path="/workspaces/new" element={<WorkspaceCreatePage />} />
          <Route path="/workspaces/:workspaceId/members" element={<WorkspaceMembersPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/authentication" element={<AuthenticationPage />} />
          <Route path="/workspace/invitation/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

      </main>
    </div>
  );
}
