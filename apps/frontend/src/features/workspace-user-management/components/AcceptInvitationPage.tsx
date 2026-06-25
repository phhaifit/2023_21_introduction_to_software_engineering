import { useState, useEffect } from "react";
import { acceptInvitation } from "../api/workspace-user-management.api.ts";
import type { PageKey } from "../../../types/navigation.ts";

type Props = {
  onNavigate: (page: PageKey) => void;
};

export function AcceptInvitationPage({ onNavigate }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("Không tìm thấy mã lời mời (token) trong URL.");
      setLoading(false);
      return;
    }

    const accept = async () => {
      try {
        await acceptInvitation(token);
        // Clear the URL and redirect to members page
        window.history.replaceState({}, document.title, "/");
        onNavigate("members");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    accept();
  }, [onNavigate]);

  return (
    <div className="page-container" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", padding: "60px 40px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div className="brand-mark" style={{ margin: "0 auto", width: "64px", height: "64px", fontSize: "24px" }}>V</div>
      </div>
      
      <h1 style={{ marginBottom: "16px" }}>Chấp nhận lời mời</h1>
      
      {loading && (
        <div style={{ color: "var(--muted)" }}>
          <p>Đang xác thực lời mời của bạn. Vui lòng đợi...</p>
        </div>
      )}
      
      {error && (
        <div style={{ marginTop: "20px" }}>
          <div style={{ color: "var(--danger)", padding: "16px", background: "var(--danger-soft)", borderRadius: "8px", display: "inline-block", textAlign: "left", marginBottom: "24px" }}>
            <strong>Lỗi xác thực:</strong>
            <p style={{ margin: "8px 0 0" }}>{error}</p>
          </div>
          <div>
            <button 
              onClick={() => {
                window.history.replaceState({}, document.title, "/");
                onNavigate("workflows");
              }} 
              className="secondary-action"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
