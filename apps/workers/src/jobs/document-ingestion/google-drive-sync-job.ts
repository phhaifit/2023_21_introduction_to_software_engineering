import type { EntityId } from "@vcp/shared/contracts";
import type { JobEnvelope, JobHandler } from "../queue";

export type GoogleDriveSyncRuntimePort = {
  execute(input: {
    workspaceId: EntityId<"workspaceId">;
    jobId: EntityId<"jobId">;
  }): Promise<void>;
};

export function createGoogleDriveSyncJobHandler(
  runtime: GoogleDriveSyncRuntimePort
): JobHandler<"knowledge.google_drive_sync"> {
  return async (
    envelope: JobEnvelope<"knowledge.google_drive_sync">
  ): Promise<void> => {
    const workspaceId = requireId(envelope.payload["workspaceId"], "workspaceId");
    const jobId = requireId(envelope.payload["jobId"], "jobId");
    await runtime.execute({
      workspaceId: workspaceId as EntityId<"workspaceId">,
      jobId: jobId as EntityId<"jobId">
    });
  };
}

function requireId(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Google Drive sync job requires ${name}`);
  }
  return value;
}
