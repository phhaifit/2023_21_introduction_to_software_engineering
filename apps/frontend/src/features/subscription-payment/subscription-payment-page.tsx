import { useEffect, useState } from "react";
import { subscriptionPaymentApiClient } from "./subscription-payment-api-client.ts";
import "./subscription-payment.css";
import type {
  SubscriptionPublicSummary,
  TransactionPublicSummary
} from "@vcp/shared/contracts/subscription-payment.ts";

export function SubscriptionPaymentPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPublicSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionPublicSummary[]>([]);
  
  // Local state for sandbox checkout flow
  const [activeCheckout, setActiveCheckout] = useState<{
    transactionId: string;
    amount: number;
    plan: string;
  } | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await subscriptionPaymentApiClient.getSubscriptionDetails();
      setSubscription(data.subscription);
      setTransactions(data.transactions);
    } catch (err: any) {
      setError(err.message || "Failed to fetch billing details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  const handleCheckout = async (plan: "standard" | "premium") => {
    try {
      setError(null);
      const res = await subscriptionPaymentApiClient.initiateCheckout(plan);
      setActiveCheckout({
        transactionId: res.transactionId,
        amount: plan === "standard" ? 10 : 30,
        plan
      });
    } catch (err: any) {
      setError(err.message || "Checkout initiation failed.");
    }
  };

  const handleUpgrade = async () => {
    if (!subscription) return;
    try {
      setError(null);
      const res = await subscriptionPaymentApiClient.initiateUpgrade(subscription.subscriptionId);
      setActiveCheckout({
        transactionId: res.transactionId,
        amount: 20, // Upgrade price difference
        plan: "premium"
      });
    } catch (err: any) {
      setError(err.message || "Upgrade initiation failed.");
    }
  };

  const handleSandboxPayment = async (status: "success" | "failed") => {
    if (!activeCheckout) return;
    try {
      setError(null);
      setLoading(true);
      await subscriptionPaymentApiClient.sendMockCallback(activeCheckout.transactionId, status);
      setActiveCheckout(null);
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || "Sandbox payment confirmation failed.");
      setLoading(false);
    }
  };

  if (loading && !activeCheckout) {
    return (
      <div className="billing-container">
        <p>Đang tải dữ liệu thanh toán...</p>
      </div>
    );
  }

  // 1. Sandbox Checkout Screen
  if (activeCheckout) {
    return (
      <div className="billing-container">
        <div className="billing-title-section">
          <h2>Cổng Thanh Toán Giả Lập (Sandbox Checkout)</h2>
          <p>Mô phỏng thanh toán an toàn mà không phát sinh giao dịch tiền thật.</p>
        </div>
        <div className="sandbox-checkout">
          <p className="sandbox-title">Thanh toán gói {activeCheckout.plan.toUpperCase()}</p>
          <div className="sandbox-amount">
            ${activeCheckout.amount} <span style={{ fontSize: "1rem", color: "#64748b" }}>USD</span>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Giao dịch ID: <code>{activeCheckout.transactionId}</code>
          </p>
          <div className="sandbox-actions">
            <button
              onClick={() => handleSandboxPayment("success")}
              className="sandbox-btn sandbox-btn--success"
            >
              Thanh Toán Thành Công
            </button>
            <button
              onClick={() => handleSandboxPayment("failed")}
              className="sandbox-btn sandbox-btn--fail"
            >
              Thanh Toán Thất Bại
            </button>
          </div>
          <button
            onClick={() => setActiveCheckout(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            Hủy bỏ và Quay lại
          </button>
        </div>
      </div>
    );
  }

  const isSubActive = subscription && (subscription.status === "active" || subscription.status === "expiring_soon");

  return (
    <div className="billing-container">
      <div className="billing-title-section">
        <h2>Thông tin Gói & Thanh toán</h2>
        <p>Chọn cấu hình gói dịch vụ phù hợp và nâng cấp tài nguyên cho các Workspace.</p>
      </div>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#b91c1c",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "0.9rem"
          }}
        >
          {error}
        </div>
      )}

      {/* 2. Show Active Subscription Status if active */}
      {isSubActive && subscription ? (
        <div className="status-card">
          <div className="status-info">
            <div className="status-plan">
              Gói hiện tại: {subscription.plan}
              <span className={`status-badge status-badge--${subscription.status}`}>
                {subscription.status}
              </span>
            </div>
            <div className="status-expires">
              Hạn dùng đến: {new Date(subscription.expiresAt).toLocaleString("vi-VN")}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "4px" }}>
              Workspace ID liên kết: <code>{subscription.workspaceId || "Chưa tạo workspace"}</code>
            </div>
          </div>
          
          {subscription.plan === "standard" && (
            <button
              onClick={handleUpgrade}
              className="pricing-btn pricing-btn--primary"
              style={{ width: "auto", padding: "12px 24px" }}
            >
              Nâng cấp lên Premium (+$20)
            </button>
          )}
        </div>
      ) : (
        /* 3. Pricing Plans Selection */
        <div>
          <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Chọn gói đăng ký dịch vụ</h3>
          <div className="pricing-grid">
            {/* Standard Plan */}
            <div className="pricing-card">
              <div className="pricing-card__name">Standard Plan</div>
              <div className="pricing-card__price">
                $10 <span>/ tháng</span>
              </div>
              <ul className="pricing-card__features">
                <li>Cấp phát CPU / RAM ở mức trung bình</li>
                <li>Hỗ trợ tối đa 10 Agents</li>
                <li>Hỗ trợ tối đa 100 tài liệu Knowledge Base</li>
                <li>Cập nhật định kỳ, phản hồi tiêu chuẩn</li>
              </ul>
              <button
                onClick={() => handleCheckout("standard")}
                className="pricing-btn"
              >
                Mua gói Standard
              </button>
            </div>

            {/* Premium Plan */}
            <div className="pricing-card pricing-card--popular">
              <div className="pricing-card__badge">Phổ biến</div>
              <div className="pricing-card__name">Premium Plan</div>
              <div className="pricing-card__price">
                $30 <span>/ tháng</span>
              </div>
              <ul className="pricing-card__features">
                <li>Cấp phát tài nguyên CPU / RAM mạnh mẽ</li>
                <li>Hỗ trợ tối đa 30 Agents</li>
                <li>Hỗ trợ tối đa 1000 tài liệu Knowledge Base</li>
                <li>Ưu tiên xử lý tác vụ, phản hồi tức thời</li>
              </ul>
              <button
                onClick={() => handleCheckout("premium")}
                className="pricing-btn pricing-btn--primary"
              >
                Mua gói Premium
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Transactions History */}
      {transactions.length > 0 && (
        <div className="history-section">
          <h3>Lịch sử giao dịch</h3>
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Mã giao dịch</th>
                  <th>Số tiền</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                  <th>Ngày thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.transactionId}>
                    <td>
                      <code>{tx.transactionId.substring(0, 18)}...</code>
                    </td>
                    <td>
                      ${tx.amount} {tx.currency}
                    </td>
                    <td>
                      {tx.amount === 20 ? "Nâng cấp gói" : "Đăng ký mới / Gia hạn"}
                    </td>
                    <td>
                      <span className={`tx-status tx-status--${tx.status}`}>
                        {tx.status === "success"
                          ? "Thành công"
                          : tx.status === "pending"
                          ? "Đang chờ"
                          : "Thất bại"}
                      </span>
                    </td>
                    <td>{new Date(tx.createdAt).toLocaleString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
export default SubscriptionPaymentPage;
