import type { JsonValue } from "./workspace-persistence-types.ts";

export type WorkspaceRuntimeProvisioningResult =
  | {
      readonly kind: "provisioned";
      readonly provider: string;
      readonly runtimeRef: string;
      readonly runtimeUrl?: string | null;
    }
  | {
      readonly kind: "retryable_failure" | "terminal_failure" | "unknown_outcome";
      readonly code: string;
      readonly message: string;
    };

export type WorkspaceRuntimeDeprovisioningResult =
  | {
      readonly kind: "deprovisioned";
      readonly runtimeFinalityProof: "runtime_absent_final";
    }
  | {
      readonly kind: "retryable_failure" | "terminal_failure" | "unknown_outcome";
      readonly code: string;
      readonly message: string;
    };

export type WorkspaceRuntimeStatusResult =
  | {
      readonly kind: "present_confirmed";
      readonly provider?: string | null;
      readonly runtimeRef?: string | null;
    }
  | {
      readonly kind: "absent_final";
    }
  | {
      readonly kind: "unknown";
      readonly code: string;
      readonly message: string;
    };

export interface WorkspaceRuntimeProvisioningPort {
  provisionWorkspace(input: {
    workspaceId: string;
    operationId: string;
    providerRequestKey: string;
    resolvedProvisioningProfile: JsonValue;
    correlationId: string;
  }): Promise<WorkspaceRuntimeProvisioningResult>;

  deprovisionWorkspace(input: {
    workspaceId: string;
    operationId: string;
    providerRequestKey: string;
    runtimeRef?: string | null;
    correlationId: string;
  }): Promise<WorkspaceRuntimeDeprovisioningResult>;

  getWorkspaceRuntimeStatus(input: {
    workspaceId: string;
    operationId: string;
    providerRequestKey?: string | null;
    runtimeRef?: string | null;
    correlationId: string;
  }): Promise<WorkspaceRuntimeStatusResult>;
}
