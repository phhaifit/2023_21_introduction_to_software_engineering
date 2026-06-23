import React from "react";
import type { WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";

export type WorkflowStepsTableProps = {
  steps: WorkflowStepDto[];
  agents: AgentPublicSummary[];
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  onRemove: (stepId: string) => void;
};

export function WorkflowStepsTable({
  steps,
  agents,
  onMoveUp,
  onMoveDown,
  onRemove
}: WorkflowStepsTableProps) {
  if (steps.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)", fontSize: "14px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed var(--line)" }}>
        Chưa có bước nào được cấu hình.<br />
        (Tính năng kéo thả step sẽ được cập nhật)
      </div>
    );
  }

  return (
    <div className="table-container" style={{ margin: 0 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: "60px", textAlign: "center" }}>Bước</th>
            <th>Agent</th>
            <th>Vai trò</th>
            <th style={{ width: "120px" }}>Trạng thái</th>
            <th style={{ width: "100px", textAlign: "right" }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => {
            const agent = agents.find((a) => a.agentId === step.agentId);
            const isMissing = !agent;
            const isDisabled = agent?.status === "disabled";
            const isDeleted = agent?.status === "deleted";
            const hasWarning = isMissing || isDisabled || isDeleted;

            return (
              <tr key={step.workflowStepId} style={{ background: hasWarning ? "#fef2f2" : undefined }}>
                <td style={{ textAlign: "center", fontWeight: "bold" }}>
                  {step.stepOrder}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 500, color: hasWarning ? "#ef4444" : "var(--text)" }}>
                      {agent ? agent.name : "Unknown Agent"}
                    </span>
                    {hasWarning && (
                      <span
                        title={isMissing ? "Agent không tồn tại" : "Agent đã bị vô hiệu hóa hoặc xóa"}
                        style={{
                          display: "inline-block",
                          background: "#fee2e2",
                          color: "#ef4444",
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: "bold"
                        }}
                      >
                        Lỗi
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", fontFamily: "monospace" }}>
                    ID: {step.agentId}
                  </div>
                </td>
                <td>
                  <span style={{ color: "var(--muted)", fontSize: "13px" }}>
                    {agent ? agent.role : "---"}
                  </span>
                </td>
                <td>
                  {!agent ? (
                    <span className="status-badge" style={{ background: "#f1f5f9", color: "#64748b" }}>Missing</span>
                  ) : agent.status === "enabled" ? (
                    <span className="status-badge status-active">Hoạt động</span>
                  ) : (
                    <span className="status-badge status-inactive">Bị khóa</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                    <button
                      className="secondary-action"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      disabled={index === 0}
                      onClick={() => onMoveUp(step.workflowStepId)}
                      title="Move Up"
                    >
                      ↑
                    </button>
                    <button
                      className="secondary-action"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      disabled={index === steps.length - 1}
                      onClick={() => onMoveDown(step.workflowStepId)}
                      title="Move Down"
                    >
                      ↓
                    </button>
                    <button
                      className="secondary-action"
                      style={{ padding: "4px 8px", fontSize: "12px", color: "#ef4444", borderColor: "#fca5a5" }}
                      onClick={() => onRemove(step.workflowStepId)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
