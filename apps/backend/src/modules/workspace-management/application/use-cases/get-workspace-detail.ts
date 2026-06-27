import type { WorkspaceAccessQueryPort } from "../ports/workspace-access-query-port.ts";
import type { WorkspaceClock } from "../ports/workspace-clock.ts";
import type { WorkspacePersistenceRecord } from "../ports/workspace-persistence-types.ts";
import type { WorkspaceRepository } from "../ports/workspace-repository.ts";
import { hasValidPendingBootstrapAccess } from "../services/workspace-operation-planner.ts";

export type GetWorkspaceDetailUseCaseResult =
  | {
      readonly kind: "found";
      readonly workspace: WorkspacePersistenceRecord;
    }
  | {
      readonly kind: "not_found" | "forbidden" | "unavailable";
    };

export class GetWorkspaceDetailUseCase {
  private readonly workspaces: WorkspaceRepository;
  private readonly access: WorkspaceAccessQueryPort;
  private readonly clock: WorkspaceClock;

  constructor(
    workspaces: WorkspaceRepository,
    access: WorkspaceAccessQueryPort,
    clock: WorkspaceClock
  ) {
    this.workspaces = workspaces;
    this.access = access;
    this.clock = clock;
  }

  async execute(input: {
    actorUserId: string;
    workspaceId: string;
  }): Promise<GetWorkspaceDetailUseCaseResult> {
    const workspace = await this.workspaces.findById(input.workspaceId);
    if (!workspace || workspace.status === "deleted") {
      return { kind: "not_found" };
    }

    const access = await this.access.getWorkspaceAccess({
      workspaceId: input.workspaceId,
      userId: input.actorUserId
    });

    if (access.kind === "allowed") {
      return { kind: "found", workspace };
    }

    if (
      hasValidPendingBootstrapAccess({
        workspace,
        actorUserId: input.actorUserId,
        now: this.clock.now()
      })
    ) {
      return { kind: "found", workspace };
    }

    if (access.reason === "forbidden") {
      return { kind: "forbidden" };
    }

    if (access.reason === "unavailable") {
      return { kind: "unavailable" };
    }

    return { kind: "not_found" };
  }
}
