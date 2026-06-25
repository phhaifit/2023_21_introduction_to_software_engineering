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
  onRemove,
}: WorkflowStepsTableProps) {
  if (steps.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "var(--muted)",
          fontSize: "14px",
          background: "var(--bg-subtle)",
          borderRadius: "8px",
          border: "2px dashed var(--line)",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>🚀</div>
        <div style={{ fontWeight: 500, color: "var(--text)" }}>
          Chưa có bước nào được cấu hình
        </div>
        <div style={{ marginTop: "4px" }}>
          Thêm một Agent bên dưới để bắt đầu xây dựng luồng của bạn.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        position: "relative",
        paddingLeft: "24px",
      }}
    >
      {/* Vertical line connecting steps */}
      <div
        style={{
          position: "absolute",
          left: "39px",
          top: "20px",
          bottom: "20px",
          width: "2px",
          background: "var(--line)",
          zIndex: 0,
        }}
      ></div>

      {steps.map((step, index) => {
        const agent = agents.find((a) => a.agentId === step.agentId);
        const isMissing = !agent;
        const isDisabled = agent?.status === "disabled";
        const isDeleted = agent?.status === "deleted";
        const hasWarning = isMissing || isDisabled || isDeleted;

        return (
          <div
            key={step.workflowStepId}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              position: "relative",
              zIndex: 1,
              animation: "fadeIn 0.3s ease",
            }}
          >
            {/* Step Number Badge */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: hasWarning ? "#fee2e2" : "var(--accent)",
                color: hasWarning ? "#ef4444" : "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "14px",
                flexShrink: 0,
                boxShadow: "0 0 0 4px var(--bg-surface)",
              }}
            >
              {step.stepOrder}
            </div>

            {/* Step Card */}
            <div
              className="panel"
              style={{
                flex: 1,
                padding: "16px",
                border: hasWarning
                  ? "1px solid #fca5a5"
                  : "1px solid var(--line)",
                background: hasWarning ? "#fff5f5" : "var(--bg-surface)",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                {/* Info */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "15px",
                        color: hasWarning ? "#ef4444" : "var(--text)",
                      }}
                    >
                      {agent ? agent.name : "Unknown Agent"}
                    </span>
                    {hasWarning && (
                      <span
                        title={
                          isMissing
                            ? "Agent không tồn tại"
                            : "Agent đã bị vô hiệu hóa hoặc xóa"
                        }
                        style={{
                          background: "#fee2e2",
                          color: "#ef4444",
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        Lỗi Cấu Hình
                      </span>
                    )}
                    {!hasWarning && agent?.status === "enabled" && (
                      <span
                        style={{
                          background: "#d1fae5",
                          color: "#059669",
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        Sẵn sàng
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                      marginBottom: "8px",
                    }}
                  >
                    {agent ? agent.role : "Không có vai trò"}
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      fontFamily: "monospace",
                      background: "var(--bg-subtle)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      display: "inline-block",
                    }}
                  >
                    ID: {step.agentId}
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      className="secondary-action"
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        opacity: index === 0 ? 0.3 : 1,
                      }}
                      disabled={index === 0}
                      onClick={() => onMoveUp(step.workflowStepId)}
                      title="Chuyển lên"
                    >
                      ↑
                    </button>
                    <button
                      className="secondary-action"
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        opacity: index === steps.length - 1 ? 0.3 : 1,
                      }}
                      disabled={index === steps.length - 1}
                      onClick={() => onMoveDown(step.workflowStepId)}
                      title="Chuyển xuống"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    className="secondary-action"
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      color: "#ef4444",
                      borderColor: "#fecaca",
                      background: "#fef2f2",
                    }}
                    onClick={() => onRemove(step.workflowStepId)}
                    title="Xóa bước này"
                  >
                    Xóa bỏ
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
