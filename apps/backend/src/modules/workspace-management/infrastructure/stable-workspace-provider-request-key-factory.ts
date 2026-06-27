import type { WorkspaceProviderRequestKeyFactory } from "../application/ports/workspace-provider-request-key-factory.ts";

export class StableWorkspaceProviderRequestKeyFactory
  implements WorkspaceProviderRequestKeyFactory
{
  create(input: {
    workspaceId: string;
    operationId: string;
    operationType: "provision" | "deprovision";
  }): string {
    return `${input.operationType}:${input.workspaceId}:${input.operationId}`;
  }
}
