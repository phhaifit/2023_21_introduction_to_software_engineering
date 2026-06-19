import type { JobEnvelope, JobName, JobQueue } from "./queue";

export type JobHandler<Name extends JobName = JobName> = (
  job: JobEnvelope<Name>
) => Promise<void>;

export type JobHandlerRegistry = Partial<Record<JobName, JobHandler>>;

export async function runNextJob(
  queue: JobQueue,
  handlers: JobHandlerRegistry
): Promise<"idle" | "completed" | "failed"> {
  const job = await queue.next();

  if (!job) {
    return "idle";
  }

  const handler = handlers[job.name];

  if (!handler) {
    await queue.fail(job.jobId, `No handler registered for ${job.name}`);
    return "failed";
  }

  try {
    await handler(job);
    await queue.complete(job.jobId);
    return "completed";
  } catch (error) {
    await queue.fail(job.jobId, error instanceof Error ? error.message : String(error));
    return "failed";
  }
}
