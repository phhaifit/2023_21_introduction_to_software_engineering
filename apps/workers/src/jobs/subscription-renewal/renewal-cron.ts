import type { CheckoutUseCases } from "../../../../backend/src/modules/subscription-payment/application/checkout-use-cases.ts";
import type { SubscriptionRepository } from "../../../../backend/src/modules/subscription-payment/application/subscription-repository.ts";

export class SubscriptionRenewalCron {
  private readonly checkoutUseCases: CheckoutUseCases;
  private readonly subscriptionRepository: SubscriptionRepository;
  private intervalId?: NodeJS.Timeout;

  constructor(dependencies: {
    checkoutUseCases: CheckoutUseCases;
    subscriptionRepository: SubscriptionRepository;
  }) {
    this.checkoutUseCases = dependencies.checkoutUseCases;
    this.subscriptionRepository = dependencies.subscriptionRepository;
  }

  /**
   * Khởi chạy định kỳ quét Subscription hàng ngày (24 giờ một lần)
   * Trong chế độ test/demo, ta có thể cho chạy nhanh hơn (ví dụ: 1 tiếng hoặc 5 phút)
   */
  start(intervalMs: number = 24 * 60 * 60 * 1000): void {
    console.log(`[Renewal Cron] Bắt đầu scheduler quét gia hạn tự động định kỳ mỗi ${intervalMs} ms...`);
    // Chạy quét ngay lập tức khi khởi động
    this.runRenewalCheck();

    this.intervalId = setInterval(() => {
      this.runRenewalCheck();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log("[Renewal Cron] Đã dừng scheduler.");
    }
  }

  /**
   * Quét toàn bộ subscription và thực hiện thanh toán tự động qua Tokenization cho các gói đến hạn
   */
  async runRenewalCheck(): Promise<void> {
    console.log("[Renewal Cron] Bắt đầu quét cơ sở dữ liệu để tìm Subscription đến kỳ gia hạn...");
    const now = new Date();
    const nowStr = now.toISOString();

    try {
      // 1. Quét tất cả các subscription đang active hoặc sắp hết hạn
      // Đối với demo, ta sẽ quét các subscription trong prisma database trực tiếp
      const prisma = (this.subscriptionRepository as any).prisma;
      if (!prisma) {
        console.warn("[Renewal Cron] Không tìm thấy Prisma Client trong repository, bỏ qua quét.");
        return;
      }

      // Tìm subscription có autoRenew = true, status là active hoặc past_due, và đã hết hạn (expiresAt <= nowStr)
      const subscriptionsToRenew = await prisma.subscription.findMany({
        where: {
          autoRenew: true,
          status: { in: ["active", "expiring_soon", "past_due"] },
          expiresAt: { lte: nowStr }
        }
      });

      console.log(`[Renewal Cron] Tìm thấy ${subscriptionsToRenew.length} subscription đến hạn gia hạn.`);

      for (const sub of subscriptionsToRenew) {
        console.log(`[Renewal Cron] Đang xử lý gia hạn cho Subscription ID: ${sub.subscriptionId} (Workspace ID: ${sub.workspaceId})`);
        
        // 2. Gọi Use Case processRenewal
        try {
          const result = await this.checkoutUseCases.processRenewal(sub.subscriptionId);
          if (result.success) {
            console.log(`[Renewal Cron] Đã gia hạn thành công cho ${sub.subscriptionId}: ${result.message}`);
          } else {
            console.warn(`[Renewal Cron] Gia hạn thất bại cho ${sub.subscriptionId}: ${result.message}`);
            
            // Xử lý đếm số lần gia hạn lỗi (Grace Period & Retry)
            await this.handleGracePeriodFailure(sub, prisma, nowStr);
          }
        } catch (err: any) {
          console.error(`[Renewal Cron] Lỗi nghiêm trọng khi gia hạn ${sub.subscriptionId}:`, err);
        }
      }
    } catch (error) {
      console.error("[Renewal Cron] Lỗi trong quá trình quét gia hạn:", error);
    }
  }

  /**
   * Xử lý khi charge tiền định kỳ bị lỗi (Đếm số lần thử lại và khóa dịch vụ nếu quá hạn)
   */
  private async handleGracePeriodFailure(sub: any, prisma: any, nowStr: string): Promise<void> {
    // Để giữ đơn giản cho demo:
    // Ta lưu số lần thử lại thất bại (retryCount) trực tiếp vào DB hoặc tính từ ngày hết hạn ban đầu.
    // Nếu ngày hết hạn ban đầu (expiresAt) đã trôi qua quá 3 ngày (Grace Period), ta sẽ khóa dịch vụ.
    const expiresDate = new Date(sub.expiresAt);
    const msSinceExpired = new Date(nowStr).getTime() - expiresDate.getTime();
    const daysSinceExpired = msSinceExpired / (24 * 60 * 60 * 1000);

    if (daysSinceExpired >= 3) {
      console.log(`[Renewal Cron] Subscription ${sub.subscriptionId} đã hết hạn quá 3 ngày Grace Period. Thực hiện HỦY gói dịch vụ.`);
      
      // Chuyển status sang expired hoặc cancelled
      await prisma.subscription.update({
        where: { subscriptionId: sub.subscriptionId },
        data: {
          status: "expired",
          updatedAt: nowStr
        }
      });

      // Nếu có workspace tương ứng, chuyển workspace plan về "free"
      if (sub.workspaceId) {
        await prisma.workspace.update({
          where: { workspaceId: sub.workspaceId },
          data: {
            plan: "free",
            updatedAt: nowStr
          }
        });
        
        console.log(`[Renewal Cron] Đã hạ cấp Workspace ${sub.workspaceId} về gói Free và khóa tài nguyên.`);
      }
    } else {
      console.log(`[Renewal Cron] Subscription ${sub.subscriptionId} vẫn trong Grace Period (${daysSinceExpired.toFixed(1)} ngày trôi qua).`);
    }
  }
}
