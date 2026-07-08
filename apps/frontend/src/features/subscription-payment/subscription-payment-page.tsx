import { useEffect, useState, useRef, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { subscriptionPaymentApiClient } from "./subscription-payment-api-client.ts";
import "./subscription-payment.css";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_51TV0ysKDcON4VlVG8vHKXAPEYCpL3IDDHKkCsoaveXzRqAMM3FMGGKE9OMixc2H7LuKvBqAa2pJi8NNORdMbj0Rj00Y0xPS2gn");
import type {
  SubscriptionPublicSummary,
  TransactionPublicSummary,
  WorkspaceResourceUsageResponse,
  SubscriptionPlansResponse
} from "@vcp/shared/contracts/subscription-payment.ts";

const StripeBindingForm = ({ 
  workspaceId, 
  onSuccess, 
  onCancel 
}: { 
  workspaceId: string; 
  onSuccess: () => void; 
  onCancel: () => void; 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Gọi API backend tạo SetupIntent
      const res = await subscriptionPaymentApiClient.createStripeSetupIntent(workspaceId);
      const clientSecret = res.clientSecret;

      // 2. Lấy thẻ nhập từ Stripe Elements
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) throw new Error("Không tìm thấy form nhập thẻ Stripe.");

      // 3. Xác thực thẻ và nhận PaymentMethod ID từ Stripe
      const setupResult = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: "Stripe Test User"
          }
        }
      });

      if (setupResult.error) {
        throw new Error(setupResult.error.message);
      }

      // 4. Lưu thẻ thành công lên backend DB
      const pm = setupResult.setupIntent.payment_method;
      const paymentMethodId = typeof pm === "string" ? pm : (pm && typeof pm === "object" ? (pm as any).id : null);
      if (!paymentMethodId) {
        throw new Error("Không nhận được mã thẻ hợp lệ từ Stripe.");
      }
      await subscriptionPaymentApiClient.confirmStripeBinding(workspaceId, paymentMethodId);

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Xác thực liên kết thẻ Stripe thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const elementOptions = {
    style: {
      base: {
        fontSize: "15px",
        color: "#1e293b",
        fontFamily: "Outfit, Inter, sans-serif",
        "::placeholder": {
          color: "#94a3b8"
        }
      },
      invalid: {
        color: "#ef4444"
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "14px" }}>
      <div className="form-group" style={{ marginBottom: "14px" }}>
        <label>Số thẻ quốc tế (Stripe)</label>
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
          <CardNumberElement options={elementOptions} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Ngày hết hạn (MM/YY)</label>
          <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
            <CardExpiryElement options={elementOptions} />
          </div>
        </div>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Mã CVC/CVV</label>
          <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
            <CardCvcElement options={elementOptions} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "14px", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "6px" }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn--primary" disabled={!stripe || loading}>
          {loading ? "Đang xử lý..." : "Lưu thẻ Quốc tế"}
        </button>
      </div>
    </form>
  );
};

const StripeCheckoutForm = ({
  workspaceId,
  plan,
  promoCode,
  amount,
  onSuccess,
  onCancel,
  savedMethodId
}: {
  workspaceId: string;
  plan: string;
  promoCode?: string;
  amount: number;
  onSuccess: (transactionId: string) => void;
  onCancel: () => void;
  savedMethodId: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      let paymentMethodId = savedMethodId;

      if (savedMethodId === "new_method") {
        if (!stripe || !elements) return;

        // 1. Khởi tạo SetupIntent liên kết thẻ
        const res = await subscriptionPaymentApiClient.createStripeSetupIntent(workspaceId);
        const clientSecret = res.clientSecret;

        const cardNumberElement = elements.getElement(CardNumberElement);
        if (!cardNumberElement) throw new Error("Không tìm thấy form nhập thẻ Stripe.");

        // 2. Xác thực thẻ qua Stripe
        const setupResult = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: cardNumberElement,
            billing_details: {
              name: "Stripe Checkout User"
            }
          }
        });

        if (setupResult.error) {
          throw new Error(setupResult.error.message);
        }

        const pm = setupResult.setupIntent.payment_method;
        paymentMethodId = typeof pm === "string" ? pm : (pm && typeof pm === "object" ? (pm as any).id : null);
        if (!paymentMethodId) {
          throw new Error("Không nhận được mã thẻ hợp lệ từ Stripe.");
        }
      }

      // 3. Trừ tiền trực tiếp bằng Token Stripe qua backend
      const chargeRes = await subscriptionPaymentApiClient.chargeStripePayment(
        workspaceId,
        plan,
        paymentMethodId,
        promoCode || undefined
      );

      if (chargeRes.success) {
        onSuccess(chargeRes.transactionId);
      }
    } catch (err: any) {
      setError(err.message || "Thanh toán Stripe thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const elementOptions = {
    style: {
      base: {
        fontSize: "15px",
        color: "#1e293b",
        fontFamily: "Outfit, Inter, sans-serif",
        "::placeholder": {
          color: "#94a3b8"
        }
      },
      invalid: {
        color: "#ef4444"
      }
    }
  };

  return (
    <form onSubmit={handlePay}>
      {savedMethodId === "new_method" && (
        <div style={{ marginTop: "12px" }}>
          <div className="form-group" style={{ marginBottom: "14px" }}>
            <label>Số thẻ quốc tế (Stripe)</label>
            <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
              <CardNumberElement options={elementOptions} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Ngày hết hạn (MM/YY)</label>
              <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
                <CardExpiryElement options={elementOptions} />
              </div>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Mã CVC/CVV</label>
              <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "12px", background: "#f8fafc" }}>
                <CardCvcElement options={elementOptions} />
              </div>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "14px", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "6px" }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <button 
          type="button" 
          className="btn btn--secondary" 
          onClick={onCancel} 
          disabled={loading}
          style={{ padding: "14px 20px" }}
        >
          Quay lại
        </button>
        <button 
          type="submit" 
          className="btn btn--primary" 
          style={{ flex: 1, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }} 
          disabled={loading}
        >
          {loading ? (
            "Đang xử lý..."
          ) : (
            <>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Pay Now - ${amount}.00
            </>
          )}
        </button>
      </div>
    </form>
  );
};
import { PLAN_ENTITLEMENTS, PLAN_PRICES } from "@vcp/shared/contracts/plans.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { useToast } from "../../components/shared/Toast.tsx";

type ViewState = "dashboard" | "upgrade" | "checkout" | "success";

const AVAILABLE_WORKSPACES = [
  { id: "workspace-product-demo",    name: "Product Demo" },
  { id: "workspace-marketing-dept",  name: "Marketing Dept." },
  { id: "workspace-engineering-team",name: "Engineering Team" },
  { id: "workspace-sales-operations",name: "Sales & Ops" },
];

const detectBrand = (num: string): "visa" | "mastercard" | "jcb" | "amex" => {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^35/.test(n)) return "jcb";
  return "visa";
};

export function SubscriptionPaymentPage() {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionPublicSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionPublicSummary[]>([]);
  const [resourceUsage, setResourceUsage] = useState<WorkspaceResourceUsageResponse | null>(null);
  const [plansConfig, setPlansConfig] = useState<SubscriptionPlansResponse | null>(null);
  
  // State quản lý Workspace ID động được chọn từ Dropdown
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(DEMO_WORKSPACE_ID);

  // Custom Dropdown states & refs
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);

  // Click-outside: đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Xử lý phím bàn phím cho Custom Dropdown
  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsDropdownOpen(true);
        setFocusedIndex(AVAILABLE_WORKSPACES.findIndex(ws => ws.id === currentWorkspaceId));
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => (prev < AVAILABLE_WORKSPACES.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : AVAILABLE_WORKSPACES.length - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < AVAILABLE_WORKSPACES.length) {
          setCurrentWorkspaceId(AVAILABLE_WORKSPACES[focusedIndex].id);
          setIsDropdownOpen(false);
          setFocusedIndex(-1);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsDropdownOpen(false);
        setFocusedIndex(-1);
        break;
    }
  }, [isDropdownOpen, focusedIndex, currentWorkspaceId]);

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

  interface PaymentMethodInfo {
    id: string;
    type: "card" | "vnpay";
    brand?: "visa" | "mastercard" | "jcb" | "amex";
    last4: string;
    expiry?: string;
    holder: string;
    isDefault: boolean;
  }

  // State danh sách các phương thức thanh toán đã lưu (thẻ, ví VNPay)
  const [savedCards, setSavedCards] = useState<PaymentMethodInfo[]>([]);

  // State phương thức thanh toán đang chọn trên màn hình checkout
  const [paymentMethod, setPaymentMethod] = useState<"vnpay" | "stripe" | "simulated">("stripe");

  // State lưu ID của phương thức thanh toán đã chọn (đã thêm sẵn hoặc chọn thêm mới)
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState<string | "new_method">("new_method");

  // State Modal thêm/đổi phương thức thanh toán
  const [showCardModal, setShowCardModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState<"card" | "vnpay">("card");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardHolder, setNewCardHolder] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [cardFormError, setCardFormError] = useState<string | null>(null);

  // State lưu thông tin thẻ nhập vào trong form thanh toán Stripe
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: ""
  });

  // Các state khác liên quan đến checkout & plan
  const [agreeToTerms, setAgreeToTerms] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"standard" | "premium">("premium");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // State lưu hóa đơn thành công vừa thanh toán để hiển thị màn hình Success
  const [lastSuccessPayment, setLastSuccessPayment] = useState<{
    paymentId: string;
    invoiceId: string;
    plan: string;
    amountPaid: number;
    nextRenewal: string;
    gateway: "stripe" | "vnpay" | "simulated";
  } | null>(null);

  // Fetch dữ liệu thật từ API backend theo Workspace ID động
  const fetchDetails = async (wsId: string = currentWorkspaceId) => {
    try {
      setLoading(true);
      
      // Gọi song song API lấy Subscription, Resource Usage và Plans
      const [detailsData, usageData, plansData] = await Promise.all([
        subscriptionPaymentApiClient.getSubscriptionDetails(wsId),
        subscriptionPaymentApiClient.getWorkspaceResourceUsage(wsId),
        subscriptionPaymentApiClient.getPlans()
      ]);

      setSubscription(detailsData.subscription);
      setTransactions(detailsData.transactions);
      setResourceUsage(usageData);
      setPlansConfig(plansData);

      // Đồng bộ danh sách phương thức thanh toán nhiều loại từ API backend DB vào localStorage
      const localCardsKey = `vcp_cards_${wsId}`;
      let list: PaymentMethodInfo[] = [];

      if ((detailsData as any).paymentMethods && (detailsData as any).paymentMethods.length > 0) {
        list = (detailsData as any).paymentMethods.map((pm: any) => ({
          id: pm.id,
          type: pm.type,
          last4: pm.last4,
          brand: pm.brand || (pm.type === "vnpay" ? "ncb" : undefined),
          expiry: pm.expiry || "07/15",
          holder: pm.holder,
          isDefault: pm.isDefault
        }));
      } else if (detailsData.subscription?.cardNumber) {
        // Fallback từ subscription cardNumber
        const rawNum = detailsData.subscription.cardNumber.replace(/\s/g, "");
        const isWalletVnpay = detailsData.subscription.cardNumber.toLowerCase().includes("vnpay");
        
        const dbCard: PaymentMethodInfo = {
          id: `card_${Date.now()}`,
          type: isWalletVnpay ? "vnpay" : "card",
          last4: rawNum.slice(-4),
          brand: isWalletVnpay ? "NCB" : detectBrand(detailsData.subscription.cardNumber),
          expiry: isWalletVnpay ? "07/15" : (detailsData.subscription.cardExpiry || "12/28"),
          holder: detailsData.subscription.cardHolder || "Admin Wu",
          isDefault: true
        };
        list = [dbCard];
      }

      localStorage.setItem(localCardsKey, JSON.stringify(list));

      setSavedCards(list);
      
      if (detailsData.subscription) {
        setAutoRenew(detailsData.subscription.autoRenew);
      } else {
        setAutoRenew(true);
      }
    } catch (err: any) {
      showError(err.message || "Không thể tải thông tin thanh toán từ API.");
    } finally {
      setLoading(false);
    }
  };

  // Reload thông tin khi chuyển đổi Workspace
  useEffect(() => {
    fetchDetails(currentWorkspaceId);
  }, [currentWorkspaceId]);

  // Lắng nghe URL params từ callback VNPay redirect về
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vnpayStatus = params.get("vnpay");
    
    if (vnpayStatus) {
      if (vnpayStatus === "success") {
        showSuccess("Thanh toán qua VNPay thành công! Gói dịch vụ của bạn đã được kích hoạt.");
        // Chuyển hướng sạch URL để không bị reload lặp lại
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchDetails(currentWorkspaceId);
      } else if (vnpayStatus === "failed") {
        showError("Giao dịch thanh toán VNPay đã bị hủy bỏ hoặc thất bại.");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (vnpayStatus === "error") {
        const msg = params.get("message") || "Lỗi thanh toán";
        showError(`Lỗi kết nối VNPay: ${decodeURIComponent(msg)}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Tự động điền thông tin và chọn phương thức mặc định khi chuyển sang view checkout
  useEffect(() => {
    if (view === "checkout") {
      const defaultMethod = savedCards.find(c => c.isDefault);
      if (defaultMethod && defaultMethod.type === "vnpay") {
        setSelectedSavedMethodId(defaultMethod.id);
        setPaymentMethod("vnpay");
      } else {
        setSelectedSavedMethodId("new_method");
        setPaymentMethod("vnpay");
      }
    }
  }, [view, savedCards]);
  // Thay đổi Auto-Renewal qua API thật
  const handleToggleAutoRenew = async (checked: boolean) => {
    try {
      await subscriptionPaymentApiClient.toggleAutoRenewal(currentWorkspaceId, checked);
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
      await subscriptionPaymentApiClient.toggleAutoRenewal(currentWorkspaceId, false);
      setAutoRenew(false);
      showSuccess("Đã hủy tự động gia hạn thành công.");
      await fetchDetails(currentWorkspaceId);
    } catch (err: any) {
      showError(err.message || "Không thể hủy tự động gia hạn.");
    } finally {
      setLoading(false);
    }
  };


  // Thêm phương thức thanh toán mới vào danh sách
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardFormError(null);

    // Validate theo loại hình thức thanh toán
    const digits = newCardNumber.replace(/\s/g, "");
    if (digits.length < 13 || digits.length > 19) {
      setCardFormError("Số thẻ không hợp lệ (13–19 chữ số).");
      return;
    }
    if (!newCardHolder.trim()) {
      setCardFormError("Vui lòng nhập tên chủ thẻ.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(newCardExpiry)) {
      setCardFormError("Định dạng MM/YY không hợp lệ.");
      return;
    }

    try {
      setLoading(true);
      const localCardsKey = `vcp_cards_${currentWorkspaceId}`;
      const cached = localStorage.getItem(localCardsKey);
      const currentList: PaymentMethodInfo[] = cached ? JSON.parse(cached) : [];

      // Phương thức đầu tiên tự động làm mặc định
      const isDefault = currentList.length === 0;

      let newMethod: PaymentMethodInfo;
      if (newMethodType === "card" || newMethodType === "vnpay") {
        const digits = newCardNumber.replace(/\s/g, "");
        newMethod = {
          id: `card_${Date.now()}`,
          type: newMethodType,
          last4: digits.slice(-4),
          brand: newMethodType === "vnpay" ? "ncb" : detectBrand(newCardNumber),
          expiry: newCardExpiry,
          holder: newCardHolder.trim(),
          isDefault
        };
      }

      const updatedList = [...currentList, newMethod];
      localStorage.setItem(localCardsKey, JSON.stringify(updatedList));
      setSavedCards(updatedList);

      // Luôn đồng bộ thông tin phương thức thanh toán mới lên DB backend
      const dbCardNumber = newMethod.type === "card" 
        ? newCardNumber 
        : `VNPay: •••• •••• •••• ${newMethod.last4}`;

      await subscriptionPaymentApiClient.updatePaymentMethod(
        currentWorkspaceId,
        dbCardNumber,
        newMethod.holder,
        newMethod.expiry || ""
      );

      // Reset states
      setShowCardModal(false);
      setNewCardNumber("");
      setNewCardHolder("");
      setNewCardExpiry("");

      showSuccess(`Đã thêm phương thức thanh toán ${newMethodType === "card" ? "thẻ" : newMethodType.toUpperCase()} mới.`);
    } catch (err: any) {
      showError(err.message || "Không thể thêm phương thức thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  // Đặt phương thức thanh toán làm mặc định
  const handleSetDefaultCard = async (cardId: string) => {
    try {
      setLoading(true);
      const localCardsKey = `vcp_cards_${currentWorkspaceId}`;
      const cached = localStorage.getItem(localCardsKey);
      if (!cached) return;

      let currentList: PaymentMethodInfo[] = JSON.parse(cached);
      const targetCard = currentList.find(c => c.id === cardId);
      if (!targetCard) return;

      // Cập nhật thuộc tính isDefault
      currentList = currentList.map(c => ({
        ...c,
        isDefault: c.id === cardId
      }));

      localStorage.setItem(localCardsKey, JSON.stringify(currentList));
      setSavedCards(currentList);

      // Đồng bộ thông tin mặc định mới lên DB backend
      const dbCardNumber = targetCard.type === "card"
        ? `•••• •••• •••• ${targetCard.last4}`
        : `VNPay: •••• •••• •••• ${targetCard.last4}`;

      await subscriptionPaymentApiClient.updatePaymentMethod(
        currentWorkspaceId,
        dbCardNumber,
        targetCard.holder,
        targetCard.expiry || ""
      );

      showSuccess(`Đã đặt phương thức ${targetCard.type === "card" ? "thẻ" : targetCard.type.toUpperCase()} làm mặc định.`);
    } catch (err: any) {
      showError(err.message || "Không thể đặt làm mặc định.");
    } finally {
      setLoading(false);
    }
  };

  // Xóa phương thức thanh toán khỏi danh sách
  const handleRemoveCard = async (cardId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa phương thức thanh toán này không?")) return;

    try {
      setLoading(true);
      
      // Gọi API thật xóa phương thức thanh toán trên DB backend
      try {
        await subscriptionPaymentApiClient.deletePaymentMethod(currentWorkspaceId, cardId);
      } catch (backendErr) {
        console.warn("Lỗi đồng bộ xóa thẻ trên backend (đã bỏ qua):", backendErr);
      }

      const localCardsKey = `vcp_cards_${currentWorkspaceId}`;
      const cached = localStorage.getItem(localCardsKey);
      if (!cached) return;

      const currentList: PaymentMethodInfo[] = JSON.parse(cached);
      const targetCard = currentList.find(c => c.id === cardId);
      if (!targetCard) return;

      const updatedList = currentList.filter(c => c.id !== cardId);

      // Nếu bị xóa là mặc định, và vẫn còn các phương thức khác
      if (targetCard.isDefault && updatedList.length > 0) {
        // Tự động chọn cái đầu tiên còn lại làm mặc định
        updatedList[0].isDefault = true;
        
        const dbCardNumber = updatedList[0].type === "card"
          ? `•••• •••• •••• ${updatedList[0].last4}`
          : `VNPay: •••• •••• •••• ${updatedList[0].last4}`;

        await subscriptionPaymentApiClient.updatePaymentMethod(
          currentWorkspaceId,
          dbCardNumber,
          updatedList[0].holder,
          updatedList[0].expiry || ""
        );
      } else if (updatedList.length === 0) {
        // Nếu không còn gì, xóa hẳn trên backend
        await subscriptionPaymentApiClient.updatePaymentMethod(
          currentWorkspaceId,
          "",
          "",
          ""
        );
      }

      localStorage.setItem(localCardsKey, JSON.stringify(updatedList));
      setSavedCards(updatedList);
      showSuccess("Đã xóa phương thức thanh toán thành công.");
    } catch (err: any) {
      showError(err.message || "Không thể xóa thẻ.");
    } finally {
      setLoading(false);
      // Reload dữ liệu thật từ API
      await fetchDetails(currentWorkspaceId);
    }
  };

  // Hủy gói dịch vụ hoạt động
  const handleCancelSubscription = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn HỦY gói dịch vụ hiện tại không? Gói của bạn sẽ bị hạ cấp ngay về gói Free.")) return;
    try {
      setLoading(true);
      await subscriptionPaymentApiClient.cancelSubscription(currentWorkspaceId);
      showSuccess("Hủy gói dịch vụ thành công! Workspace của bạn đã được chuyển về gói Free.");
    } catch (err: any) {
      showError(err.message || "Không thể hủy gói dịch vụ.");
    } finally {
      setLoading(false);
      await fetchDetails(currentWorkspaceId);
    }
  };

  // Khởi động liên kết thẻ thực tế qua VNPay Sandbox
  const handleInitiateVnPayBinding = async () => {
    try {
      setLoading(true);
      const returnUrl = `${window.location.origin}${window.location.pathname}?vnpay=success`;
      const res = await subscriptionPaymentApiClient.initiateVnPayBinding(currentWorkspaceId, returnUrl);
      window.location.href = res.checkoutUrl;
    } catch (err: any) {
      showError(err.message || "Không thể khởi tạo liên kết thẻ VNPay.");
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
      
      const res = await subscriptionPaymentApiClient.initiateCheckout(currentWorkspaceId, plan, appliedPromo || undefined);
      
      const baseAmount = PLAN_PRICES[plan];
      const actualAmount = Math.max(0, baseAmount - discountAmount);

      setCheckoutData({
        transactionId: res.transactionId,
        subscriptionId: res.subscriptionId,
        checkoutUrl: res.checkoutUrl,
        amount: actualAmount
      });

      // Tự động chọn phương thức mặc định đã lưu (chỉ chọn VNPay)
      const defaultMethod = savedCards.find(c => c.isDefault && c.type === "vnpay");
      if (defaultMethod) {
        setSelectedSavedMethodId(defaultMethod.id);
        setPaymentMethod("vnpay");
      } else {
        setSelectedSavedMethodId("new_method");
        setPaymentMethod("vnpay");
      }

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

      // Tự động chọn phương thức mặc định đã lưu (chỉ chọn VNPay)
      const defaultMethod = savedCards.find(c => c.isDefault && c.type === "vnpay");
      if (defaultMethod) {
        setSelectedSavedMethodId(defaultMethod.id);
        setPaymentMethod("vnpay");
      } else {
        setSelectedSavedMethodId("new_method");
        setPaymentMethod("vnpay");
      }

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
    
    if (paymentMethod === "vnpay" && status === "success") {
      try {
        setLoading(true);
        const res = await subscriptionPaymentApiClient.initiateVnPayCheckout(
          currentWorkspaceId,
          selectedPlanForCheckout,
          appliedPromo || undefined
        );
        window.location.href = res.checkoutUrl;
        return;
      } catch (err: any) {
        showError(err.message || "Không thể khởi tạo thanh toán VNPay Sandbox.");
        setLoading(false);
        return;
      }
    }

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
          nextRenewal: nextRenewalDate,
          gateway: paymentMethod as "stripe" | "vnpay" | "simulated"
        });

        // Nếu thanh toán bằng phương thức mới, tự động liên kết và lưu phương thức đó vào Workspace
        if (selectedSavedMethodId === "new_method" && paymentMethod !== "simulated") {
          const localCardsKey = `vcp_cards_${currentWorkspaceId}`;
          const cached = localStorage.getItem(localCardsKey);
          const currentList: PaymentMethodInfo[] = cached ? JSON.parse(cached) : [];
          
          // Đặt làm mặc định nếu danh sách trống hoặc tất cả đều chưa có
          const isDefault = currentList.length === 0;
          if (isDefault) {
            currentList.forEach(c => c.isDefault = false);
          }

          let newMethod: PaymentMethodInfo;
          if (paymentMethod === "stripe") {
            const digits = cardDetails.number.replace(/\s/g, "");
            newMethod = {
              id: `card_${Date.now()}`,
              type: "card",
              last4: digits.length >= 4 ? digits.slice(-4) : "4321",
              brand: detectBrand(cardDetails.number),
              expiry: cardDetails.expiry || "12/28",
              holder: cardDetails.name || "Chủ Thẻ Mới",
              isDefault: true
            };
          } else {
            const digits = cardDetails.number.replace(/\s/g, "");
            newMethod = {
              id: `card_${Date.now()}`,
              type: paymentMethod === "vnpay" ? "vnpay" : "card",
              last4: digits.length >= 4 ? digits.slice(-4) : "0000",
              holder: cardDetails.name || newCardHolder || "Chủ Thẻ Mới",
              isDefault: true
            };
          }

          // Cập nhật các phương thức khác thành không mặc định
          const updatedList = currentList.map(c => ({ ...c, isDefault: false }));
          updatedList.push(newMethod);

          localStorage.setItem(localCardsKey, JSON.stringify(updatedList));
          setSavedCards(updatedList);

          // Đồng bộ phương thức mặc định mới lên DB backend
          const dbCardNumber = newMethod.type === "card" 
            ? cardDetails.number 
            : `VNPay: •••• •••• •••• ${newMethod.last4}`;

          await subscriptionPaymentApiClient.updatePaymentMethod(
            currentWorkspaceId,
            dbCardNumber,
            newMethod.holder,
            newMethod.expiry || ""
          );
        }
        
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
      // Chờ 1 giây để background worker của backend hoàn tất đối soát giao dịch
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Reload dữ liệu thật từ API theo Workspace đang chọn
      await fetchDetails(currentWorkspaceId);
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

  const isSubActive = subscription && 
    (subscription.status === "active" || subscription.status === "expiring_soon") &&
    new Date(subscription.expiresAt).getTime() > Date.now();
  const activePlan = isSubActive && subscription ? subscription.plan : "free";
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
        <div className="billing-title-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2>Billing & Subscription</h2>
            <p className="subtitle">Quản lý gói dịch vụ, tài nguyên và thanh toán của Workspace.</p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>Workspace hiện tại</span>
            <div
              ref={selectRef}
              className={`custom-select-container ${isDropdownOpen ? "is-open" : ""}`}
              onKeyDown={handleDropdownKeyDown}
            >
              <button
                type="button"
                className="custom-select-trigger"
                onClick={() => {
                  setIsDropdownOpen(prev => !prev);
                  if (!isDropdownOpen) {
                    setFocusedIndex(AVAILABLE_WORKSPACES.findIndex(ws => ws.id === currentWorkspaceId));
                  }
                }}
                aria-haspopup="listbox"
                aria-expanded={isDropdownOpen}
              >
                {/* Workspace icon */}
                <div className="custom-select-trigger-icon">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                  {AVAILABLE_WORKSPACES.find(ws => ws.id === currentWorkspaceId)?.name ?? currentWorkspaceId}
                </span>
                <svg className="custom-select-arrow" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <div className="custom-select-options" role="listbox" aria-label="Chọn workspace">
                <div className="custom-select-options-header">Workspaces</div>
                {AVAILABLE_WORKSPACES.map((ws, idx) => (
                  <div
                    key={ws.id}
                    role="option"
                    aria-selected={ws.id === currentWorkspaceId}
                    className={`custom-select-option ${ws.id === currentWorkspaceId ? "is-selected" : ""} ${focusedIndex === idx ? "is-focused" : ""}`}
                    onClick={() => {
                      setCurrentWorkspaceId(ws.id);
                      setIsDropdownOpen(false);
                      setFocusedIndex(-1);
                    }}
                    onMouseEnter={() => setFocusedIndex(idx)}
                  >
                    <span className="custom-select-option-dot" />
                    {ws.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                ${isSubActive && subscription ? (plansConfig ? plansConfig[subscription.plan].price : PLAN_PRICES[subscription.plan]) : 0}
              </span>
              <span className="price-unit"> / month</span>
            </div>

            <div className="info-sub-grid">
              <div className="info-item">
                <span className="info-label">Plan</span>
                <span className="info-value">
                  {isSubActive && subscription ? `${subscription.plan.toUpperCase()} Plan` : "FREE Plan"}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Start Date</span>
                <span className="info-value">
                  {isSubActive && subscription ? formatDate(subscription.createdAt) : "—"}
                </span>
              </div>
              <div className="info-item" style={{ gridColumn: "span 2" }}>
                <span className="info-label">Renewal Date</span>
                <span className="info-value">
                  {isSubActive && subscription ? formatDate(subscription.expiresAt) : "—"}
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
              
              {subscription?.status === "pending" ? (
                <button 
                  onClick={() => {
                    const tx = transactions.find(t => t.status === "pending");
                    if (tx) {
                      setSelectedPlanForCheckout(subscription.plan);
                      setCheckoutData({
                        transactionId: tx.transactionId,
                        subscriptionId: subscription.subscriptionId,
                        checkoutUrl: `/sandbox-checkout?transactionId=${tx.transactionId}`,
                        amount: tx.amount
                      });

                      // Tự động chọn phương thức mặc định đã lưu
                      const defaultMethod = savedCards.find(c => c.isDefault);
                      if (defaultMethod) {
                        if (defaultMethod.type === "vnpay") setPaymentMethod("vnpay");
                        else setPaymentMethod("stripe");
                      }

                      setView("checkout");
                    } else {
                      setView("upgrade");
                    }
                  }} 
                  className="btn btn--primary"
                  style={{ background: "#e11d48", borderColor: "#e11d48", color: "#ffffff" }}
                >
                  Thanh toán gói đang chờ ({subscription.plan.toUpperCase()})
                </button>
              ) : subscription?.plan === "standard" ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setView("upgrade")} className="btn btn--primary">
                    Upgrade Plan
                  </button>
                  {isSubActive && (
                    <button 
                      onClick={handleCancelSubscription} 
                      className="btn btn--secondary"
                      style={{ color: "#ef4444", borderColor: "#ef4444" }}
                    >
                      Hủy gói
                    </button>
                  )}
                </div>
              ) : !subscription ? (
                <button onClick={() => setView("upgrade")} className="btn btn--primary">
                  Select a Plan
                </button>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button disabled className="btn btn--primary" style={{ opacity: 0.6 }}>
                    Premium Active
                  </button>
                  {isSubActive && (
                    <button 
                      onClick={handleCancelSubscription} 
                      className="btn btn--secondary"
                      style={{ color: "#ef4444", borderColor: "#ef4444" }}
                    >
                      Hủy gói
                    </button>
                  )}
                </div>
              )}
            </div>

            {subscription?.status === "pending" && (
              <div style={{ background: "#fff1f2", border: "1px solid #ffe4e6", color: "#e11d48", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Bạn có một giao dịch đăng ký gói <strong>{subscription.plan.toUpperCase()}</strong> đang chờ thanh toán.</span>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: Phương thức thanh toán (Hỗ trợ nhiều thẻ) */}
          <div className="billing-card">
            <div className="card-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Payment Method</h3>
              {savedCards.length > 0 && (
                <button
                  className="btn btn--secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem", borderRadius: "999px" }}
                  onClick={() => {
                    setNewMethodType("card");
                    setCardFormError(null);
                    setShowCardModal(true);
                  }}
                >
                  + Thêm phương thức
                </button>
              )}
            </div>

            {savedCards.length > 0 ? (
              /* === HIỂN THỊ DANH SÁCH PHƯƠNG THỨC THANH TOÁN === */
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {savedCards.map((card) => (
                  <div
                    key={card.id}
                    className={`saved-card-display ${card.isDefault ? "saved-card-display--default" : ""}`}
                    style={{
                      border: card.isDefault ? "1.5px solid #bfdbfe" : "1.5px solid #f1f5f9",
                      background: card.isDefault ? "#fefefe" : "#ffffff",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      position: "relative",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div className="saved-card-brand-row" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {card.type === "card" ? (
                          <>
                            {card.brand === "visa" && <div className="card-brand-badge card-brand-badge--visa">VISA</div>}
                            {card.brand === "mastercard" && <div className="card-brand-badge card-brand-badge--mc">MC</div>}
                            {card.brand === "jcb" && <div className="card-brand-badge card-brand-badge--jcb">JCB</div>}
                            {card.brand === "amex" && <div className="card-brand-badge card-brand-badge--amex">AMEX</div>}
                            <span className="saved-card-masked">•••• {card.last4}</span>
                          </>
                        ) : (
                          <>
                            <div style={{ background: "#2b6cb0", color: "#ffffff", fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>VNPAY</div>
                            <span className="saved-card-masked">•••• •••• •••• {card.last4}</span>
                          </>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {card.isDefault ? (
                          <span style={{ fontSize: "0.7rem", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "999px", fontWeight: 700, letterSpacing: "0.02em" }}>
                            MẶC ĐỊNH
                          </span>
                        ) : (
                          <button
                            className="btn"
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.7rem",
                              background: "transparent",
                              border: "1px solid #cbd5e1",
                              color: "#64748b",
                              borderRadius: "999px",
                              cursor: "pointer"
                            }}
                            onClick={() => handleSetDefaultCard(card.id)}
                          >
                            Đặt mặc định
                          </button>
                        )}

                        {/* Nút xóa phương thức thanh toán */}
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center"
                          }}
                          onClick={() => handleRemoveCard(card.id)}
                          aria-label="Xóa phương thức"
                          title="Xóa phương thức"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
                      <div>
                        <span style={{ display: "block", fontSize: "0.6rem", color: "#94a3b8", textTransform: "uppercase" }}>
                          {card.type === "card" ? "Chủ thẻ" : "Chủ ví"}
                        </span>
                        <strong style={{ color: "#334155" }}>{card.holder}</strong>
                      </div>
                      {card.type === "card" && (
                        <div style={{ textAlign: "right" }}>
                          <span style={{ display: "block", fontSize: "0.6rem", color: "#94a3b8", textTransform: "uppercase" }}>Hết hạn</span>
                          <strong style={{ color: "#334155" }}>{card.expiry}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* === CHƯA CÓ THẺ: empty state === */
              <div className="no-card-state">
                <div className="no-card-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                    <path d="M6 15h4" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="no-card-title">Chưa có phương thức thanh toán</p>
                <p className="no-card-sub">Thêm thẻ hoặc liên kết ví để thanh toán tự động dễ dàng hơn.</p>
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setNewMethodType("card");
                    setCardFormError(null);
                    setShowCardModal(true);
                  }}
                >
                  + Thêm phương thức
                </button>
              </div>
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
                {isSubActive && subscription ? `${subscription.plan.toUpperCase()} Plan Quota` : "FREE Plan Quota"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "-8px", marginBottom: "16px" }}>
              Định mức sử dụng tài nguyên được quản lý theo Workspace: <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#2563eb" }}>{currentWorkspaceId}</code>
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
              <div className={`plan-mini-item ${activePlan === "free" ? "plan-mini-item--active" : ""}`}>
                <div>
                  <div className="plan-mini-name">
                    Free Plan
                    {activePlan === "free" && <span className="plan-mini-badge">Current</span>}
                  </div>
                  <div className="plan-mini-price">$0 / month — 2 vCPUs, 4GB RAM, 2 Agents, 10GB Storage</div>
                </div>
              </div>

              <div className={`plan-mini-item ${activePlan === "standard" ? "plan-mini-item--active" : ""}`}>
                <div>
                  <div className="plan-mini-name">
                    Standard Plan
                    {activePlan === "standard" && <span className="plan-mini-badge">Current</span>}
                  </div>
                  <div className="plan-mini-price">${plansConfig ? plansConfig.standard.price : 29} / month — 8 vCPUs, 16GB RAM, 10 Agents, 50GB Storage</div>
                </div>
                {activePlan === "free" && (
                  <button onClick={() => handleInitiateCheckout("standard")} className="btn btn--secondary" style={{ width: "auto" }}>Buy</button>
                )}
              </div>

              <div className={`plan-mini-item ${activePlan === "premium" ? "plan-mini-item--active" : ""}`}>
                <div>
                  <div className="plan-mini-name">
                    Premium Plan
                    {activePlan === "premium" && <span className="plan-mini-badge">Current</span>}
                  </div>
                  <div className="plan-mini-price">${plansConfig ? plansConfig.premium.price : 79} / month — 32 vCPUs, 64GB RAM, 50 Agents, 500GB Storage</div>
                </div>
                {activePlan === "standard" ? (
                  <button onClick={() => setView("upgrade")} className="btn btn--primary" style={{ width: "auto" }}>Upgrade</button>
                ) : activePlan === "free" ? (
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

        {/* MODAL THÊM/ĐỔI THẺ THANH TOÁN */}
        {showCardModal && (
          <div className="card-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCardModal(false); }}>
            <div className="card-modal-content">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <h3 style={{ margin: 0 }}>Liên kết phương thức thanh toán</h3>
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}
                  aria-label="Đóng"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <p className="card-modal-sub">Chọn hình thức thanh toán và nhập thông tin để liên kết tài khoản.</p>

              {/* Selector chọn Loại hình thức thanh toán */}
              <div className="method-selector-tabs" style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => { setNewMethodType("card"); setCardFormError(null); }}
                  className={`tab-btn ${newMethodType === "card" ? "tab-btn--active" : ""}`}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "6px", border: newMethodType === "card" ? "1.5px solid #2563eb" : "1.5px solid #cbd5e1",
                    background: newMethodType === "card" ? "#eff6ff" : "transparent", color: newMethodType === "card" ? "#1e40af" : "#64748b",
                    fontWeight: 600, fontSize: "0.8rem", cursor: "pointer"
                  }}
                >
                  💳 Thẻ Visa/Master
                </button>
                <button
                  type="button"
                  onClick={() => { setNewMethodType("vnpay"); setCardFormError(null); }}
                  className={`tab-btn ${newMethodType === "vnpay" ? "tab-btn--active" : ""}`}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "6px", border: newMethodType === "vnpay" ? "1.5px solid #2b6cb0" : "1.5px solid #cbd5e1",
                    background: newMethodType === "vnpay" ? "#ebf8ff" : "transparent", color: newMethodType === "vnpay" ? "#2b6cb0" : "#64748b",
                    fontWeight: 600, fontSize: "0.8rem", cursor: "pointer"
                  }}
                >
                  🔵 Thẻ NCB (VNPay)
                </button>
              </div>

              {cardFormError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.85rem", color: "#dc2626" }}>
                  {cardFormError}
                </div>
              )}

              {newMethodType === "card" ? (
                /* 💳 Tab Stripe: Nhúng Stripe Elements chính thức */
                <Elements stripe={stripePromise}>
                  <StripeBindingForm
                    workspaceId={currentWorkspaceId}
                    onSuccess={async () => {
                      showSuccess("Liên kết thẻ Stripe thành công!");
                      setShowCardModal(false);
                      await fetchDetails(currentWorkspaceId);
                    }}
                    onCancel={() => setShowCardModal(false)}
                  />
                </Elements>
              ) : (
                /* 🔵 Tab VNPay: Nút chuyển hướng sang cổng VNPay Sandbox thực tế */
                <div style={{ padding: "12px 0", textAlign: "center" }}>
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "inline-flex", padding: "8px", background: "#f1f5f9", borderRadius: "12px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "2rem" }}>🏦</span>
                    </div>
                    <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>Liên kết thẻ NCB qua VNPay</h4>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: "1.5", margin: 0 }}>
                      Hệ thống sẽ chuyển hướng bạn sang cổng <strong>VNPay Sandbox</strong> để thực hiện giao dịch xác thực thẻ trị giá <strong>$1</strong>.
                    </p>
                    <div style={{ marginTop: "14px", background: "#ebf8ff", padding: "12px", borderRadius: "8px", fontSize: "0.8rem", color: "#2b6cb0", border: "1px solid #bee3f8", textAlign: "left" }}>
                      💡 <strong>Thông tin thẻ test NCB chuẩn:</strong><br />
                      • Số thẻ: <code>9704 1985 2619 1432 119</code><br />
                      • Tên chủ thẻ: <code>NGUYEN VAN A</code><br />
                      • Ngày phát hành: <code>07/15</code> | OTP: <code>123456</code>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn--secondary" onClick={() => setShowCardModal(false)}>Hủy</button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ background: "#2b6cb0", borderColor: "#2b6cb0" }}
                      onClick={async () => {
                        setShowCardModal(false);
                        await handleInitiateVnPayBinding();
                      }}
                    >
                      Kết nối VNPay Sandbox
                    </button>
                  </div>
                </div>
              )}
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
    const isUpgrading = isSubActive && subscription?.plan === "standard";
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

            {/* PHẦN 1: CÁC PHƯƠNG THỨC THANH TOÁN ĐÃ THÊM SẴN (SAVED METHODS) */}
            {savedCards.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Saved Payment Methods
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {savedCards.map((card) => {
                    const isSelected = selectedSavedMethodId === card.id;
                    const isStripe = card.type === "card";
                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          setSelectedSavedMethodId(card.id);
                          setPaymentMethod(isStripe ? "stripe" : "vnpay");
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "8px",
                          border: isSelected ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
                          background: isSelected ? "#eff6ff" : "#ffffff", cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        <input
                          type="radio"
                          name="selected_saved_method"
                          checked={isSelected}
                          onChange={() => {}} // Div click will trigger state update
                          style={{ cursor: "pointer" }}
                        />
                        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#1e293b", marginRight: "8px", fontSize: "0.9rem" }}>
                              {isStripe ? "💳 Thẻ Stripe liên kết" : "🔵 Thẻ VNPay liên kết"} •• {card.last4}
                            </span>
                            {card.isDefault && (
                              <span style={{ fontSize: "0.6rem", background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{card.holder}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Tuỳ chọn sử dụng phương thức mới */}
                  <div
                    onClick={() => {
                      setSelectedSavedMethodId("new_method");
                      setPaymentMethod("vnpay");
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "8px",
                      border: selectedSavedMethodId === "new_method" ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
                      background: selectedSavedMethodId === "new_method" ? "#eff6ff" : "#ffffff", cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    <input
                      type="radio"
                      name="selected_saved_method"
                      checked={selectedSavedMethodId === "new_method"}
                      onChange={() => {}}
                      style={{ cursor: "pointer" }}
                    />
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>➕ Sử dụng phương thức thanh toán mới</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PHẦN 2: CHỌN CỔNG THANH TOÁN MỚI (CHỈ HIỂN THỊ KHI CHỌN NEW_METHOD HOẶC CHƯA CÓ PHƯƠNG THỨC NÀO) */}
            {(selectedSavedMethodId === "new_method" || savedCards.length === 0) && (
              <div style={{ marginTop: savedCards.length > 0 ? "20px" : "0" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cổng thanh toán khả dụng
                </h4>
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
                      <span className="method-name">VNPay Gateway</span>
                      <span className="method-desc">Thanh toán bảo mật NCB / QR Code</span>
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
                    <span className="method-logo method-logo--stripe" style={{ fontWeight: 800, color: "#635bff", fontStyle: "italic", fontSize: "1.1rem" }}>Stripe</span>
                    <div className="method-info">
                      <span className="method-name">Thẻ Quốc tế (Stripe)</span>
                      <span className="method-desc">Thanh toán bảo mật qua Stripe Elements</span>
                    </div>
                  </div>

                  {/* Simulated */}
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
                      <span className="method-name">Thanh toán mô phỏng</span>
                      <span className="method-desc">Giả lập thanh toán trực tiếp qua API backend</span>
                    </div>
                    <span className="method-badge">Sandbox</span>
                  </div>
                </div>
              </div>
            )}

            {/* Form điền thông tin thẻ nếu chọn Stripe */}
            {paymentMethod === "stripe" && (
              <div style={{ marginTop: "20px" }}>
                <Elements stripe={stripePromise}>
                  <StripeCheckoutForm
                    workspaceId={currentWorkspaceId}
                    plan={selectedPlanForCheckout}
                    promoCode={appliedPromo || undefined}
                    amount={checkoutData.amount}
                    onSuccess={(txId) => {
                      const nextRenewal = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      });
                      setLastSuccessPayment({
                        paymentId: `PAY-${txId.substring(0, 8).toUpperCase()}`,
                        invoiceId: `INV-2026-${txId.substring(txId.length - 4).toUpperCase()}`,
                        plan: selectedPlanForCheckout === "premium" ? "Premium Plan" : "Standard Plan",
                        amountPaid: checkoutData.amount,
                        nextRenewal,
                        gateway: "stripe"
                      });
                      setView("success");
                    }}
                    onCancel={() => setView("dashboard")}
                    savedMethodId={selectedSavedMethodId}
                  />
                </Elements>
              </div>
            )}


            {/* Thông báo hoặc Form nhập Ví VNPay */}
            {paymentMethod === "vnpay" && (() => {
              const currentSavedVnpay = savedCards.find(c => c.id === selectedSavedMethodId);
              return currentSavedVnpay && selectedSavedMethodId !== "new_method" ? (
                <div style={{ backgroundColor: "#ebf8ff", border: "1.5px solid #bee3f8", borderRadius: "10px", padding: "16px", marginTop: "24px", color: "#2b6cb0" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", fontWeight: 700 }}>
                    <span>💳 Thẻ liên kết VNPay Tokenization hoạt động</span>
                  </div>
                  <div style={{ fontSize: "0.85rem" }}>
                    Thẻ: <strong>{currentSavedVnpay.brand} •••• {currentSavedVnpay.last4}</strong>
                    <br />
                    Tên chủ thẻ: <strong>{currentSavedVnpay.holder}</strong>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#2b6cb0", marginTop: "10px", marginBottom: 0 }}>
                    Hệ thống sẽ tự động trừ phí gia hạn định kỳ từ thẻ đã liên kết này qua VNPay.
                  </p>
                </div>
              ) : (
                <div className="secure-notice" style={{ backgroundColor: "#ebf8ff", border: "1px solid #bee3f8", color: "#2b6cb0", marginTop: "24px" }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <strong>Thanh toán trực tiếp qua cổng VNPay.</strong>
                    <br />
                    Sau khi nhấn nút <strong>Pay Now</strong>, bạn sẽ được chuyển hướng an toàn đến cổng VNPay Sandbox để nhập thông tin thẻ test NCB hoặc quét mã QR.
                  </div>
                </div>
              );
            })()}

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
                <span>Cổng thanh toán</span>
                <span>
                  {paymentMethod === "stripe" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f0f0ff", color: "#635bff", padding: "2px 8px", borderRadius: "5px", fontWeight: 600, fontSize: "0.78rem", border: "1px solid #d4d4ff" }}>
                      💳 Stripe
                    </span>
                  )}
                  {paymentMethod === "vnpay" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#ebf8ff", color: "#2b6cb0", padding: "2px 8px", borderRadius: "5px", fontWeight: 600, fontSize: "0.78rem", border: "1px solid #bee3f8" }}>
                      🔵 VNPay
                    </span>
                  )}
                  {paymentMethod === "simulated" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#fefce8", color: "#a16207", padding: "2px 8px", borderRadius: "5px", fontWeight: 600, fontSize: "0.78rem", border: "1px solid #fde68a" }}>
                      🧪 Mô phỏng
                    </span>
                  )}
                </span>
              </div>
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

            {paymentMethod !== "stripe" ? (
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
            ) : (
              <div style={{ 
                background: "#f8fafc", 
                border: "1px dashed #cbd5e1", 
                borderRadius: "8px", 
                padding: "16px", 
                marginTop: "12px", 
                textAlign: "center",
                fontSize: "0.85rem",
                color: "#64748b"
              }}>
                ℹ️ Vui lòng hoàn tất nhập thông tin thẻ và nhấn nút <strong>Pay Now</strong> ở cột bên trái để thanh toán qua Stripe.
              </div>
            )}

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
              <span className="success-label">CỔNG THANH TOÁN</span>
              <span className="success-value">
                {lastSuccessPayment.gateway === "stripe" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f0f0ff", color: "#635bff", padding: "3px 10px", borderRadius: "6px", fontWeight: 700, fontSize: "0.8rem", border: "1px solid #d4d4ff" }}>
                    💳 Stripe (Thẻ Quốc tế)
                  </span>
                )}
                {lastSuccessPayment.gateway === "vnpay" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#ebf8ff", color: "#2b6cb0", padding: "3px 10px", borderRadius: "6px", fontWeight: 700, fontSize: "0.8rem", border: "1px solid #bee3f8" }}>
                    🔵 VNPay Gateway
                  </span>
                )}
                {lastSuccessPayment.gateway === "simulated" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#ecfdf5", color: "#065f46", padding: "3px 10px", borderRadius: "6px", fontWeight: 700, fontSize: "0.8rem", border: "1px solid #a7f3d0" }}>
                    🧪 Mô phỏng (Sandbox)
                  </span>
                )}
              </span>
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
