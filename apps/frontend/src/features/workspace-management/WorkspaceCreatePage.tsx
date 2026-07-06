import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Crown, CheckCircle2 } from "lucide-react";
import { PLAN_ENTITLEMENTS, PLAN_PRICES } from "@vcp/shared/contracts/plans.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { PageHeader } from "../../components/layout/PageHeader.tsx";
import { useToast } from "../../components/shared/Toast.tsx";
import { createWorkspace } from "./workspace-management-api-client.ts";

// Only "standard" and "premium" are supported by the backend
const SUPPORTED_PLANS: SubscriptionPlan[] = ["standard", "premium"];

const PLAN_META: Record<string, { icon: typeof Star; label: string }> = {
  standard: { icon: Star,  label: "Standard" },
  premium:  { icon: Crown, label: "Premium"  },
};

export function WorkspaceCreatePage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [name, setName] = useState("");
  const [plan, setPlan] = useState<SubscriptionPlan>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);

    const trimmedName = name.trim();
    if (!trimmedName) { setNameError("Tên workspace không được để trống."); return; }
    if (trimmedName.length > 100) { setNameError("Tên không được vượt quá 100 ký tự."); return; }

    setSubmitting(true);
    try {
      const ws = await createWorkspace({ name: trimmedName, plan });
      showSuccess(`Workspace "${ws.name}" đã được tạo. Đang khởi tạo môi trường…`);
      navigate(`/workspaces/${ws.workspaceId}`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Không thể tạo workspace. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Tạo Workspace mới"
        eyebrow="VCP Platform"
        description="Thiết lập môi trường ảo hóa công ty mới. Workspace sẽ sẵn sàng sau vài giây."
      >
        <button
          type="button"
          className="secondary-action"
          onClick={() => navigate("/workspaces")}
          disabled={submitting}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={15} />
          Quay lại
        </button>
      </PageHeader>

      <form
        className="form-panel"
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
        style={{ maxWidth: 680 }}
      >
        {/* Workspace name */}
        <div className="form-group">
          <label htmlFor="ws-name" className="form-label">
            Tên Workspace
            <span aria-hidden="true" style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>
          </label>
          <input
            id="ws-name"
            type="text"
            className="form-input"
            placeholder="Ví dụ: Acme Corp Dev, Tunha Workspace…"
            value={name}
            maxLength={100}
            disabled={submitting}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "ws-name-error" : "ws-name-hint"}
            onChange={(e) => { setName(e.target.value); setNameError(null); }}
            style={nameError ? { borderColor: "var(--danger)", outline: "none", boxShadow: "0 0 0 3px var(--danger-soft)" } : {}}
          />
          {nameError ? (
            <span id="ws-name-error" role="alert" style={{ color: "var(--danger)", fontSize: 12, marginTop: 4, display: "block" }}>
              {nameError}
            </span>
          ) : (
            <span id="ws-name-hint" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "block" }}>
              {name.length}/100 ký tự
            </span>
          )}
        </div>

        {/* Plan selection */}
        <div className="form-group">
          <span className="form-label">Gói dịch vụ</span>
          <div
            role="radiogroup"
            aria-label="Chọn gói dịch vụ"
            style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}
          >
            {SUPPORTED_PLANS.map((p) => {
              const ent = PLAN_ENTITLEMENTS[p];
              const price = PLAN_PRICES[p];
              const meta = PLAN_META[p];
              const Icon = meta.icon;
              const selected = plan === p;

              return (
                <label
                  key={p}
                  className="elevated-card"
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "16px 20px",
                    border: `2px solid ${selected ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: 12,
                    margin: 0,
                    boxShadow: selected
                      ? "0 0 0 4px var(--accent-soft), var(--shadow)"
                      : "var(--shadow)",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p}
                    checked={selected}
                    disabled={submitting}
                    onChange={() => setPlan(p)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                  />

                  {/* Icon */}
                  <span
                    style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      display: "grid", placeItems: "center",
                      background: selected ? "var(--accent-soft)" : "var(--bg)",
                      border: "1px solid var(--line)",
                      color: selected ? "var(--accent)" : "var(--muted)",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    <Icon size={20} />
                  </span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", textTransform: "capitalize" }}>
                        {p}
                      </span>
                      <span
                        style={{
                          fontSize: 13, fontWeight: 600,
                          color: price === 0 ? "var(--success)" : "var(--accent)",
                        }}
                      >
                        {price === 0 ? "Miễn phí" : `$${price}/tháng`}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
                      <span>{ent.cpuCores} CPU</span>
                      <span>{ent.memoryGb} GB RAM</span>
                      <span>Tối đa {ent.maxAgents} agents</span>
                      <span>{ent.maxStorageGb} GB lưu trữ</span>
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {selected && (
                    <CheckCircle2
                      size={20}
                      style={{ color: "var(--accent)", flexShrink: 0, alignSelf: "center" }}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => navigate("/workspaces")}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-action"
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Đang tạo…" : "Tạo Workspace"}
          </button>
        </div>
      </form>
    </div>
  );
}
