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
      
      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.getSubscriptionDetails(userId);
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

      const payload = req.body as { plan?: string; promoCode?: string } | undefined;
      const plan = payload?.plan;
      const promoCode = payload?.promoCode;

      if (plan !== "standard" && plan !== "premium") {
        throw new CheckoutValidationError("Gói dịch vụ không hợp lệ. Phải là standard hoặc premium.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.initiateCheckout(userId, plan as SubscriptionPlan, promoCode);
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

      const payload = req.body as { autoRenew?: boolean } | undefined;
      const autoRenew = payload?.autoRenew;

      if (autoRenew === undefined) {
        throw new CheckoutValidationError("autoRenew là bắt buộc trong JSON body.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.toggleAutoRenewal(userId, autoRenew);
    });
  });

  router.post("/payment-method", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { cardNumber?: string; cardHolder?: string; cardExpiry?: string } | undefined;
      const cardNumber = payload?.cardNumber;
      const cardHolder = payload?.cardHolder;
      const cardExpiry = payload?.cardExpiry;

      if (!cardNumber || !cardHolder || !cardExpiry) {
        throw new CheckoutValidationError("cardNumber, cardHolder và cardExpiry là bắt buộc trong body.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.updatePaymentMethod(userId, { cardNumber, cardHolder, cardExpiry });
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

  return router;
}
