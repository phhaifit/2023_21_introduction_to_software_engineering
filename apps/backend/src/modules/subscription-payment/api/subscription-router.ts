import { Router, type Request, type Response } from "express";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { CheckoutUseCases, CheckoutNotFoundError, CheckoutValidationError } from "../application/checkout-use-cases.ts";
import type { JobQueue } from "../application/checkout-use-cases.ts";

export type SubscriptionRouterDependencies = {
  useCases: CheckoutUseCases;
  jobQueue?: JobQueue;
};

export function createSubscriptionRouter(
  dependencies: SubscriptionRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  const getRequestContext = (req: Request) => {
    return (req as any).context || {};
  };

  const enforceAuth = (context: any) => {
    if (!context.user) {
      throw new Error("User is not authenticated");
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
      const isValidation = error instanceof CheckoutValidationError;
      const isNotFound = error instanceof CheckoutNotFoundError;

      res.status(isValidation ? 400 : isNotFound ? 404 : 500).json({
        success: false,
        error: {
          code: isValidation ? "validation.failed" : isNotFound ? "resource.not_found" : "system.error",
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

  router.post("/checkout", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { plan?: string } | undefined;
      const plan = payload?.plan;

      if (plan !== "standard" && plan !== "premium") {
        throw new CheckoutValidationError("Gói dịch vụ không hợp lệ. Phải là standard hoặc premium.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.initiateCheckout(userId, plan as SubscriptionPlan);
    });
  });

  router.post("/upgrade", async (req, res) => {
    await handleRequest(req, res, async () => {
      const context = getRequestContext(req);
      enforceAuth(context);

      const payload = req.body as { subscriptionId?: string } | undefined;
      const subscriptionId = payload?.subscriptionId;

      if (!subscriptionId) {
        throw new CheckoutValidationError("subscriptionId là bắt buộc.");
      }

      const userId = context.user.userId as EntityId<"userId">;
      return dependencies.useCases.initiateUpgrade(userId, subscriptionId as EntityId<"subscriptionId">);
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
