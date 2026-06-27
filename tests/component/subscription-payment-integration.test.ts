import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { createLocalAgentManagementRuntime } from "../../apps/backend/src/local-agent-management-server.ts";
import { SubscriptionPaymentApiClient } from "../../apps/frontend/src/features/subscription-payment/subscription-payment-api-client.ts";
import { createPaymentWebhookHandler } from "../../apps/workers/src/jobs/payment-webhook/payment-webhook-handler.ts";

describe("Subscription & Payment Integration Flow", () => {
  let server: http.Server;
  let client: SubscriptionPaymentApiClient;
  let runtime: any;
  const PORT = 3099;

  beforeAll(async () => {
    // Đảm bảo chạy in-memory để không bị phụ thuộc vào database PostgreSQL thật đang tắt
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      runtime = await createLocalAgentManagementRuntime();
      
      // Khởi chạy server Express trên port 3099
      server = runtime.app.listen(PORT, "127.0.0.1");
      
      // Khởi tạo frontend API client trỏ vào server test
      client = new SubscriptionPaymentApiClient(`http://127.0.0.1:${PORT}`);
    } finally {
      // Khôi phục lại biến môi trường
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });

  beforeEach(() => {
    // Dọn dẹp dữ liệu in-memory trước mỗi test case để đảm bảo tính cô lập (Test Isolation)
    if (runtime && runtime.subscriptionRepository) {
      (runtime.subscriptionRepository as any).subscriptions.clear();
      (runtime.subscriptionRepository as any).transactions.clear();
    }
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  // 1. Kiểm tra API & Frontend Client Giao tiếp với nhau
  describe("API & UI Client Communication", () => {
    it("nên lấy về subscription rỗng khi user chưa đăng ký gói nào", async () => {
      const details = await client.getSubscriptionDetails("workspace-test-id");
      expect(details.subscription).toBeNull();
      expect(details.transactions).toEqual([]);
    });

    it("nên khởi tạo checkout thành công và trả về checkoutUrl, IDs", async () => {
      const checkoutRes = await client.initiateCheckout("workspace-test-id", "standard");
      expect(checkoutRes).toHaveProperty("checkoutUrl");
      expect(checkoutRes).toHaveProperty("subscriptionId");
      expect(checkoutRes).toHaveProperty("transactionId");
      expect(checkoutRes.checkoutUrl).toContain("sandbox-checkout");
      expect(checkoutRes.checkoutUrl).toContain("plan=standard");
    });

    it("nên đối soát thanh toán thành công qua mock-callback và kích hoạt subscription", async () => {
      // Khởi tạo giao dịch mới
      const checkoutRes = await client.initiateCheckout("workspace-test-id", "standard");
      const transactionId = checkoutRes.transactionId;

      // Giả lập callback thanh toán thành công
      const callbackRes = await client.sendMockCallback(transactionId, "success");
      expect(callbackRes).toHaveProperty("status", "success");

      // Kiểm tra xem subscription đã được active chưa
      const details = await client.getSubscriptionDetails("workspace-test-id");
      expect(details.subscription).not.toBeNull();
      expect(details.subscription?.plan).toBe("standard");
      expect(details.subscription?.status).toBe("active");
      
      // Kiểm tra lịch sử transaction
      expect(details.transactions.length).toBeGreaterThan(0);
      const tx = details.transactions.find((t) => t.transactionId === transactionId);
      expect(tx).toBeDefined();
      expect(tx?.status).toBe("success");
    });

    it("nên nâng cấp thành công từ Standard lên Premium", async () => {
      // 1. Tạo mới gói Standard và kích hoạt thành công
      const checkoutRes = await client.initiateCheckout("workspace-test-id", "standard");
      await client.sendMockCallback(checkoutRes.transactionId, "success");

      // 2. Lấy thông tin subscription
      const detailsBefore = await client.getSubscriptionDetails("workspace-test-id");
      const subscriptionId = detailsBefore.subscription!.subscriptionId;

      // 3. Khởi tạo nâng cấp
      const upgradeRes = await client.initiateUpgrade(subscriptionId);
      expect(upgradeRes.checkoutUrl).toContain("plan=premium");
      expect(upgradeRes.checkoutUrl).toContain("amount=50"); // 79 - 29 = 50 USD chênh lệch

      // 4. Callback thanh toán nâng cấp thành công
      await client.sendMockCallback(upgradeRes.transactionId, "success");

      // 5. Verify trạng thái subscription mới
      const detailsAfter = await client.getSubscriptionDetails("workspace-test-id");
      expect(detailsAfter.subscription?.plan).toBe("premium");
      expect(detailsAfter.subscription?.status).toBe("active");
    });

    it("nên bật tắt tự động gia hạn thành công qua API", async () => {
      // Đăng ký gói trước
      const checkoutRes = await client.initiateCheckout("workspace-test-id", "standard");
      await client.sendMockCallback(checkoutRes.transactionId, "success");

      // Tắt tự gia hạn
      const res = await client.toggleAutoRenewal("workspace-test-id", false);
      expect(res.autoRenew).toBe(false);

      // Verify details
      const details = await client.getSubscriptionDetails("workspace-test-id");
      expect(details.subscription?.autoRenew).toBe(false);
    });

    it("nên cập nhật phương thức thanh toán ảo thành công qua API", async () => {
      // Đăng ký gói trước
      const checkoutRes = await client.initiateCheckout("workspace-test-id", "standard");
      await client.sendMockCallback(checkoutRes.transactionId, "success");

      // Cập nhật thẻ
      await client.updatePaymentMethod("workspace-test-id", "1111 2222 3333 4444", "VCP Tester", "09/30");

      // Verify details
      const details = await client.getSubscriptionDetails("workspace-test-id");
      expect(details.subscription?.cardNumber).toBe("1111 2222 3333 4444");
      expect(details.subscription?.cardHolder).toBe("VCP Tester");
      expect(details.subscription?.cardExpiry).toBe("09/30");
    });

    it("nên xác thực mã giảm giá tĩnh thành công qua API", async () => {
      const res = await client.validatePromo("VCP10");
      expect(res.success).toBe(true);
      expect(res.discount).toBe(10);

      const resFail = await client.validatePromo("FAIL_PROMO");
      expect(resFail.success).toBe(false);
      expect(resFail.discount).toBe(0);
    });

    it("nên lấy về tài nguyên sử dụng thật của workspace qua API", async () => {
      // Đăng ký gói Standard trước
      const checkoutRes = await client.initiateCheckout("workspace-test-id", "standard");
      await client.sendMockCallback(checkoutRes.transactionId, "success");

      // Lấy usage
      const usage = await client.getWorkspaceResourceUsage("workspace-test-id");
      expect(usage).toHaveProperty("cpu");
      expect(usage).toHaveProperty("ram");
      expect(usage).toHaveProperty("agents");
      expect(usage).toHaveProperty("storage");
      expect(usage.cpu.max).toBe(8); // Standard CPU max
    });

    it("nên lấy về danh sách cấu hình plans qua API", async () => {
      const plans = await client.getPlans();
      expect(plans).toHaveProperty("free");
      expect(plans).toHaveProperty("standard");
      expect(plans).toHaveProperty("premium");
      expect(plans.free.price).toBe(0);
      expect(plans.standard.price).toBe(29);
      expect(plans.premium.price).toBe(79);
    });
  });

  // 2. Kiểm tra Worker Webhook Handler
  describe("Worker Webhook Job Handler", () => {
    it("nên xử lý chính xác payload job webhook từ queue", async () => {
      let calledTransactionId = "";
      let calledStatus = "";
      
      const mockUseCases = {
        async reconcilePayment(transactionId: any, status: "success" | "failed") {
          calledTransactionId = transactionId;
          calledStatus = status;
          return {} as any;
        }
      };

      const handler = createPaymentWebhookHandler(mockUseCases);
      
      // Giả lập job nhận từ queue
      const mockJob = {
        jobId: "job-123" as any,
        name: "payment.webhook" as const,
        queuedAt: new Date().toISOString(),
        attempts: 1,
        payload: {
          transactionId: "tx-worker-test",
          status: "success"
        }
      };

      await handler(mockJob);

      expect(calledTransactionId).toBe("tx-worker-test");
      expect(calledStatus).toBe("success");
    });

    it("nên throw error nếu job payload thiếu thông tin bắt buộc", async () => {
      const mockUseCases = {
        async reconcilePayment() { return {} as any; }
      };
      const handler = createPaymentWebhookHandler(mockUseCases);

      const invalidJob = {
        jobId: "job-123" as any,
        name: "payment.webhook" as const,
        queuedAt: new Date().toISOString(),
        attempts: 1,
        payload: {
          // Thiếu transactionId
          status: "success"
        }
      };

      await expect(handler(invalidJob as any)).rejects.toThrow("Invalid payment.webhook job payload");
    });
  });
});
