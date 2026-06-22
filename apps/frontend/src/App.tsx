import { useState } from "react";
import { AgentManagementPage } from "./features/agent-management/agent-management-page.tsx";
import { SubscriptionPaymentPage } from "./features/subscription-payment/subscription-payment-page.tsx";
import { TaskOrchestrationPage } from "./features/task-orchestration/task-orchestration-page.tsx";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

export function App() {
  const [activeTab, setActiveTab] = useState<"agents" | "billing" | "tasks">("agents");

  return (
    <main className="app-shell">
      <header className="app-shell__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        <div>
          <span className="app-shell__workspace">Virtual Company Platform</span>
          <h1 style={{ fontSize: "1.75rem", color: "#0f172a", fontWeight: 800 }}>
            {activeTab === "agents"
              ? "Agent Management"
              : activeTab === "tasks" ? "Task & Orchestration" : "Đăng ký & Thanh toán"}
          </h1>
        </div>

        {/* Tab Navigation */}
        <nav aria-label="Application sections" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("agents")}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: "none",
              backgroundColor: activeTab === "agents" ? "#6366f1" : "transparent",
              color: activeTab === "agents" ? "#ffffff" : "#475569",
              transition: "all 0.2s ease"
            }}
          >
            Nhân viên ảo (Agents)
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: "none",
              backgroundColor: activeTab === "billing" ? "#6366f1" : "transparent",
              color: activeTab === "billing" ? "#ffffff" : "#475569",
              transition: "all 0.2s ease"
            }}
          >
            Thanh toán & Gói (Billing)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            aria-pressed={activeTab === "tasks"}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: "none",
              backgroundColor: activeTab === "tasks" ? "#6366f1" : "transparent",
              color: activeTab === "tasks" ? "#ffffff" : "#475569",
              transition: "all 0.2s ease"
            }}
          >
            Công việc (Tasks)
          </button>
        </nav>
      </header>

      {activeTab === "agents" ? (
        <AgentManagementPage workspaceId={DEMO_WORKSPACE_ID} />
      ) : activeTab === "tasks" ? (
        <TaskOrchestrationPage />
      ) : (
        <SubscriptionPaymentPage />
      )}
    </main>
  );
}
