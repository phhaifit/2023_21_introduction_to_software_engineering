export interface WorkspaceProviderRequestKeyFactory {
  create(input: {
    workspaceId: string;
    operationId: string;
    operationType: "provision" | "deprovision";
  }): string;
}
