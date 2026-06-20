import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__workspace">Virtual Company Platform</span>
        <h1>Agent Management</h1>
      </header>
      <AgentManagementPage />
    </main>
  );
}
