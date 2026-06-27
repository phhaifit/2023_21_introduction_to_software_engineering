import type { WorkspaceAccessQueryPort } from "../ports/workspace-access-query-port.ts";
import type { WorkspaceClock } from "../ports/workspace-clock.ts";
import type {
  WorkspaceKeysetCursor,
  WorkspacePersistenceRecord
} from "../ports/workspace-persistence-types.ts";
import type { WorkspaceRepository } from "../ports/workspace-repository.ts";
import type { WorkspaceVisibilityProjectionRepository } from "../ports/workspace-visibility-projection-repository.ts";
import { hasValidPendingBootstrapAccess } from "../services/workspace-operation-planner.ts";

export type ListWorkspacesUseCaseResult = {
  readonly workspaces: readonly WorkspacePersistenceRecord[];
  readonly nextCursor: WorkspaceKeysetCursor | null;
  readonly hasMore: boolean;
};

export class ListWorkspacesUseCase {
  private readonly workspaces: WorkspaceRepository;
  private readonly visibility: WorkspaceVisibilityProjectionRepository;
  private readonly access: WorkspaceAccessQueryPort;
  private readonly clock: WorkspaceClock;

  constructor(
    workspaces: WorkspaceRepository,
    visibility: WorkspaceVisibilityProjectionRepository,
    access: WorkspaceAccessQueryPort,
    clock: WorkspaceClock
  ) {
    this.workspaces = workspaces;
    this.visibility = visibility;
    this.access = access;
    this.clock = clock;
  }

  async execute(input: {
    actorUserId: string;
    cursor: WorkspaceKeysetCursor | null;
    limit: number;
  }): Promise<ListWorkspacesUseCaseResult> {
    const pageLimit = input.limit + 1;
    const projectionPage = await this.visibility.listCandidateWorkspaceIds({
      userId: input.actorUserId,
      cursor: input.cursor
        ? {
            projectionUpdatedAt: input.cursor.updatedAt,
            workspaceId: input.cursor.workspaceId
          }
        : undefined,
      limit: pageLimit
    });

    const accessibleProjection = await this.access.filterAccessibleWorkspaceIds({
      userId: input.actorUserId,
      workspaceIds: [...projectionPage.workspaceIds],
      requiredPermission: "workspace:read"
    });

    const pendingBootstrap = await this.workspaces.findPendingBootstrapByCreator({
      createdByUserId: input.actorUserId,
      now: this.clock.now(),
      cursor: input.cursor ?? undefined,
      limit: pageLimit
    });

    const bootstrapIds = pendingBootstrap
      .filter((workspace) =>
        hasValidPendingBootstrapAccess({
          workspace,
          actorUserId: input.actorUserId,
          now: this.clock.now()
        })
      )
      .map((workspace) => workspace.workspaceId);

    const workspaceIds = dedupe([
      ...accessibleProjection.accessibleWorkspaceIds,
      ...bootstrapIds
    ]);
    const loaded = await this.workspaces.findByIds({
      workspaceIds,
      excludeDeleted: true
    });

    const accessibleProjectionSet = new Set(accessibleProjection.accessibleWorkspaceIds);
    const bootstrapSet = new Set(bootstrapIds);
    const eligible = loaded
      .filter((workspace) => workspace.status !== "deleted")
      .filter((workspace) => {
        if (accessibleProjectionSet.has(workspace.workspaceId)) {
          return true;
        }

        return (
          bootstrapSet.has(workspace.workspaceId) &&
          hasValidPendingBootstrapAccess({
            workspace,
            actorUserId: input.actorUserId,
            now: this.clock.now()
          })
        );
      })
      .filter((workspace) => !input.cursor || isAfterCursor(workspace, input.cursor))
      .sort(compareWorkspaceListOrder);

    const page = eligible.slice(0, input.limit);
    const hasMore =
      eligible.length > input.limit ||
      projectionPage.nextCursor !== null ||
      pendingBootstrap.length > input.limit;
    const last = page[page.length - 1] ?? null;

    return {
      workspaces: page,
      hasMore,
      nextCursor:
        hasMore && last
          ? {
              updatedAt: last.updatedAt,
              workspaceId: last.workspaceId
            }
          : null
    };
  }
}

function compareWorkspaceListOrder(
  left: WorkspacePersistenceRecord,
  right: WorkspacePersistenceRecord
): number {
  const updated = right.updatedAt.localeCompare(left.updatedAt);
  if (updated !== 0) {
    return updated;
  }

  return left.workspaceId.localeCompare(right.workspaceId);
}

function isAfterCursor(
  workspace: WorkspacePersistenceRecord,
  cursor: WorkspaceKeysetCursor
): boolean {
  if (workspace.updatedAt < cursor.updatedAt) {
    return true;
  }

  return (
    workspace.updatedAt === cursor.updatedAt &&
    workspace.workspaceId > cursor.workspaceId
  );
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
