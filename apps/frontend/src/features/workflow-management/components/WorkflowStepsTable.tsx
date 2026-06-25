import React from "react";
import type { WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import { GitMerge, Trash2, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2 } from "lucide-react";
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
          padding: "32px 20px",
          color: "var(--muted)",
          background: "var(--bg-subtle)",
          borderRadius: "16px",
          border: "2px dashed var(--line)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        <GitMerge size={48} strokeWidth={1} style={{ marginBottom: "16px", color: "var(--accent)", opacity: 0.5 }} />
        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "16px" }}>
          Chưa có bước nào được cấu hình
        </div>
        <div style={{ marginTop: "8px", fontSize: "14px" }}>
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
                      marginBottom: "6px",
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
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "#fee2e2",
                          color: "#ef4444",
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontWeight: "700",
                        }}
                      >
                        <AlertTriangle size={12} />
                        Lỗi Cấu Hình
                      </span>
                    )}
                    {!hasWarning && agent?.status === "enabled" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "#dcfce7",
                          color: "#16a34a",
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontWeight: "700",
                        }}
                      >
                        <CheckCircle2 size={12} />
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
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="icon-button"
                      style={{ opacity: index === 0 ? 0.3 : 1 }}
                      disabled={index === 0}
                      onClick={() => onMoveUp(step.workflowStepId)}
                      title="Chuyển lên"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      style={{ opacity: index === steps.length - 1 ? 0.3 : 1 }}
                      disabled={index === steps.length - 1}
                      onClick={() => onMoveDown(step.workflowStepId)}
                      title="Chuyển xuống"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    className="icon-button danger"
                    style={{ width: "100%" }}
                    onClick={() => onRemove(step.workflowStepId)}
                    title="Xóa bước này"
                  >
                    <Trash2 size={16} />
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
