import { useState, useMemo, useEffect } from "react";
import { ConfirmButton } from "../../components/shared/ConfirmButton";
import { SectionCard } from "../../components/shared/SectionCard";
import { WorkflowStepsTable } from "./components/WorkflowStepsTable";
import type { WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import { createWorkflowManagementApiClient, type CreateWorkflowCommand, type WorkflowManagementApiClient } from "./api/workflow-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { mockExecutions } from "../../data/executions.ts";

const MOCK_AGENTS: AgentPublicSummary[] = [
  { agentId: "agent-research", workspaceId: DEMO_WORKSPACE_ID, name: "Research Agent", role: "Market researcher", model: "gpt-4.1-mini", status: "enabled" },
  { agentId: "agent-support", workspaceId: DEMO_WORKSPACE_ID, name: "Support Agent", role: "Customer support", model: "gpt-4.1-mini", status: "disabled" },
  { agentId: "agent-writer", workspaceId: DEMO_WORKSPACE_ID, name: "Writer Agent", role: "Content Writer", model: "gpt-3.5", status: "enabled" }
] as AgentPublicSummary[];

export function WorkflowEditorPage({ apiClient: providedApiClient, workflowId, importedData, onExecutionSuccess, onCancel }: { apiClient?: WorkflowManagementApiClient; workflowId?: string | null; importedData?: any; onExecutionSuccess?: () => void; onCancel?: () => void }) {
  const [formData, setFormData] = useState<{
    workflowId: string;
    workspaceId: string;
    name: string;
    description: string;
    status: string;
    triggerType: string;
    triggerConfig: Record<string, any>;
    steps: WorkflowStepDto[];
  }>({
    workflowId: "new-wf-123",
    workspaceId: DEMO_WORKSPACE_ID,
    name: "",
    description: "",
    status: "draft",
    triggerType: "manual",
    triggerConfig: {},
    steps: []
  });

  const [scheduleFrequency, setScheduleFrequency] = useState("daily");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState("2");
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState("1");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [executionStatus, setExecutionStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const [selectedAgentId, setSelectedAgentId] = useState<string>(MOCK_AGENTS[0].agentId);

  const apiClient = useMemo(() => providedApiClient ?? createWorkflowManagementApiClient(), [providedApiClient]);

  useEffect(() => {
    if (workflowId) {
      apiClient.getWorkflow(DEMO_WORKSPACE_ID, workflowId as EntityId<"workflowId">)
        .then((data: any) => {
          const wf = data.workflow ? data.workflow : data;
          const config = wf.triggerConfig || {};
          setScheduleFrequency(config.frequency || "daily");
          setScheduleDayOfWeek(config.dayOfWeek || "2");
          setScheduleDayOfMonth(config.dayOfMonth || "1");
          setScheduleTime(config.time || "08:00");

          setFormData({
            workflowId: wf.workflowId,
            workspaceId: wf.workspaceId,
            name: wf.name || "",
            description: wf.description || "",
            status: wf.status || "draft",
            triggerType: wf.triggerType || "manual",
            triggerConfig: config,
            steps: data.steps || []
          });
        })
        .catch(err => {
          console.error("Failed to load workflow", err);
        });
    } else if (importedData) {
      const config = importedData.triggerConfig || {};
      setScheduleFrequency(config.frequency || "daily");
      setScheduleDayOfWeek(config.dayOfWeek || "2");
      setScheduleDayOfMonth(config.dayOfMonth || "1");
      setScheduleTime(config.time || "08:00");

      setFormData({
        workflowId: "new-wf-123",
        workspaceId: DEMO_WORKSPACE_ID,
        name: importedData.name || "",
        description: importedData.description || "",
        status: "draft",
        triggerType: importedData.triggerType || "manual",
        triggerConfig: config,
        steps: importedData.steps ? importedData.steps.map((s: any, i: number) => ({
          ...s,
          workflowStepId: `step-${Date.now()}-${i}`,
          workspaceId: DEMO_WORKSPACE_ID,
          workflowId: "new-wf-123",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })) : []
      });
    }
  }, [workflowId, importedData, apiClient]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConfirmAddStep = () => {
    const newStep: WorkflowStepDto = {
      workflowStepId: `step-${Date.now()}`,
      workspaceId: formData.workspaceId,
      workflowId: formData.workflowId,
      agentId: selectedAgentId,
      stepOrder: formData.steps.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as WorkflowStepDto;

    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const handleMoveStepUp = (stepId: string) => {
    setFormData(prev => {
      const idx = prev.steps.findIndex(s => s.workflowStepId === stepId);
      if (idx <= 0) return prev;
      
      const newSteps = [...prev.steps];
      const temp = newSteps[idx];
      newSteps[idx] = newSteps[idx - 1];
      newSteps[idx - 1] = temp;
      
      // Update stepOrder
      newSteps.forEach((s, i) => { s.stepOrder = i + 1; });
      return { ...prev, steps: newSteps };
    });
  };

  const handleMoveStepDown = (stepId: string) => {
    setFormData(prev => {
      const idx = prev.steps.findIndex(s => s.workflowStepId === stepId);
      if (idx === -1 || idx >= prev.steps.length - 1) return prev;
      
      const newSteps = [...prev.steps];
      const temp = newSteps[idx];
      newSteps[idx] = newSteps[idx + 1];
      newSteps[idx + 1] = temp;
      
      // Update stepOrder
      newSteps.forEach((s, i) => { s.stepOrder = i + 1; });
      return { ...prev, steps: newSteps };
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setFormData(prev => {
      const newSteps = prev.steps.filter(s => s.workflowStepId !== stepId);
      // Update stepOrder
      newSteps.forEach((s, i) => { s.stepOrder = i + 1; });
      return { ...prev, steps: newSteps };
    });
  };



  const handleExecute = async () => {
    setExecutionStatus("running");
    setExecutionError(null);

    try {
      await apiClient.executeWorkflow(DEMO_WORKSPACE_ID, formData.workflowId as EntityId<"workflowId">);
      setExecutionStatus("success");
      
      // Update mock executions for local UI demonstration
      mockExecutions.unshift({
        executionId: `exec_mock_${Date.now()}` as any,
        workspaceId: formData.workspaceId as any,
        workflowId: formData.workflowId as any,
        workflowName: formData.name || "Untitled Workflow",
        status: "Running",
        triggeredBy: "user_1" as any,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      alert("Workflow execution requested successfully! (Handoff to Task Orchestration)");
      if (onExecutionSuccess) {
        onExecutionSuccess();
      }
    } catch (err: any) {
      console.error("Failed to execute workflow:", err);
      setExecutionStatus("failed");
      setExecutionError(err.message || "Failed to execute workflow. Workflow must be in 'Active' status and have at least 1 step.");
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setNameError("Please enter a Workflow Name before saving.");
      return;
    }
    setNameError(null);
    setSubmitError(null);

    try {
      const payload: CreateWorkflowCommand & { triggerType: string, triggerConfig: any } = {
        name: formData.name,
        description: formData.description,
        triggerType: formData.triggerType as "manual" | "schedule" | "webhook",
        triggerConfig: formData.triggerType === "schedule" ? {
          frequency: scheduleFrequency,
          dayOfWeek: scheduleFrequency === "weekly" ? scheduleDayOfWeek : undefined,
          dayOfMonth: scheduleFrequency === "monthly" ? scheduleDayOfMonth : undefined,
          time: scheduleTime
        } : {},
        steps: formData.steps.map(s => ({
          agentId: s.agentId,
          stepOrder: s.stepOrder
        }))
      };
      
      let newWorkflowId = formData.workflowId;
      if (formData.workflowId === "new-wf-123" || !workflowId) {
        const result: any = await apiClient.createWorkflow(DEMO_WORKSPACE_ID, payload);
        newWorkflowId = result.workflow ? result.workflow.workflowId : result.workflowId;
        setFormData(prev => ({ ...prev, workflowId: newWorkflowId }));
        if (formData.status !== "draft") {
          await apiClient.updateWorkflow(DEMO_WORKSPACE_ID, newWorkflowId as EntityId<"workflowId">, { ...payload, status: formData.status as any });
        }
      } else {
        await apiClient.updateWorkflow(DEMO_WORKSPACE_ID, formData.workflowId as EntityId<"workflowId">, { ...payload, status: formData.status as any });
      }
      
      alert("Workflow saved successfully! You can now Run the workflow.");
    } catch (err: any) {
      console.error("Failed to save workflow:", err);
      if (err.message?.includes("agents are missing or disabled")) {
        setSubmitError("Save failed: An Agent in the workflow is disabled or missing.");
      } else {
        setSubmitError(err.message || "Failed to save workflow. Please check your configuration.");
      }
    }
  };

  return (
    <div className="editor-layout">
      {/* Cột trái: Thông tin chính */}
      <div className="editor-main">
        <SectionCard title="General Information" description="Configure basic information for the workflow.">
          <div className="form-group">
            <label className="form-label" htmlFor="name">Workflow Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-input"
              style={nameError ? { border: "1px solid #ef4444" } : {}}
              placeholder="Example: Data Pipeline Alpha..."
              value={formData.name}
              onChange={(e) => {
                handleChange(e);
                if (e.target.value.trim()) setNameError(null);
              }}
            />
            {nameError && (
              <div style={{ color: "#ef4444", fontSize: "13px", marginTop: "4px" }}>
                {nameError}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" htmlFor="description">Detailed Description</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              placeholder="Explain the purpose of this workflow..."
              rows={4}
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </SectionCard>

        <SectionCard title="Trigger Configuration" description="Determine how this workflow is triggered.">
          <div className="form-group">
            <label className="form-label" htmlFor="triggerType">Trigger Type</label>
            <select
              id="triggerType"
              name="triggerType"
              className="form-input"
              value={formData.triggerType}
              onChange={handleChange}
            >
              <option value="manual">Manual</option>
              <option value="schedule">Scheduled</option>
              <option value="webhook">Via Webhook (API)</option>
            </select>
          </div>

          {formData.triggerType === "schedule" && (
            <div className="form-group" style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" htmlFor="scheduleFrequency">Run Frequency</label>
                  <select
                    id="scheduleFrequency"
                    className="form-input"
                    value={scheduleFrequency}
                    onChange={e => setScheduleFrequency(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {scheduleFrequency === "weekly" && (
                  <div>
                    <label className="form-label" htmlFor="scheduleDayOfWeek">On Day</label>
                    <select
                      id="scheduleDayOfWeek"
                      className="form-input"
                      value={scheduleDayOfWeek}
                      onChange={e => setScheduleDayOfWeek(e.target.value)}
                    >
                      <option value="2">Monday</option>
                      <option value="3">Tuesday</option>
                      <option value="4">Wednesday</option>
                      <option value="5">Thursday</option>
                      <option value="6">Friday</option>
                      <option value="7">Saturday</option>
                      <option value="1">Sunday</option>
                    </select>
                  </div>
                )}
                {scheduleFrequency === "monthly" && (
                  <div>
                    <label className="form-label" htmlFor="scheduleDayOfMonth">On Date</label>
                    <select
                      id="scheduleDayOfMonth"
                      className="form-input"
                      value={scheduleDayOfMonth}
                      onChange={e => setScheduleDayOfMonth(e.target.value)}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Day {day}</option>
                      ))}
                    </select>
                    <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
                      (Automatically rolls back to the last day of the month if fewer days exist)
                    </div>
                  </div>
                )}
                <div>
                  <label className="form-label" htmlFor="scheduleTime">Run Time</label>
                  <input
                    type="time"
                    id="scheduleTime"
                    className="form-input"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {formData.triggerType === "webhook" && (
            <div className="form-group" style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <label className="form-label">Webhook URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  value="https://api.vcp.com/hooks/wf-demo-123"
                  style={{ background: '#e2e8f0', color: '#64748b' }}
                />
                <button
                  className="secondary-action"
                  onClick={() => alert('Webhook URL copied!')}
                  style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}
                >
                  Copy
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>Send an HTTP POST request to this URL to trigger the workflow.</p>
            </div>
          )}
        </SectionCard>
        
        <SectionCard title="Execution Steps">
          <WorkflowStepsTable
            steps={formData.steps}
            agents={MOCK_AGENTS}
            onMoveUp={handleMoveStepUp}
            onMoveDown={handleMoveStepDown}
            onRemove={handleRemoveStep}
          />
          
          <div style={{ marginTop: '16px', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'var(--bg-subtle)' }}>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Add new step:</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select 
                className="form-input" 
                style={{ flex: 1, margin: 0 }} 
                value={selectedAgentId} 
                onChange={(e) => setSelectedAgentId(e.target.value)}
              >
                {MOCK_AGENTS.map(agent => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.name} ({agent.role}) {agent.status === 'disabled' ? ' - [DISABLED]' : ''}
                  </option>
                ))}
              </select>
              <button className="primary-action" style={{ padding: '8px 24px', whiteSpace: 'nowrap' }} onClick={handleConfirmAddStep}>+ Add Agent</button>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Cột phải: Cài đặt bổ sung & Nút hành động */}
      <div className="editor-sidebar" style={{ position: 'sticky', top: '24px', alignSelf: 'flex-start' }}>
        <SectionCard title="Status & Publishing">
          <div className="form-group">
            <label className="form-label" htmlFor="status">Current Status</label>
            <select
              id="status"
              name="status"
              className="form-input"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px', lineHeight: '1.5' }}>
            Note: You must save the Workflow as "Active" to click Run (Execute).
          </p>
        </SectionCard>

        <div className="panel" style={{ padding: '16px' }}>
          <div className="form-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', flexDirection: 'column' }}>
            <ConfirmButton onClick={handleSave} variant="primary">
              Save Workflow Configuration
            </ConfirmButton>
            <button
              className="primary-action"
              onClick={handleExecute}
              style={{ background: formData.status === "active" ? '#10b981' : '#e5e7eb', borderColor: formData.status === "active" ? '#10b981' : '#e5e7eb', color: formData.status === "active" ? 'white' : '#9ca3af', cursor: formData.status === "active" ? 'pointer' : 'not-allowed' }}
              disabled={executionStatus === "running" || formData.status !== "active"}
              title={formData.status !== "active" ? "Save workflow as 'Active' to run" : ""}
            >
              {executionStatus === "running" ? "Sending request..." : "▶ Run Workflow (Execute)"}
            </button>
            <button className="secondary-action" onClick={onCancel}>
              Back to list
            </button>
          </div>

          {executionStatus !== "idle" && (
            <div style={{ marginTop: '16px', padding: '12px', background: executionStatus === "failed" ? '#fef2f2' : '#f0fdf4', color: executionStatus === "failed" ? '#b91c1c' : '#15803d', borderRadius: '6px', fontSize: '13px' }}>
              {executionStatus === "running" && <div>Sending execution request...</div>}
              {executionStatus === "success" && <div style={{ fontWeight: 'bold' }}>✓ Execution request sent successfully! Please switch to Run History to view details.</div>}
              {executionStatus === "failed" && <div><b>Error:</b> {executionError}</div>}
            </div>
          )}

          {submitError && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px' }}>
              <b>Error:</b> {submitError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
