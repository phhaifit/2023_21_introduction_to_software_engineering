import { useState, useMemo } from "react";
import { ConfirmButton } from "../../components/shared/ConfirmButton";
import { SectionCard } from "../../components/shared/SectionCard";
import { WorkflowStepsTable } from "./components/WorkflowStepsTable";
import type { WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import { createWorkflowManagementApiClient, type CreateWorkflowCommand } from "./api/workflow-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

const MOCK_AGENTS: AgentPublicSummary[] = [
  { agentId: "agt-1", workspaceId: "ws-1", name: "Code Assistant", role: "Software Developer", model: "gpt-4", status: "enabled" },
  { agentId: "agt-2", workspaceId: "ws-1", name: "Reviewer", role: "Code Reviewer", model: "gpt-4", status: "disabled" },
  { agentId: "agt-3", workspaceId: "ws-1", name: "Tester", role: "QA Engineer", model: "gpt-3.5", status: "enabled" }
] as AgentPublicSummary[];

export function WorkflowEditorPage() {
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
    workspaceId: "ws-1",
    name: "",
    description: "",
    status: "Draft",
    triggerType: "manual",
    triggerConfig: {},
    steps: []
  });

  const [scheduleFrequency, setScheduleFrequency] = useState("daily");
  const [testRunStatus, setTestRunStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddStep = () => {
    // Basic round-robin agent selection for mock purposes
    const agentIndex = formData.steps.length % MOCK_AGENTS.length;
    const newStep: WorkflowStepDto = {
      workflowStepId: `step-${Date.now()}`,
      workspaceId: formData.workspaceId,
      workflowId: formData.workflowId,
      agentId: MOCK_AGENTS[agentIndex].agentId,
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

  const handleTestRun = () => {
    setTestRunStatus("running");
    setTestLogs(["Bắt đầu quá trình chạy thử nghiệm..."]);

    setTimeout(() => {
      setTestLogs(prev => [...prev, "Đang khởi tạo quy trình..."]);
    }, 1000);

    setTimeout(() => {
      setTestLogs(prev => [...prev, "Thực thi tác vụ giả lập hoàn tất."]);
      setTestRunStatus("success");
    }, 2500);
  };

  const apiClient = useMemo(() => createWorkflowManagementApiClient(), []);

  const handleSave = async () => {
    try {
      const payload: CreateWorkflowCommand = {
        name: formData.name,
        description: formData.description,
        triggerType: formData.triggerType as "manual" | "schedule" | "webhook",
        steps: formData.steps.map(s => ({
          agentId: s.agentId,
          stepOrder: s.stepOrder
        }))
      };
      
      await apiClient.createWorkflow("ws_1" as EntityId<"workspaceId">, payload);
      alert("Đã lưu workflow thành công!");
      // Option: could redirect or clear form here
    } catch (err) {
      console.error("Failed to save workflow:", err);
      alert("Không thể lưu workflow. Vui lòng kiểm tra lại cấu hình (VD: Agent bị disable).");
    }
  };

  return (
    <div className="editor-layout">
      {/* Cột trái: Thông tin chính */}
      <div className="editor-main">
        <SectionCard title="Thông tin chung" description="Cấu hình thông tin cơ bản cho workflow.">
          <div className="form-group">
            <label className="form-label" htmlFor="name">Tên Workflow</label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-input"
              placeholder="Ví dụ: Data Pipeline Alpha..."
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" htmlFor="description">Mô tả chi tiết</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              placeholder="Giải thích mục đích của workflow này..."
              rows={4}
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </SectionCard>

        <SectionCard title="Cấu hình Trigger" description="Xác định cách thức workflow này được kích hoạt.">
          <div className="form-group">
            <label className="form-label" htmlFor="triggerType">Loại Trigger</label>
            <select
              id="triggerType"
              name="triggerType"
              className="form-input"
              value={formData.triggerType}
              onChange={handleChange}
            >
              <option value="manual">Kích hoạt thủ công (Manual)</option>
              <option value="schedule">Theo lịch trình (Schedule)</option>
              <option value="webhook">Qua Webhook (API)</option>
            </select>
          </div>

          {formData.triggerType === "schedule" && (
            <div className="form-group" style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--line)' }}>
              <label className="form-label" htmlFor="scheduleFrequency">Tần suất chạy</label>
              <select
                id="scheduleFrequency"
                className="form-input"
                value={scheduleFrequency}
                onChange={e => setScheduleFrequency(e.target.value)}
              >
                <option value="daily">Hàng ngày (Lúc 08:00 AM)</option>
                <option value="weekly">Hàng tuần (Thứ Hai)</option>
                <option value="monthly">Hàng tháng (Ngày 1)</option>
              </select>
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
                  onClick={() => alert('Đã copy Webhook URL!')}
                  style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}
                >
                  Copy
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>Gửi HTTP POST request đến URL này để kích hoạt workflow.</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Cột phải: Cài đặt bổ sung & Nút hành động */}
      <div className="editor-sidebar">
        <SectionCard title="Trạng thái & Phát hành">
          <div className="form-group">
            <label className="form-label" htmlFor="status">Trạng thái hiện tại</label>
            <select
              id="status"
              name="status"
              className="form-input"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="Draft">Bản nháp (Draft)</option>
              <option value="Published">Đã xuất bản (Published)</option>
            </select>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px', lineHeight: '1.5' }}>
            Lưu ý: Chỉ các workflow ở trạng thái "Đã xuất bản" mới có thể được kích hoạt tự động qua Trigger.
          </p>
        </SectionCard>

        <SectionCard title="Các bước thực thi (Steps)">
          <WorkflowStepsTable
            steps={formData.steps}
            agents={MOCK_AGENTS}
            onMoveUp={handleMoveStepUp}
            onMoveDown={handleMoveStepDown}
            onRemove={handleRemoveStep}
          />
          <button 
            className="secondary-action" 
            style={{ width: '100%', marginTop: '12px' }}
            onClick={handleAddStep}
          >
            + Thêm bước mới
          </button>
        </SectionCard>

        <div className="panel" style={{ padding: '16px' }}>
          <div className="form-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', flexDirection: 'column' }}>
            <button
              className="primary-action"
              onClick={handleTestRun}
              style={{ background: '#10b981', borderColor: '#10b981' }}
              disabled={testRunStatus === "running"}
            >
              {testRunStatus === "running" ? "Đang chạy..." : "Chạy thử nghiệm (Test Run)"}
            </button>
            <ConfirmButton onClick={handleSave} variant="primary">
              Lưu cấu hình Workflow
            </ConfirmButton>
            <button className="secondary-action" style={{ textAlign: 'center' }}>
              Hủy bỏ thay đổi
            </button>
          </div>

          {testRunStatus !== "idle" && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#0f172a', color: '#10b981', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }}>
              <div style={{ color: '#94a3b8', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>Test Run Logs</div>
              {testLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>&gt; {log}</div>
              ))}
              {testRunStatus === "running" && <div style={{ color: '#f59e0b', marginTop: '8px' }}>Đang xử lý...</div>}
              {testRunStatus === "success" && <div style={{ color: '#10b981', marginTop: '8px', fontWeight: 'bold' }}>✓ Hoàn tất thành công</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
