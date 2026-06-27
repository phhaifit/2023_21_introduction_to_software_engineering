import type {
  WorkspaceProjectionCandidatePage,
  WorkspaceTransaction,
  WorkspaceVisibilityCursor,
  WorkspaceVisibilityProjectionRecord
} from "../../application/ports/workspace-persistence-types.ts";
import type { WorkspaceVisibilityProjectionRepository } from "../../application/ports/workspace-visibility-projection-repository.ts";

export class InMemoryWorkspaceVisibilityProjectionRepository
  implements WorkspaceVisibilityProjectionRepository
{
  readonly records: WorkspaceVisibilityProjectionRecord[] = [];

  seed(record: WorkspaceVisibilityProjectionRecord): void {
    this.records.push(record);
  }

  async upsertAccess(input: {
    userId: string;
    workspaceId: string;
    canRead: boolean;
    canDelete: boolean;
    membershipVersion: number;
    projectionUpdatedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceVisibilityProjectionRecord> {
    const now = input.projectionUpdatedAt;
    const record: WorkspaceVisibilityProjectionRecord = {
      projectionId: `projection-${input.userId}-${input.workspaceId}`,
      userId: input.userId,
      workspaceId: input.workspaceId,
      canRead: input.canRead,
      canDelete: input.canDelete,
      membershipVersion: input.membershipVersion,
      projectionUpdatedAt: now,
      createdAt: now,
      updatedAt: now
    };
    const existing = this.records.findIndex(
      (r) => r.userId === input.userId && r.workspaceId === input.workspaceId
    );
    if (existing >= 0) {
      this.records[existing] = record;
    } else {
      this.records.push(record);
    }
    return record;
  }

  async revokeAccess(input: {
    userId: string;
    workspaceId: string;
    membershipVersion: number;
    projectionUpdatedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<boolean> {
    await this.upsertAccess({ ...input, canRead: false, canDelete: false });
    return true;
  }

  async listCandidateWorkspaceIds(input: {
    userId: string;
    cursor?: WorkspaceVisibilityCursor;
    limit: number;
    tx?: WorkspaceTransaction;
  }): Promise<WorkspaceProjectionCandidatePage> {
    const candidates = this.records
      .filter((r) => r.userId === input.userId && r.canRead)
      .filter((r) => !input.cursor || isAfterCursor(r, input.cursor!))
      .sort((a, b) => {
        const diff = b.projectionUpdatedAt.localeCompare(a.projectionUpdatedAt);
        return diff !== 0 ? diff : a.workspaceId.localeCompare(b.workspaceId);
      });

    const page = candidates.slice(0, input.limit);
    const last = page[page.length - 1] ?? null;
    return {
      workspaceIds: page.map((r) => r.workspaceId),
      nextCursor:
        candidates.length > input.limit && last
          ? { projectionUpdatedAt: last.projectionUpdatedAt, workspaceId: last.workspaceId }
          : null
    };
  }
}

function isAfterCursor(
  r: WorkspaceVisibilityProjectionRecord,
  cursor: WorkspaceVisibilityCursor
): boolean {
  if (r.projectionUpdatedAt < cursor.projectionUpdatedAt) return true;
  return (
    r.projectionUpdatedAt === cursor.projectionUpdatedAt &&
    r.workspaceId > cursor.workspaceId
  );
}
