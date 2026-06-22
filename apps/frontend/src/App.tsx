import { useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";
import { KnowledgeBaseRagPage } from "./features/knowledge-base-rag/knowledge-base-rag-page.tsx";

type ActiveModule = "agent-management" | "knowledge-base-rag";

export function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>("agent-management");
  const isAgentManagementActive = activeModule === "agent-management";

  return (
    <main className="app-shell">
      <div className="app-module-switch" aria-label="Module switcher">
        <button
          type="button"
          className={isAgentManagementActive ? "active" : ""}
          onClick={() => setActiveModule("agent-management")}
        >
          Agent Management
        </button>
        <button
          type="button"
          className={activeModule === "knowledge-base-rag" ? "active" : ""}
          onClick={() => setActiveModule("knowledge-base-rag")}
        >
          Knowledge Base / RAG
        </button>
      </div>

      <header className="app-shell__header">
        <span className="app-shell__workspace">Virtual Company Platform</span>
        <h1>{isAgentManagementActive ? "Agent Management" : "Knowledge Base / RAG Management"}</h1>
      </header>

      {isAgentManagementActive ? (
        <AgentManagementPage workspaceId={DEMO_WORKSPACE_ID} />
      ) : (
        <KnowledgeBaseRagPage />
      )}
    </main>
  );
}
