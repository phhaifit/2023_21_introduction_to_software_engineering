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
  onAddBranch: (stepId: string, targetStepId: string, condition: string) => void;
  onRemoveBranch: (stepId: string, targetStepId: string) => void;
};

export function WorkflowStepsTable({
  steps,
  agents,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddBranch,
  onRemoveBranch,
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
          No steps configured
        </div>
        <div style={{ marginTop: "8px", fontSize: "14px" }}>
          Add an Agent below to start building your flow.
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
                            ? "Agent does not exist"
                            : "Agent is disabled or deleted"
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
                        Config Error
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
                        Ready
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
                    {agent ? agent.role : "No role"}
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
                      title="Move up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      style={{ opacity: index === steps.length - 1 ? 0.3 : 1 }}
                      disabled={index === steps.length - 1}
                      onClick={() => onMoveDown(step.workflowStepId)}
                      title="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    className="icon-button danger"
                    style={{ width: "100%" }}
                    onClick={() => onRemove(step.workflowStepId)}
                    title="Delete this step"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Branches UI */}
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px dashed var(--line)" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Next Steps (Branches)</div>
                {step.nextSteps && step.nextSteps.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    {step.nextSteps.map(branch => {
                      const targetStep = steps.find(s => s.workflowStepId === branch.targetStepId);
                      const targetAgent = targetStep ? agents.find(a => a.agentId === targetStep.agentId) : null;
                      return (
                        <div key={branch.targetStepId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "6px", fontSize: "13px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ color: "var(--muted)" }}>↳ If</span>
                            <span style={{ fontWeight: 500, fontFamily: "monospace", background: "white", padding: "2px 6px", borderRadius: "4px" }}>
                              {branch.condition || 'always'}
                            </span>
                            <span style={{ color: "var(--muted)" }}>→ Go to Step {targetStep?.stepOrder}</span>
                            <span style={{ fontWeight: 600 }}>({targetAgent?.name || 'Unknown'})</span>
                          </div>
                          <button
                            onClick={() => onRemoveBranch(step.workflowStepId, branch.targetStepId)}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                            title="Remove branch"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "var(--muted)", fontStyle: "italic", marginBottom: "12px" }}>
                    No branches defined. Step will naturally progress or end here.
                  </div>
                )}
                
                {/* Add Branch Form (Inline) */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    id={`branch-target-${step.workflowStepId}`}
                    className="form-input"
                    style={{ flex: 1, padding: "6px 10px", fontSize: "13px", margin: 0, height: "32px" }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select target step...</option>
                    {steps.map(s => {
                      if (s.workflowStepId === step.workflowStepId) return null; // No self loops
                      const a = agents.find(ag => ag.agentId === s.agentId);
                      return <option key={s.workflowStepId} value={s.workflowStepId}>Step {s.stepOrder} ({a?.name || 'Unknown'})</option>
                    })}
                  </select>
                  <input
                    id={`branch-condition-${step.workflowStepId}`}
                    type="text"
                    className="form-input"
                    placeholder="Condition (e.g. status=='approved')"
                    style={{ flex: 1, padding: "6px 10px", fontSize: "13px", margin: 0, height: "32px" }}
                  />
                  <button
                    className="secondary-action"
                    style={{ padding: "6px 12px", height: "32px", fontSize: "13px", whiteSpace: "nowrap" }}
                    onClick={(e) => {
                      const targetSelect = document.getElementById(`branch-target-${step.workflowStepId}`) as HTMLSelectElement;
                      const condInput = document.getElementById(`branch-condition-${step.workflowStepId}`) as HTMLInputElement;
                      if (targetSelect.value) {
                        onAddBranch(step.workflowStepId, targetSelect.value, condInput.value);
                        targetSelect.value = "";
                        condInput.value = "";
                      }
                    }}
                  >
                    + Add Branch
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
