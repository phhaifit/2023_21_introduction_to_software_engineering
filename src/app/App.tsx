import { useState } from "react";
import { PageHeader } from "./components/PageHeader";
import { Sidebar } from "./components/Sidebar";
import { Agents } from "./pages/Agents";
import { Dashboard } from "./pages/Dashboard";
import { Executions } from "./pages/Executions";
import { Settings } from "./pages/Settings";
import { WorkflowEditor } from "./pages/WorkflowEditor";
import { Workflows } from "./pages/Workflows";
import "./styles.css";

export type PageKey = "dashboard" | "workflows" | "editor" | "executions" | "agents" | "settings";

const pageTitles: Record<PageKey, string> = {
  dashboard: "Dashboard",
  workflows: "Workflows",
  editor: "Workflow Editor",
  executions: "Executions",
  agents: "Agents",
  settings: "Settings",
};

const pages: Record<PageKey, JSX.Element> = {
  dashboard: <Dashboard />,
  workflows: <Workflows />,
  editor: <WorkflowEditor />,
  executions: <Executions />,
  agents: <Agents />,
  settings: <Settings />,
};

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        <PageHeader title={pageTitles[activePage]} onCreate={() => setActivePage("editor")} />
        {pages[activePage]}
      </main>
    </div>
  );
}
