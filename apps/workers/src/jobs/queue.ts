import type { EntityId } from "@vcp/shared/contracts";

export type JobName =
  | "openclaw.provision"
  | "openclaw.resize"
  | "openclaw.delete"
  | "payment.webhook"
  | "document.ingest"
  | "knowledge.google_drive_sync"
  | "task.execute";

export type JobPayload = Record<string, unknown>;

export type JobEnvelope<Name extends JobName = JobName> = {
  jobId: EntityId<"jobId">;
  name: Name;
  queuedAt: string;
  attempts: number;
  payload: JobPayload;
};

export type JobQueue = {
  enqueue<Name extends JobName>(
    name: Name,
    payload: JobPayload
  ): Promise<JobEnvelope<Name>>;
  next(): Promise<JobEnvelope | undefined>;
  complete(jobId: EntityId<"jobId">): Promise<void>;
  fail(jobId: EntityId<"jobId">, reason: string): Promise<void>;
};
