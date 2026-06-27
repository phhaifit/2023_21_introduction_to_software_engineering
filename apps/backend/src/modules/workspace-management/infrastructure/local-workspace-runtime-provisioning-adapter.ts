import type {
  WorkspaceRuntimeDeprovisioningResult,
  WorkspaceRuntimeProvisioningPort,
  WorkspaceRuntimeProvisioningResult,
  WorkspaceRuntimeStatusResult
} from "../application/ports/workspace-runtime-provisioning-port.ts";
import type { JsonValue } from "../application/ports/workspace-persistence-types.ts";

export class LocalWorkspaceRuntimeProvisioningAdapter
  implements WorkspaceRuntimeProvisioningPort
{
  async provisionWorkspace(input: {
    workspaceId: string;
    operationId: string;
    providerRequestKey: string;
    resolvedProvisioningProfile: JsonValue;
    correlationId: string;
  }): Promise<WorkspaceRuntimeProvisioningResult> {
    console.log(`[WorkspaceRuntime] Provisioning workspace ${input.workspaceId}`);
    return {
      kind: "provisioned",
      provider: "local",
      runtimeRef: `local:${input.workspaceId}`,
      runtimeUrl: null
    };
  }

  async deprovisionWorkspace(input: {
    workspaceId: string;
    operationId: string;
    providerRequestKey: string;
    runtimeRef?: string | null;
    correlationId: string;
  }): Promise<WorkspaceRuntimeDeprovisioningResult> {
    console.log(`[WorkspaceRuntime] Deprovisioning workspace ${input.workspaceId}`);
    return {
      kind: "deprovisioned",
      runtimeFinalityProof: "runtime_absent_final"
    };
  }

  async getWorkspaceRuntimeStatus(input: {
    workspaceId: string;
    operationId: string;
    providerRequestKey?: string | null;
    runtimeRef?: string | null;
    correlationId: string;
  }): Promise<WorkspaceRuntimeStatusResult> {
    console.log(`[WorkspaceRuntime] Checking runtime status for workspace ${input.workspaceId}`);
    if (input.runtimeRef?.startsWith("local:")) {
      return { kind: "present_confirmed", provider: "local", runtimeRef: input.runtimeRef };
    }
    return { kind: "absent_final" };
  }
}
