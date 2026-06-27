import type { RequestedWorkspaceProfile } from "../../domain/workspace-profile.ts";
import type { JsonValue } from "./workspace-persistence-types.ts";

export type WorkspaceEntitlementDecision =
  | {
      readonly kind: "resolved";
      readonly requestedProfile: RequestedWorkspaceProfile;
      readonly resolvedProvisioningProfile: JsonValue;
    }
  | {
      readonly kind: "denied";
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly kind: "unavailable";
      readonly code: string;
      readonly message: string;
    };

export interface WorkspaceEntitlementPort {
  resolveProvisioningProfile(input: {
    userId: string;
    requestedProfile: RequestedWorkspaceProfile;
  }): Promise<WorkspaceEntitlementDecision>;
}
