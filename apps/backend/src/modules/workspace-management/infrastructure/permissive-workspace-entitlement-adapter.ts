import type {
  WorkspaceEntitlementDecision,
  WorkspaceEntitlementPort
} from "../application/ports/workspace-entitlement-port.ts";
import type { RequestedWorkspaceProfile } from "../domain/workspace-profile.ts";

export class PermissiveWorkspaceEntitlementAdapter implements WorkspaceEntitlementPort {
  async resolveProvisioningProfile(input: {
    userId: string;
    requestedProfile: RequestedWorkspaceProfile;
  }): Promise<WorkspaceEntitlementDecision> {
    return {
      kind: "resolved",
      requestedProfile: input.requestedProfile,
      resolvedProvisioningProfile: {
        profile: input.requestedProfile,
        cpu: input.requestedProfile === "premium" ? 8 : 2,
        memoryGb: input.requestedProfile === "premium" ? 32 : 4
      }
    };
  }
}
