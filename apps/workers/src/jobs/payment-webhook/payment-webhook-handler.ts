import type { JobEnvelope } from "../queue.ts";

export type ReconcilableUseCases = {
  reconcilePayment(transactionId: any, status: "success" | "failed"): Promise<any>;
};

export function createPaymentWebhookHandler(useCases: ReconcilableUseCases) {
  return async (job: JobEnvelope<"payment.webhook">) => {
    const { transactionId, status } = job.payload as {
      transactionId: string;
      status: "success" | "failed";
    };

    if (!transactionId || (status !== "success" && status !== "failed")) {
      throw new Error("Invalid payment.webhook job payload: missing transactionId or status");
    }

    await useCases.reconcilePayment(transactionId, status);
  };
}
