import type { CreateWorkspaceUseCase } from "../../application/use-cases/create-workspace.ts";
import type { DeleteWorkspaceUseCase } from "../../application/use-cases/delete-workspace.ts";
import type { GetWorkspaceDetailUseCase } from "../../application/use-cases/get-workspace-detail.ts";
import type { ListWorkspacesUseCase } from "../../application/use-cases/list-workspaces.ts";

export type WorkspaceHttpDependencies = {
  readonly listWorkspaces: ListWorkspacesUseCase;
  readonly getWorkspaceDetail: GetWorkspaceDetailUseCase;
  readonly createWorkspace: CreateWorkspaceUseCase;
  readonly deleteWorkspace: DeleteWorkspaceUseCase;
  readonly bootstrapTtlSeconds: number;
  readonly deleteFailedRetryReconciled?: boolean;
};
