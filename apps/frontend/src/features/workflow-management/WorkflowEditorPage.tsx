import { useState } from "react";
import { ConfirmButton } from "../../components/shared/ConfirmButton";
import { SectionCard } from "../../components/shared/SectionCard";

export function WorkflowEditorPage() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "Draft",
    triggerType: "manual"
  });

  const [scheduleFrequency, setScheduleFrequency] = useState("daily");
  const [testRunStatus, setTestRunStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const handleSave = () => {
    console.log("Saved workflow:", formData);
    alert("Đã lưu workflow thành công!");
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
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px dashed var(--line)' }}>
            Chưa có bước nào được cấu hình.<br />
            (Tính năng kéo thả step sẽ được cập nhật)
          </div>
          <button className="secondary-action" style={{ width: '100%', marginTop: '12px' }}>
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
