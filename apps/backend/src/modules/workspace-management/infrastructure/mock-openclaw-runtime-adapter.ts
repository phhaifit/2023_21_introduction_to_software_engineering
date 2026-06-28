import type { OpenClawRuntimeAdapter, OpenClawWorkspaceConfig, OpenClawRuntimeInfo } from "../../../shared/openclaw/runtime-adapter.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export class MockOpenClawRuntimeAdapter implements OpenClawRuntimeAdapter {
  async provision(config: OpenClawWorkspaceConfig): Promise<OpenClawRuntimeInfo> {
    console.log(`[MockOpenClaw] Provisioning workspace ${config.workspaceId} (plan entitlement: ${config.entitlement.cpuCores} CPU)`);
    return {
      workspaceId: config.workspaceId,
      status: "running",
      runtimeUrl: `http://localhost:18789/workspaces/${config.workspaceId}`,
      containerId: `ctr_${config.workspaceId.slice(-8)}`
    };
  }

  async start(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo> {
    return { workspaceId, status: "running" };
  }

  async stop(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo> {
    console.log(`[MockOpenClaw] Stopping workspace ${workspaceId}`);
    return { workspaceId, status: "stopping" };
  }

  async delete(workspaceId: EntityId<"workspaceId">): Promise<void> {
    console.log(`[MockOpenClaw] Deleted workspace ${workspaceId}`);
  }

  async resize(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo> {
    return { workspaceId, status: "running" };
  }

  async getStatus(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo> {
    return { workspaceId, status: "running" };
  }
}
