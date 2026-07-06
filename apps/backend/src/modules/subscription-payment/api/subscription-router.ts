import { Router, type Request, type Response } from "express";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { CheckoutUseCases, CheckoutNotFoundError, CheckoutValidationError } from "../application/checkout-use-cases.ts";
import type { JobQueue } from "../application/checkout-use-cases.ts";

export type SubscriptionRouterDependencies = {
  useCases: CheckoutUseCases;
  jobQueue?: JobQueue;
};

class AuthenticationError extends Error {
  constructor(message: string = "User is not authenticated") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function createSubscriptionRouter(
  dependencies: SubscriptionRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  const getRequestContext = (req: Request) => {
    return (req as any).context || {};
  };

  const enforceAuth = (context: any) => {
    if (!context.user) {
      throw new AuthenticationError();
    }
  };

  // Helper handling responses
  const handleRequest = async (req: Request, res: Response, action: () => Promise<any>) => {
    try {
      const data = await action();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error: any) {
      console.error("Subscription API error:", error);
      const isAuth = error instanceof AuthenticationError;
      const isValidation = error instanceof CheckoutValidationError;
      const isNotFound = error instanceof CheckoutNotFoundError;

      const statusCode = isAuth ? 401 : isValidation ? 400 : isNotFound ? 404 : 500;
      const errorCode = isAuth ? "auth.unauthorized" : isValidation ? "validation.failed" : isNotFound ? "resource.not_found" : "system.error";

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: error.message || "An unexpected error occurred."
        }
      });
    }
  };

  router.get("/details", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);
      
      const workspaceId = req.query.workspaceId as EntityId<"workspaceId">;
      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc trong query parameters.");
      }
      return dependencies.useCases.getSubscriptionDetails(workspaceId);
    });
  });

  router.get("/usage", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const workspaceId = req.query.workspaceId as EntityId<"workspaceId">;
      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc trong query parameters.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.getWorkspaceResourceUsage(workspaceId, userId);
    });
  });

  router.post("/checkout", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { plan?: string; promoCode?: string; workspaceId?: string } | undefined;
      const plan = payload?.plan;
      const promoCode = payload?.promoCode;
      const workspaceId = payload?.workspaceId;

      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      if (plan !== "standard" && plan !== "premium") {
        throw new CheckoutValidationError("Gói dịch vụ không hợp lệ. Phải là standard hoặc premium.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.initiateCheckout(userId, workspaceId as EntityId<"workspaceId">, plan as SubscriptionPlan, promoCode);
    });
  });

  router.post("/upgrade", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { subscriptionId?: string; promoCode?: string } | undefined;
      const subscriptionId = payload?.subscriptionId;
      const promoCode = payload?.promoCode;

      if (!subscriptionId) {
        throw new CheckoutValidationError("subscriptionId là bắt buộc.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.initiateUpgrade(userId, subscriptionId as EntityId<"subscriptionId">, promoCode);
    });
  });

  router.post("/toggle-auto-renewal", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { autoRenew?: boolean; workspaceId?: string } | undefined;
      const autoRenew = payload?.autoRenew;
      const workspaceId = payload?.workspaceId;

      if (autoRenew === undefined) {
        throw new CheckoutValidationError("autoRenew là bắt buộc trong JSON body.");
      }
      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      return dependencies.useCases.toggleAutoRenewal(workspaceId as EntityId<"workspaceId">, autoRenew);
    });
  });

  router.post("/payment-method", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { cardNumber?: string; cardHolder?: string; cardExpiry?: string; workspaceId?: string } | undefined;
      const cardNumber = payload?.cardNumber;
      const cardHolder = payload?.cardHolder;
      const cardExpiry = payload?.cardExpiry;
      const workspaceId = payload?.workspaceId;

      if (!cardNumber || !cardHolder || !cardExpiry) {
        throw new CheckoutValidationError("cardNumber, cardHolder và cardExpiry là bắt buộc trong body.");
      }
      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      return dependencies.useCases.updatePaymentMethod(workspaceId as EntityId<"workspaceId">, { cardNumber, cardHolder, cardExpiry });
    });
  });

  router.post("/validate-promo", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { promoCode?: string } | undefined;
      const promoCode = payload?.promoCode;

      if (!promoCode) {
        throw new CheckoutValidationError("promoCode là bắt buộc.");
      }

      return dependencies.useCases.validatePromo(promoCode);
    });
  });

  router.post("/mock-callback", async (req, res) => {
    await handleRequest(req, res, async () => {
      const payload = req.body as { transactionId?: string; status?: string } | undefined;
      const transactionId = payload?.transactionId;
      const status = payload?.status;

      if (!transactionId || (status !== "success" && status !== "failed")) {
        throw new CheckoutValidationError("transactionId và status (success/failed) là bắt buộc.");
      }

      if (dependencies.jobQueue) {
        // Gửi qua worker queue chạy bất đồng bộ
        await dependencies.jobQueue.enqueue("payment.webhook", {
          transactionId,
          status
        });
        return { enqueued: true, transactionId };
      } else {
        // Đối soát đồng bộ (nếu chạy local tối giản không queue)
        return dependencies.useCases.reconcilePayment(
          transactionId as EntityId<"transactionId">,
          status as "success" | "failed"
        );
      }
    });
  });

  router.post("/vnpay/checkout", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { plan?: string; promoCode?: string; workspaceId?: string; returnUrl?: string } | undefined;
      const plan = payload?.plan;
      const promoCode = payload?.promoCode;
      const workspaceId = payload?.workspaceId;
      
      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      if (plan !== "standard" && plan !== "premium") {
        throw new CheckoutValidationError("Gói dịch vụ không hợp lệ. Phải là standard hoặc premium.");
      }

      const ipAddr = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || "127.0.0.1";
      const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:3001";
      const returnUrl = payload?.returnUrl || `${backendUrl}/api/subscriptions/vnpay/vnpay-return`;

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.initiateVnPayCheckout(
        userId, 
        workspaceId as EntityId<"workspaceId">, 
        plan as SubscriptionPlan, 
        ipAddr, 
        returnUrl, 
        promoCode
      );
    });
  });

  router.get("/vnpay/vnpay-return", async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
    try {
      // Đối soát giao dịch từ callback trả về
      const tx = await dependencies.useCases.reconcileVnPayPayment(req.query);
      const isSuccess = tx.status === "success";
      
      // Redirect người dùng về màn hình success hoặc dashboard của frontend
      if (isSuccess) {
        res.redirect(`${frontendUrl}/billing?vnpay=success&transactionId=${tx.transactionId}`);
      } else {
        res.redirect(`${frontendUrl}/billing?vnpay=failed&transactionId=${tx.transactionId}`);
      }
    } catch (error: any) {
      console.error("VNPay Return error:", error);
      res.redirect(`${frontendUrl}/billing?vnpay=error&message=${encodeURIComponent(error.message || "Unknown error")}`);
    }
  });

  router.get("/vnpay/vnpay-ipn", async (req, res) => {
    try {
      await dependencies.useCases.reconcileVnPayPayment(req.query);
      res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
    } catch (error: any) {
      console.error("VNPay IPN error:", error);
      
      let rspCode = "99";
      let message = "Input required data invalid";

      if (error.message.includes("Chữ ký bảo mật")) {
        rspCode = "97";
        message = "Invalid checksum";
      } else if (error.message.includes("Không tìm thấy giao dịch")) {
        rspCode = "01";
        message = "Order not found";
      } else if (error.message.includes("đã đối soát")) {
        rspCode = "02";
        message = "Order already confirmed";
      }

      res.status(200).json({ RspCode: rspCode, Message: message });
    }
  });

  router.delete("/payment-method/:id", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const methodId = req.params.id;
      const workspaceId = req.query.workspaceId as string;

      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      return dependencies.useCases.deletePaymentMethod(workspaceId, methodId);
    });
  });

  router.get("/plans", async (req, res) => {
    await handleRequest(req, res, async () => {
      return dependencies.useCases.getPlans();
    });
  });

  router.post("/cancel", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { workspaceId?: string } | undefined;
      const workspaceId = payload?.workspaceId;

      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      return dependencies.useCases.cancelSubscription(workspaceId as EntityId<"workspaceId">);
    });
  });

  router.post("/vnpay/charge-saved-method", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { workspaceId?: string; plan?: string; methodId?: string; promoCode?: string } | undefined;
      const workspaceId = payload?.workspaceId;
      const plan = payload?.plan;
      const methodId = payload?.methodId;
      const promoCode = payload?.promoCode;

      if (!workspaceId || !plan || !methodId) {
        throw new CheckoutValidationError("workspaceId, plan và methodId là bắt buộc.");
      }

      return dependencies.useCases.chargeSavedMethod(
        workspaceId as EntityId<"workspaceId">,
        plan as SubscriptionPlan,
        methodId,
        promoCode
      );
    });
  });

  router.post("/vnpay/initiate-binding", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { workspaceId?: string; returnUrl?: string } | undefined;
      const workspaceId = payload?.workspaceId;
      const returnUrl = payload?.returnUrl;

      if (!workspaceId || !returnUrl) {
        throw new CheckoutValidationError("workspaceId và returnUrl là bắt buộc.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      const ipAddr = req.ip || "127.0.0.1";

      return dependencies.useCases.initiateVnPayBinding(userId, workspaceId as EntityId<"workspaceId">, ipAddr, returnUrl);
    });
  });

  router.post("/stripe/setup-intent", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { workspaceId?: string } | undefined;
      const workspaceId = payload?.workspaceId;

      if (!workspaceId) {
        throw new CheckoutValidationError("workspaceId là bắt buộc.");
      }

      return dependencies.useCases.createStripeSetupIntent(workspaceId as EntityId<"workspaceId">);
    });
  });

  router.post("/stripe/confirm-binding", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { workspaceId?: string; paymentMethodId?: string } | undefined;
      const workspaceId = payload?.workspaceId;
      const paymentMethodId = payload?.paymentMethodId;

      if (!workspaceId || !paymentMethodId) {
        throw new CheckoutValidationError("workspaceId và paymentMethodId là bắt buộc.");
      }

      return dependencies.useCases.confirmStripeBinding(
        workspaceId as EntityId<"workspaceId">,
        paymentMethodId
      );
    });
  });

  router.post("/stripe/charge", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { workspaceId?: string; plan?: string; paymentMethodId?: string; promoCode?: string } | undefined;
      const workspaceId = payload?.workspaceId;
      const plan = payload?.plan;
      const paymentMethodId = payload?.paymentMethodId;
      const promoCode = payload?.promoCode;

      if (!workspaceId || !plan || !paymentMethodId) {
        throw new CheckoutValidationError("workspaceId, plan và paymentMethodId là bắt buộc.");
      }

      return dependencies.useCases.chargeStripePayment(
        workspaceId as EntityId<"workspaceId">,
        plan as SubscriptionPlan,
        paymentMethodId,
        promoCode
      );
    });
  });

  return router;
}
