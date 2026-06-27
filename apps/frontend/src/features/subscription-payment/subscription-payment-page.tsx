import { useEffect, useState } from "react";
import { subscriptionPaymentApiClient } from "./subscription-payment-api-client.ts";
import "./subscription-payment.css";
import type {
  SubscriptionPublicSummary,
  TransactionPublicSummary,
  WorkspaceResourceUsageResponse,
  SubscriptionPlansResponse
} from "@vcp/shared/contracts/subscription-payment.ts";
import { PLAN_ENTITLEMENTS, PLAN_PRICES } from "@vcp/shared/contracts/plans.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { useToast } from "../../components/shared/Toast.tsx";

type ViewState = "dashboard" | "upgrade" | "checkout" | "success";

export function SubscriptionPaymentPage() {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionPublicSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionPublicSummary[]>([]);
  const [resourceUsage, setResourceUsage] = useState<WorkspaceResourceUsageResponse | null>(null);
  const [plansConfig, setPlansConfig] = useState<SubscriptionPlansResponse | null>(null);
  
  // State quản lý View chuyển màn hình
  const [view, setView] = useState<ViewState>("dashboard");

  // State cho quá trình checkout hiện tại
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<"standard" | "premium">("standard");
  const [checkoutData, setCheckoutData] = useState<{
    transactionId: string;
    subscriptionId: string;
    checkoutUrl: string;
    amount: number;
  } | null>(null);

  // State cho phương thức thanh toán
  const [paymentMethod, setPaymentMethod] = useState<"vnpay" | "momo" | "stripe" | "simulated">("stripe");
  
  // State thông tin thẻ ảo hiện tại (đồng bộ từ db nếu có)
  const [cardDetails, setCardDetails] = useState({
    number: "4242 4242 4242 4242",
    expiry: "12/28",
    cvv: "•••",
    name: "Admin Wu"
  });
  
  const [agreeToTerms, setAgreeToTerms] = useState(true); // Gán mặc định true để cải thiện UX
  const [autoRenew, setAutoRenew] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"standard" | "premium">("premium");

  // State Promo Code
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // State Modal thay đổi thẻ ảo
  const [showCardModal, setShowCardModal] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardHolder, setNewCardHolder] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");

  // State lưu hóa đơn thành công vừa thanh toán để hiển thị màn hình Success
  const [lastSuccessPayment, setLastSuccessPayment] = useState<{
    paymentId: string;
    invoiceId: string;
    plan: string;
    amountPaid: number;
    nextRenewal: string;
  } | null>(null);

  // Fetch dữ liệu thật từ API backend
  const fetchDetails = async () => {
    try {
      setLoading(true);
      
      // Gọi song song API lấy Subscription, Resource Usage và Plans
      const [detailsData, usageData, plansData] = await Promise.all([
        subscriptionPaymentApiClient.getSubscriptionDetails(DEMO_WORKSPACE_ID),
        subscriptionPaymentApiClient.getWorkspaceResourceUsage(DEMO_WORKSPACE_ID),
        subscriptionPaymentApiClient.getPlans()
      ]);

      setSubscription(detailsData.subscription);
      setTransactions(detailsData.transactions);
      setResourceUsage(usageData);
      setPlansConfig(plansData);

      // Cập nhật thông tin gia hạn & thẻ ảo thật từ database
      if (detailsData.subscription) {
        setAutoRenew(detailsData.subscription.autoRenew);
        if (detailsData.subscription.cardNumber) {
          setCardDetails({
            number: detailsData.subscription.cardNumber,
            name: detailsData.subscription.cardHolder || "Admin Wu",
            expiry: detailsData.subscription.cardExpiry || "12/28",
            cvv: "•••"
          });
        }
      }
    } catch (err: any) {
      showError(err.message || "Không thể tải thông tin thanh toán từ API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  // Thay đổi Auto-Renewal qua API thật
  const handleToggleAutoRenew = async (checked: boolean) => {
    try {
      await subscriptionPaymentApiClient.toggleAutoRenewal(DEMO_WORKSPACE_ID, checked);
      setAutoRenew(checked);
      showSuccess(checked ? "Đã bật tự động gia hạn thành công." : "Đã tắt tự động gia hạn thành công.");
    } catch (err: any) {
      showError(err.message || "Cập nhật tự động gia hạn thất bại.");
      setAutoRenew(!checked); // Revert switch nếu lỗi
    }
  };

  // Hủy gia hạn qua API thật
  const handleCancelAutoRenewal = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy tự động gia hạn cho gói dịch vụ hiện tại không?")) {
      return;
    }
    try {
      setLoading(true);
      await subscriptionPaymentApiClient.toggleAutoRenewal(DEMO_WORKSPACE_ID, false);
      setAutoRenew(false);
      showSuccess("Đã hủy tự động gia hạn thành công.");
      await fetchDetails();
    } catch (err: any) {
      showError(err.message || "Không thể hủy tự động gia hạn.");
    } finally {
      setLoading(false);
    }
  };

  // Cập nhật thẻ ảo qua API thật
  const handleUpdateCardDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardNumber || !newCardHolder || !newCardExpiry) {
      showError("Vui lòng nhập đầy đủ thông tin thẻ.");
      return;
    }
    try {
      setLoading(true);
      await subscriptionPaymentApiClient.updatePaymentMethod(DEMO_WORKSPACE_ID, newCardNumber, newCardHolder, newCardExpiry);
      setCardDetails({
        number: newCardNumber,
        name: newCardHolder,
        expiry: newCardExpiry,
        cvv: "•••"
      });
      setShowCardModal(false);
      showSuccess("Cập nhật phương thức thanh toán ảo thành công.");
      await fetchDetails();
    } catch (err: any) {
      showError(err.message || "Không thể cập nhật phương thức thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  // Áp dụng mã giảm giá thật
  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    try {
      const res = await subscriptionPaymentApiClient.validatePromo(promoCodeInput);
      if (res.success) {
        setAppliedPromo(promoCodeInput.trim().toUpperCase());
        setDiscountAmount(res.discount);
        showSuccess(`Áp dụng mã giảm giá thành công! Bạn được giảm $${res.discount}.00`);
      } else {
        showError(res.message || "Mã giảm giá không hợp lệ.");
      }
    } catch (err: any) {
      showError(err.message || "Lỗi khi kiểm tra mã giảm giá.");
    }
  };

  // Khởi tạo Checkout (Có truyền Promo Code nếu có)
  const handleInitiateCheckout = async (plan: "standard" | "premium") => {
    try {
      setLoading(true);
      setSelectedPlanForCheckout(plan);
      
      const res = await subscriptionPaymentApiClient.initiateCheckout(DEMO_WORKSPACE_ID, plan, appliedPromo || undefined);
      
      const baseAmount = PLAN_PRICES[plan];
      const actualAmount = Math.max(0, baseAmount - discountAmount);

      setCheckoutData({
        transactionId: res.transactionId,
        subscriptionId: res.subscriptionId,
        checkoutUrl: res.checkoutUrl,
        amount: actualAmount
      });
      setView("checkout");
    } catch (err: any) {
      showError(err.message || "Khởi tạo checkout thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // Khởi tạo Upgrade từ Standard lên Premium (Có truyền Promo Code nếu có)
  const handleInitiateUpgrade = async () => {
    if (!subscription) return;
    try {
      setLoading(true);
      setSelectedPlanForCheckout("premium");
      
      const res = await subscriptionPaymentApiClient.initiateUpgrade(subscription.subscriptionId, appliedPromo || undefined);
      
      const baseUpgrade = PLAN_PRICES["premium"] - PLAN_PRICES["standard"]; // $50
      const actualUpgrade = Math.max(0, baseUpgrade - discountAmount);

      setCheckoutData({
        transactionId: res.transactionId,
        subscriptionId: res.subscriptionId,
        checkoutUrl: res.checkoutUrl,
        amount: actualUpgrade
      });
      setView("checkout");
    } catch (err: any) {
      showError(err.message || "Khởi tạo nâng cấp thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // Gửi callback thật lên API backend để đối soát giao dịch
  const handleProcessPayment = async (status: "success" | "failed") => {
    if (!checkoutData) return;
    try {
      setLoading(true);
      
      // Gọi API mock-callback thực tế của dự án để update DB
      await subscriptionPaymentApiClient.sendMockCallback(checkoutData.transactionId, status);
      
      if (status === "success") {
        const nextRenewalDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("vi-VN", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });
        
        setLastSuccessPayment({
          paymentId: `PAY-${checkoutData.transactionId.substring(0, 8).toUpperCase()}`,
          invoiceId: `INV-2026-${checkoutData.transactionId.substring(checkoutData.transactionId.length - 4).toUpperCase()}`,
          plan: selectedPlanForCheckout === "premium" ? "Premium Plan" : "Standard Plan",
          amountPaid: checkoutData.amount,
          nextRenewal: nextRenewalDate
        });
        
        // Reset promo states
        setAppliedPromo(null);
        setDiscountAmount(0);
        setPromoCodeInput("");

        showSuccess("Thanh toán thành công! Gói dịch vụ của bạn đã được kích hoạt.");
        setView("success");
      } else {
        throw new Error("Giao dịch giả lập đã bị hủy bỏ hoặc thất bại.");
      }
    } catch (err: any) {
      showError(err.message || "Thanh toán thất bại.");
      setView("dashboard"); // Quay về Dashboard nếu thanh toán lỗi
    } finally {
      // Reload dữ liệu thật từ API
      await fetchDetails();
    }
  };

  // Định dạng ngày hiển thị
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  if (loading && view === "dashboard") {
    return (
      <div className="billing-container">
        <p>Đang tải dữ liệu hóa đơn và gói dịch vụ từ API...</p>
      </div>
    );
  }

  const isSubActive = subscription && (subscription.status === "active" || subscription.status === "expiring_soon");

  // =========================================================================
  // VIEW 1: BILLING DASHBOARD (MÀN HÌNH CHÍNH)
  // =========================================================================
  if (view === "dashboard") {
    // Thông số tài nguyên động trả về từ API usage
    const cpuMax = resourceUsage?.cpu.max ?? 2;
    const cpuUsed = resourceUsage?.cpu.used ?? 0;
    
    const ramMax = resourceUsage?.ram.max ?? 4;
    const ramUsed = resourceUsage?.ram.used ?? 0;
    
    const agentsMax = resourceUsage?.agents.max ?? 2;
    const agentsUsed = resourceUsage?.agents.used ?? 0;
    
    const storageMax = resourceUsage?.storage.max ?? 10;
    const storageUsed = resourceUsage?.storage.used ?? 0;

    return (
      <div className="billing-container">
        <div className="billing-title-section">
          <h2>Billing & Subscription</h2>
          <p className="subtitle">Quản lý định mức tài nguyên, phương thức thanh toán và lịch sử hóa đơn thực tế của Workspace.</p>
        </div>



        <div className="grid-2col">
          {/* CỘT TRÁI: Gói hiện tại */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Current Subscription</h3>
              {isSubActive && (
                <span className={`status-badge status-badge--${subscription?.status}`}>
                  {subscription?.status === "active" ? "Active" : subscription?.status === "expiring_soon" ? "Expiring" : subscription?.status}
                </span>
              )}
            </div>
            
            <div className="card-price-box">
              <span className="price-val">
                ${subscription ? (plansConfig ? plansConfig[subscription.plan].price : PLAN_PRICES[subscription.plan]) : 0}
              </span>
              <span className="price-unit"> / month</span>
            </div>

            <div className="info-sub-grid">
              <div className="info-item">
                <span className="info-label">Plan</span>
                <span className="info-value">
                  {subscription ? `${subscription.plan.toUpperCase()} Plan` : "No Active Plan"}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Start Date</span>
                <span className="info-value">
                  {subscription ? formatDate(subscription.createdAt) : "—"}
                </span>
              </div>
              <div className="info-item" style={{ gridColumn: "span 2" }}>
                <span className="info-label">Renewal Date</span>
                <span className="info-value">
                  {subscription ? formatDate(subscription.expiresAt) : "—"}
                </span>
              </div>
            </div>

            {isSubActive && (
              <div className="auto-renewal-row">
                <div className="toggle-container">
                  <span className="toggle-label">Auto-Renewal</span>
                  <span className="toggle-sub">Gói sẽ tự động gia hạn vào ngày {formatDate(subscription.expiresAt)}</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={autoRenew} 
                    onChange={(e) => handleToggleAutoRenew(e.target.checked)} 
                  />
                  <span className="slider"></span>
                </label>
              </div>
            )}

            <div className="btn-group">
              {isSubActive && (
                <button 
                  onClick={handleCancelAutoRenewal}
                  className="btn btn--secondary"
                >
                  Cancel Auto-Renewal
                </button>
              )}
              {subscription?.plan === "standard" ? (
                <button onClick={() => setView("upgrade")} className="btn btn--primary">
                  Upgrade Plan
                </button>
              ) : !subscription ? (
                <button onClick={() => setView("upgrade")} className="btn btn--primary">
                  Select a Plan
                </button>
              ) : (
                <button disabled className="btn btn--primary" style={{ opacity: 0.6 }}>
                  Premium Active
                </button>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: Phương thức thanh toán ảo động */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Payment Method</h3>
            </div>

            <div className="virtual-card">
              <div className="card-header-row">
                <span className="card-type">VIRTUAL CARD</span>
                <div className="card-chip"></div>
              </div>
              <div className="card-number-display">{cardDetails.number}</div>
              <div className="card-footer-row">
                <div className="card-holder">
                  <div style={{ opacity: 0.6, fontSize: "0.6rem", marginBottom: "2px" }}>CARD HOLDER</div>
                  <span className="card-holder-name">{cardDetails.name}</span>
                </div>
                <div className="card-expiry">
                  <div style={{ opacity: 0.6, fontSize: "0.6rem", marginBottom: "2px" }}>EXPIRES</div>
                  <span className="card-expiry-val">{cardDetails.expiry}</span>
                </div>
              </div>
            </div>

            <div className="card-meta-email">
              <span>Billing email</span>
              <strong style={{ color: "#334155" }}>dev@local.test</strong>
            </div>

            {subscription ? (
              <button 
                onClick={() => {
                  setNewCardNumber(cardDetails.number);
                  setNewCardHolder(cardDetails.name);
                  setNewCardExpiry(cardDetails.expiry);
                  setShowCardModal(true);
                }} 
                className="btn btn--secondary" 
                style={{ marginTop: "16px" }}
              >
                Change Payment Method
              </button>
            ) : (
              <button 
                disabled 
                className="btn btn--secondary" 
                style={{ marginTop: "16px", opacity: 0.5 }}
              >
                Đăng ký gói để cập nhật thẻ
              </button>
            )}
          </div>
        </div>

        {/* THÔNG SỐ TÀI NGUYÊN ĐỘNG & PLAN COMPARISON */}
        <div className="grid-2col">
          {/* Cột trái: Quota bars động từ API */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Resource Usage</h3>
              <span className="quota-badge">
                {subscription ? `${subscription.plan.toUpperCase()} Plan Quota` : "FREE Plan Quota"}
              </span>
            </div>
            
            <div className="resource-list">
              {/* CPU */}
              <div className="resource-bar-container">
                <div className="resource-info-row">
                  <span className="resource-name">CPU</span>
                  <span className="resource-values">{cpuUsed} / {cpuMax} vCPUs</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-bar progress-bar--blue" 
                    style={{ width: `${(cpuUsed / cpuMax) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* RAM */}
              <div className="resource-bar-container">
                <div className="resource-info-row">
                  <span className="resource-name">RAM</span>
                  <span className="resource-values">{ramUsed} / {ramMax} GB</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-bar progress-bar--blue" 
                    style={{ width: `${(ramUsed / ramMax) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* AI Agents */}
              <div className="resource-bar-container">
                <div className="resource-info-row">
                  <span className="resource-name">AI Agents</span>
                  <span className="resource-values">{agentsUsed} / {agentsMax} agents</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-bar progress-bar--blue" 
                    style={{ width: `${(agentsUsed / agentsMax) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Storage */}
              <div className="resource-bar-container">
                <div className="resource-info-row">
                  <span className="resource-name">Storage</span>
                  <span className="resource-values">{storageUsed} / {storageMax} GB</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-bar progress-bar--orange" 
                    style={{ width: `${(storageUsed / storageMax) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: So sánh nhanh các Plan */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Plan Comparison</h3>
            </div>

            <div className="plan-mini-grid">
              <div className={`plan-mini-item ${(!subscription || subscription.plan === "free") ? "plan-mini-item--active" : ""}`}>
                <div>
                  <div className="plan-mini-name">
                    Free Plan
                    {(!subscription || subscription.plan === "free") && <span className="plan-mini-badge">Current</span>}
                  </div>
                  <div className="plan-mini-price">$0 / month — 2 vCPUs, 4GB RAM, 2 Agents, 10GB Storage</div>
                </div>
              </div>

              <div className={`plan-mini-item ${subscription?.plan === "standard" ? "plan-mini-item--active" : ""}`}>
                <div>
                  <div className="plan-mini-name">
                    Standard Plan
                    {subscription?.plan === "standard" && <span className="plan-mini-badge">Current</span>}
                  </div>
                  <div className="plan-mini-price">${plansConfig ? plansConfig.standard.price : 29} / month — 8 vCPUs, 16GB RAM, 10 Agents, 50GB Storage</div>
                </div>
                {(!subscription || subscription.plan === "free") && (
                  <button onClick={() => handleInitiateCheckout("standard")} className="btn btn--secondary" style={{ width: "auto" }}>Buy</button>
                )}
              </div>

              <div className={`plan-mini-item ${subscription?.plan === "premium" ? "plan-mini-item--active" : ""}`}>
                <div>
                  <div className="plan-mini-name">
                    Premium Plan
                    {subscription?.plan === "premium" && <span className="plan-mini-badge">Current</span>}
                  </div>
                  <div className="plan-mini-price">${plansConfig ? plansConfig.premium.price : 79} / month — 32 vCPUs, 64GB RAM, 50 Agents, 500GB Storage</div>
                </div>
                {subscription?.plan === "standard" ? (
                  <button onClick={() => setView("upgrade")} className="btn btn--primary" style={{ width: "auto" }}>Upgrade</button>
                ) : (!subscription || subscription.plan === "free") ? (
                  <button onClick={() => handleInitiateCheckout("premium")} className="btn btn--primary" style={{ width: "auto" }}>Buy</button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* LỊCH SỬ HÓA ĐƠN THỰC TẾ (INVOICE HISTORY) */}
        <div className="billing-card">
          <div className="invoice-header">
            <h3>Invoice History</h3>
            <span className="invoice-count-badge">{transactions.length} invoices</span>
          </div>

          {transactions.length > 0 ? (
            <div className="table-responsive" style={{ marginTop: "16px" }}>
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Billing Date</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.transactionId}>
                      <td><code>INV-2026-{tx.transactionId.substring(0, 4).toUpperCase()}</code></td>
                      <td>{formatDate(tx.createdAt)}</td>
                      <td>
                        {tx.amount === 29 || tx.amount === 19 || tx.amount === 9 ? "Standard Plan" : (tx.amount === 50 || tx.amount === 40 || tx.amount === 30) ? "Upgrade to Premium" : "Premium Plan"}
                      </td>
                      <td style={{ fontWeight: 600 }}>${tx.amount}.00</td>
                      <td>
                        <span className={`tx-status-badge tx-status-badge--${tx.status}`}>
                          {tx.status === "success" ? "Paid" : tx.status === "pending" ? "Pending" : "Failed"}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => alert(`Đang tải hóa đơn INV-2026-${tx.transactionId.substring(0, 4).toUpperCase()}`)}
                          className="action-btn-download"
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "16px" }}>Không có lịch sử hóa đơn nào.</p>
          )}
        </div>

        {/* MODAL THAY ĐỔI THẺ THANH TOÁN THỰC TẾ */}
        {showCardModal && (
          <div className="card-modal-overlay">
            <div className="card-modal-content">
              <h3>Change Payment Method</h3>
              <p className="card-modal-sub">Cập nhật thông tin thẻ thanh toán ảo được liên kết với hệ thống của bạn.</p>
              
              <form onSubmit={handleUpdateCardDetails}>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label>Card Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 4242 4242 4242 4242"
                    className="form-input"
                    value={newCardNumber}
                    onChange={(e) => setNewCardNumber(e.target.value)}
                  />
                </div>
                <div className="grid-2col" style={{ gap: "12px", marginBottom: "12px" }}>
                  <div className="form-group">
                    <label>Card Holder Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Admin Wu"
                      className="form-input"
                      value={newCardHolder}
                      onChange={(e) => setNewCardHolder(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input 
                      type="text" 
                      placeholder="MM/YY"
                      className="form-input"
                      value={newCardExpiry}
                      onChange={(e) => setNewCardExpiry(e.target.value)}
                    />
                  </div>
                </div>

                <div className="btn-group" style={{ marginTop: "20px" }}>
                  <button 
                    type="button" 
                    className="btn btn--secondary" 
                    onClick={() => setShowCardModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary">
                    Save Card details
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: UPGRADE PLAN SELECTION (MÀN HÌNH SO SÁNH NÂNG CẤP)
  // =========================================================================
  if (view === "upgrade") {
    const isUpgrading = subscription?.plan === "standard";
    const standardPrice = plansConfig ? plansConfig.standard.price : 29;
    const premiumPrice = plansConfig ? plansConfig.premium.price : 79;

    // Gói đang được chọn (nếu đang nâng cấp thì bắt buộc chọn premium, còn lại dựa trên selectedPlan)
    const activeSelectedPlan = isUpgrading ? "premium" : selectedPlan;
    const selectedPrice = activeSelectedPlan === "standard" ? standardPrice : premiumPrice;
    
    // Credit chỉ áp dụng khi thực sự nâng cấp từ standard lên premium
    const standardCredit = (isUpgrading && activeSelectedPlan === "premium") ? standardPrice : 0;
    const baseUpgradeFee = selectedPrice - standardCredit;
    const finalUpgradeFee = Math.max(0, baseUpgradeFee - discountAmount);

    return (
      <div className="billing-container">
        <button onClick={() => setView("dashboard")} className="back-btn">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Billing
        </button>

        <div className="billing-title-section">
          <h2>Upgrade Subscription Plan</h2>
          <p className="subtitle">Unlock more resources and features for your workspace.</p>
        </div>



        <div className="upgrade-cards-grid">
          {/* Card Free Plan */}
          <div 
            className={`upgrade-plan-card ${(!subscription || subscription.plan === "free") ? "upgrade-plan-card--selected" : ""} upgrade-plan-card--disabled`}
            style={{ cursor: "default", opacity: 0.8 }}
          >
            <div className="upgrade-plan-title">Free Plan</div>
            <div className="upgrade-plan-price">$0<span>/month</span></div>
            <ul className="features-checklist">
              {Object.entries(PLAN_ENTITLEMENTS.free).map(([key, val]) => (
                <li key={key}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {key === "cpuCores" ? `${val} vCPUs` : key === "memoryGb" ? `${val} GB RAM` : key === "maxAgents" ? `Up to ${val} AI Agents` : `${val} GB Storage`}
                </li>
              ))}
              <li>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Community support
              </li>
            </ul>
            {(!subscription || subscription?.plan === "free") && <span className="plan-mini-badge" style={{ alignSelf: "flex-start", padding: "4px 10px" }}>Current Plan</span>}
          </div>

          {/* Card Standard Plan */}
          <div 
            onClick={() => {
              if (isUpgrading) return; // Đang sử dụng gói này thì không được click chọn lại
              setSelectedPlan("standard");
            }}
            className={`upgrade-plan-card ${activeSelectedPlan === "standard" ? "upgrade-plan-card--selected" : ""} ${isUpgrading ? "upgrade-plan-card--disabled" : ""}`}
          >
            <div className="upgrade-plan-title">Standard Plan</div>
            <div className="upgrade-plan-price">${standardPrice}<span>/month</span></div>
            <ul className="features-checklist">
              {Object.entries(PLAN_ENTITLEMENTS.standard).map(([key, val]) => (
                <li key={key}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {key === "cpuCores" ? `${val} vCPUs` : key === "memoryGb" ? `${val} GB RAM` : key === "maxAgents" ? `Up to ${val} AI Agents` : `${val} GB Storage`}
                </li>
              ))}
              <li>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Standard email support
              </li>
            </ul>
            {subscription?.plan === "standard" && <span className="plan-mini-badge" style={{ alignSelf: "flex-start", padding: "4px 10px" }}>Current Plan</span>}
          </div>

          {/* Card Premium Plan */}
          <div 
            onClick={() => setSelectedPlan("premium")}
            className={`upgrade-plan-card ${activeSelectedPlan === "premium" ? "upgrade-plan-card--selected" : ""} ${activeSelectedPlan === "premium" ? "upgrade-plan-card--recommended" : ""}`}
          >
            <span className="card-badge-pop">Recommended</span>
            <div className="upgrade-plan-title">Premium Plan</div>
            <div className="upgrade-plan-price">${premiumPrice}<span>/month</span></div>
            <ul className="features-checklist">
              {Object.entries(PLAN_ENTITLEMENTS.premium).map(([key, val]) => (
                <li key={key}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {key === "cpuCores" ? `${val} vCPUs` : key === "memoryGb" ? `${val} GB RAM` : key === "maxAgents" ? `Up to ${val} AI Agents` : `${val} GB Storage`}
                </li>
              ))}
              <li>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Priority Support 24/7
              </li>
            </ul>
            {subscription?.plan === "premium" && <span className="plan-mini-badge" style={{ alignSelf: "flex-start", padding: "4px 10px" }}>Current Plan</span>}
          </div>
        </div>

        <div className="grid-2col" style={{ marginTop: "24px" }}>
          {/* Tính toán chi phí thực tế */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Upgrade Cost</h3>
            </div>
            
            <div className="cost-calc-container">
              <div className="calc-row">
                <span>{activeSelectedPlan === "standard" ? "Standard plan price" : "Premium plan price"}</span>
                <span>${selectedPrice.toFixed(2)}</span>
              </div>
              {(isUpgrading && activeSelectedPlan === "premium") && (
                <div className="calc-row calc-row--minus">
                  <span>Standard plan credit</span>
                  <span>-${standardPrice.toFixed(2)}</span>
                </div>
              )}
              {appliedPromo && (
                <div className="calc-row calc-row--minus" style={{ color: "#16a34a", fontWeight: 500 }}>
                  <span>Promo discount ({appliedPromo})</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="promo-row">
                <input 
                  type="text" 
                  placeholder="Mã giảm giá e.g. VCP10" 
                  className="promo-input" 
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                />
                <button onClick={handleApplyPromo} className="promo-btn">Apply</button>
              </div>
              
              <div className="due-block">
                <div className="due-title">
                  <span>Total Due Today</span>
                  <span>${finalUpgradeFee.toFixed(2)}</span>
                </div>
                <div className="due-sub">Then ${selectedPrice.toFixed(2)}/month starting next billing cycle</div>
              </div>
            </div>
          </div>

          {/* Bảng so sánh chi tiết tính năng */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Feature Comparison</h3>
            </div>
            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Free</th>
                    <th>Standard</th>
                    <th style={{ color: "#2563eb", fontWeight: 700 }}>Premium ★</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>CPU</td>
                    <td>2 vCPUs</td>
                    <td>8 vCPUs</td>
                    <td>32 vCPUs</td>
                  </tr>
                  <tr>
                    <td>RAM</td>
                    <td>4 GB</td>
                    <td>16 GB</td>
                    <td>64 GB</td>
                  </tr>
                  <tr>
                    <td>Max Agents</td>
                    <td>2 Agents</td>
                    <td>10 Agents</td>
                    <td>50 Agents</td>
                  </tr>
                  <tr>
                    <td>Workflow Executions</td>
                    <td>50 / mo</td>
                    <td>5,000 / mo</td>
                    <td>Unlimited</td>
                  </tr>
                  <tr>
                    <td>Storage</td>
                    <td>10 GB</td>
                    <td>50 GB</td>
                    <td>500 GB</td>
                  </tr>
                  <tr>
                    <td>Support Level</td>
                    <td>Community</td>
                    <td>Standard</td>
                    <td>Priority 24/7</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Nút bấm xác nhận nâng cấp ở bottom */}
        <div className="billing-card" style={{ marginTop: "24px" }}>
          <div className="confirm-box-row">
            <input 
              type="checkbox" 
              id="confirmUpgrade" 
              className="confirm-checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
            />
            <label htmlFor="confirmUpgrade" className="confirm-box-text">
              Tôi xác nhận rằng tài nguyên workspace sẽ được {activeSelectedPlan === "standard" ? "đăng ký gói Standard" : isUpgrading ? "nâng cấp lên gói Premium" : "đăng ký gói Premium"} ngay lập tức sau khi quá trình thanh toán thành công, và tổng phí là <strong>${finalUpgradeFee.toFixed(2)}</strong> sẽ được áp dụng cho phương thức thanh toán được chọn.
            </label>
          </div>

          <div className="btn-group" style={{ maxWidth: "400px", alignSelf: "flex-end" }}>
            <button onClick={() => setView("dashboard")} className="btn btn--secondary">
              Cancel
            </button>
            <button 
              onClick={() => {
                if (activeSelectedPlan === "standard") {
                  handleInitiateCheckout("standard");
                } else {
                  if (isUpgrading) {
                    handleInitiateUpgrade();
                  } else {
                    handleInitiateCheckout("premium");
                  }
                }
              }} 
              disabled={!agreeToTerms || loading}
              className="btn btn--primary"
            >
              {loading ? "Processing..." : "Confirm & Proceed to Payment →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: PAYMENT CHECKOUT (MÀN HÌNH CHỌN PHƯƠNG THỨC & THANH TOÁN)
  // =========================================================================
  if (view === "checkout" && checkoutData) {
    return (
      <div className="billing-container">
        <button onClick={() => setView(subscription ? "upgrade" : "dashboard")} className="back-btn">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Billing
        </button>

        <div className="billing-title-section">
          <h2>Payment Checkout</h2>
          <p className="subtitle">Hoàn tất thủ tục đăng ký nâng cấp gói của bạn qua API.</p>
        </div>



        <div className="grid-2col">
          {/* CỘT TRÁI: Phương thức thanh toán */}
          <div className="billing-card">
            <div className="card-title-row">
              <h3>Select Payment Method</h3>
            </div>

            <div className="method-list">
              {/* VNPay */}
              <div 
                className={`method-item ${paymentMethod === "vnpay" ? "method-item--selected" : ""}`}
                onClick={() => setPaymentMethod("vnpay")}
              >
                <input 
                  type="radio" 
                  name="pm" 
                  checked={paymentMethod === "vnpay"} 
                  onChange={() => setPaymentMethod("vnpay")}
                  className="method-radio" 
                />
                <span className="method-logo method-logo--vnpay">VNPay</span>
                <div className="method-info">
                  <span className="method-name">VNPay</span>
                  <span className="method-desc">Vietnam Payment Gateway</span>
                </div>
              </div>

              {/* MoMo */}
              <div 
                className={`method-item ${paymentMethod === "momo" ? "method-item--selected" : ""}`}
                onClick={() => setPaymentMethod("momo")}
              >
                <input 
                  type="radio" 
                  name="pm" 
                  checked={paymentMethod === "momo"} 
                  onChange={() => setPaymentMethod("momo")}
                  className="method-radio" 
                />
                <span className="method-logo method-logo--momo">MoMo</span>
                <div className="method-info">
                  <span className="method-name">MoMo</span>
                  <span className="method-desc">MoMo e-Wallet</span>
                </div>
              </div>

              {/* Stripe */}
              <div 
                className={`method-item ${paymentMethod === "stripe" ? "method-item--selected" : ""}`}
                onClick={() => setPaymentMethod("stripe")}
              >
                <input 
                  type="radio" 
                  name="pm" 
                  checked={paymentMethod === "stripe"} 
                  onChange={() => setPaymentMethod("stripe")}
                  className="method-radio" 
                />
                <span className="method-logo method-logo--stripe">Stripe</span>
                <div className="method-info">
                  <span className="method-name">Stripe</span>
                  <span className="method-desc">International Card Payment</span>
                </div>
              </div>

              {/* simulated payment */}
              <div 
                className={`method-item ${paymentMethod === "simulated" ? "method-item--selected" : ""}`}
                onClick={() => setPaymentMethod("simulated")}
              >
                <input 
                  type="radio" 
                  name="pm" 
                  checked={paymentMethod === "simulated"} 
                  onChange={() => setPaymentMethod("simulated")}
                  className="method-radio" 
                />
                <span className="method-logo method-logo--simulated">Mô phỏng</span>
                <div className="method-info">
                  <span className="method-name">Phương thức thanh toán mô phỏng</span>
                  <span className="method-desc">Giả lập thanh toán Sandbox qua API backend</span>
                </div>
                <span className="method-badge">Recommended</span>
              </div>
            </div>

            {/* Form điền thông tin thẻ nếu chọn Stripe */}
            {paymentMethod === "stripe" && (
              <div>
                <h4 style={{ margin: "24px 0 12px 0", fontSize: "0.95rem" }}>Card Details</h4>
                <div className="form-grid">
                  <div className="form-group form-group--full">
                    <label>Card Number</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={cardDetails.expiry} 
                      onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>CVV</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={cardDetails.cvv} 
                      onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })} 
                    />
                  </div>
                  <div className="form-group form-group--full">
                    <label>Name on Card</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={cardDetails.name} 
                      onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Thông báo nếu chọn Mô phỏng */}
            {paymentMethod === "simulated" && (
              <div className="secure-notice" style={{ backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Chế độ thanh toán mô phỏng (Sandbox Mode) đang bật.</strong>
                  <br />
                  Giao dịch sẽ được gọi thực tế qua API `mock-callback` của backend để cập nhật cơ sở dữ liệu thật mà không tốn tiền mặt.
                </div>
              </div>
            )}

            <div className="secure-notice">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>
                <strong>Secure Payment.</strong>
                <br />
                Mọi thông tin thanh toán được mã hóa bảo mật. Nền tảng không lưu trữ thông tin số thẻ hoặc mã CVV của bạn.
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: Order Summary */}
          <div className="order-summary-box">
            <div className="summary-profile-row">
              <div className="profile-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="profile-info">
                <span className="profile-name">Acme Corp</span>
                <span className="profile-email">dev@local.test</span>
              </div>
            </div>

            <div className="cost-calc-container">
              <div className="calc-row">
                <span>Selected Plan</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>
                  {selectedPlanForCheckout === "premium" ? "Premium" : "Standard"}
                </span>
              </div>
              <div className="calc-row">
                <span>Billing Cycle</span>
                <span>Monthly</span>
              </div>
              <div className="calc-row">
                <span>Base Plan Price</span>
                <span>${PLAN_PRICES[selectedPlanForCheckout]}.00</span>
              </div>
              
              {appliedPromo && (
                <div className="calc-row calc-row--minus" style={{ color: "#16a34a", fontWeight: 500 }}>
                  <span>Promo discount ({appliedPromo})</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="calc-row calc-row--total" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <span>Total Due Today</span>
                <span>${checkoutData.amount}.00</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              <button 
                onClick={() => handleProcessPayment("success")}
                className="btn btn--primary"
                style={{ padding: "14px 20px" }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pay Now - ${checkoutData.amount}.00
              </button>

              <button 
                onClick={() => handleProcessPayment("failed")}
                className="btn btn--secondary"
                style={{ color: "#b91c1c", borderColor: "#fca5a5" }}
              >
                Simulate Failed Payment
              </button>
            </div>

            <button 
              onClick={() => setView("dashboard")}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "0.85rem",
                textAlign: "center",
                textDecoration: "underline",
                marginTop: "12px"
              }}
            >
              ← Back to Billing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: PAYMENT SUCCESSFUL (MÀN HÌNH THANH TOÁN THÀNH CÔNG)
  // =========================================================================
  if (view === "success" && lastSuccessPayment) {
    return (
      <div className="billing-container">
        <div className="billing-card success-card">
          <div className="success-icon-circle">
            <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>

          <h2>Payment Successful</h2>
          <p>Gói đăng ký dịch vụ của bạn đã được cập nhật thành công và đang hoạt động.</p>

          <div className="success-table-box">
            <div className="success-row">
              <span className="success-label">PAYMENT ID</span>
              <span className="success-value">{lastSuccessPayment.paymentId}</span>
            </div>
            <div className="success-row">
              <span className="success-label">INVOICE ID</span>
              <span className="success-value">{lastSuccessPayment.invoiceId}</span>
            </div>
            <div className="success-row">
              <span className="success-label">PLAN</span>
              <span className="success-value">{lastSuccessPayment.plan}</span>
            </div>
            <div className="success-row">
              <span className="success-label">AMOUNT PAID</span>
              <span className="success-value">${lastSuccessPayment.amountPaid}.00</span>
            </div>
            <div className="success-row">
              <span className="success-label">SUBSCRIPTION STATUS</span>
              <span className="success-value">
                <span className="status-badge status-badge--active">Active</span>
              </span>
            </div>
            <div className="success-row">
              <span className="success-label">NEXT RENEWAL</span>
              <span className="success-value">{lastSuccessPayment.nextRenewal}</span>
            </div>
          </div>

          <div className="btn-group">
            <button 
              onClick={() => {
                setView("dashboard");
                setLastSuccessPayment(null);
                setCheckoutData(null);
              }} 
              className="btn btn--secondary"
            >
              Go to Billing Dashboard
            </button>
            <button 
              onClick={() => alert(`Đang tải xuống hóa đơn ${lastSuccessPayment.invoiceId}`)}
              className="btn btn--primary"
            >
              Download Invoice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default SubscriptionPaymentPage;
