import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { PLAN_ENTITLEMENTS } from "@vcp/shared/contracts/plans.ts";
import type { JobEnvelope } from "../queue.ts";

// ---------------------------------------------------------------------------
// Job payload types (plain data — no private module imports)
// ---------------------------------------------------------------------------

export type OpenClawProvisionPayload = {
  workspaceId: EntityId<"workspaceId">;
  workspaceName: string;
  plan: SubscriptionPlan;
};

export type OpenClawDeletePayload = {
  workspaceId: EntityId<"workspaceId">;
};

// ---------------------------------------------------------------------------
// Port interfaces — deps are injected at startup from the server/app layer.
// Workers only import @vcp/shared and @vcp/database; backend internals are
// passed in, not imported, so module boundary is preserved.
// ---------------------------------------------------------------------------

export type WorkspaceRuntimeDeps = {
  updateWorkspaceStatus: (
    workspaceId: EntityId<"workspaceId">,
    update: {
      status: string;
      runtimeUrl?: string;
      containerId?: string;
      failureReason?: string;
    },
    now: string
  ) => Promise<void>;
  provision: (config: {
    workspaceId: EntityId<"workspaceId">;
    displayName: string;
    entitlement: (typeof PLAN_ENTITLEMENTS)[SubscriptionPlan];
  }) => Promise<{ runtimeUrl?: string; containerId?: string }>;
  stop: (workspaceId: EntityId<"workspaceId">) => Promise<void>;
  delete: (workspaceId: EntityId<"workspaceId">) => Promise<void>;
  now: () => string;
};

// ---------------------------------------------------------------------------
// Provisioning handler — openclaw.provision job
// ---------------------------------------------------------------------------

export function createOpenClawProvisionHandler(deps: WorkspaceRuntimeDeps) {
  return async (job: JobEnvelope<"openclaw.provision">): Promise<void> => {
    const payload = job.payload as OpenClawProvisionPayload;
    const { workspaceId, workspaceName, plan } = payload;

    try {
      const entitlement = PLAN_ENTITLEMENTS[plan];
      const runtimeInfo = await deps.provision({
        workspaceId,
        displayName: workspaceName,
        entitlement
      });

      await deps.updateWorkspaceStatus(
        workspaceId,
        {
          status: "running",
          runtimeUrl: runtimeInfo.runtimeUrl,
          containerId: runtimeInfo.containerId
        },
        deps.now()
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown provisioning error";
      await deps.updateWorkspaceStatus(
        workspaceId,
        { status: "failed", failureReason: reason },
        deps.now()
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Cleanup handler — openclaw.delete job
// ---------------------------------------------------------------------------

export function createOpenClawDeleteHandler(deps: WorkspaceRuntimeDeps) {
  return async (job: JobEnvelope<"openclaw.delete">): Promise<void> => {
    const payload = job.payload as OpenClawDeletePayload;
    const { workspaceId } = payload;

    try {
      await deps.stop(workspaceId);
      await deps.delete(workspaceId);
    } catch (_err) {
      // Best-effort: log and proceed — workspace will still be marked deleted
    }

    await deps.updateWorkspaceStatus(
      workspaceId,
      { status: "deleted" },
      deps.now()
    );
  };
}
