import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceRepository, WorkspaceStatusUpdate, MembershipRecord } from "../application/workspace-repository.ts";
import type { Workspace } from "../domain/workspace.ts";
import { toDomain, toPrismaCreate } from "./prisma-workspace-mapper.ts";

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async save(workspace: Workspace): Promise<Workspace> {
    const data = toPrismaCreate(workspace);
    const row = await this.prisma.workspace.upsert({
      where: { workspaceId: data.workspaceId },
      create: data,
      update: data
    });
    return toDomain(row);
  }

  async findById(workspaceId: EntityId<"workspaceId">): Promise<Workspace | null> {
    const row = await this.prisma.workspace.findFirst({ where: { workspaceId } });
    return row ? toDomain(row) : null;
  }

  async listAccessibleByUser(userId: EntityId<"userId">): Promise<Workspace[]> {
    // Workspaces owned by this user
    const owned = await this.prisma.workspace.findMany({
      where: { userId, status: { not: "deleted" } },
      orderBy: { createdAt: "desc" }
    });

    // Workspaces where user is an active member (but not the owner)
    const memberLinks = await this.prisma.workspaceMember.findMany({
      where: { userId, status: "active" },
      select: { workspaceId: true }
    });

    const memberIds = memberLinks.map((m) => m.workspaceId);
    const ownedIds = new Set(owned.map((w) => w.workspaceId));

    const memberWorkspaces =
      memberIds.length > 0
        ? await this.prisma.workspace.findMany({
            where: {
              workspaceId: { in: memberIds.filter((id) => !ownedIds.has(id)) },
              status: { not: "deleted" }
            },
            orderBy: { createdAt: "desc" }
          })
        : [];

    return [...owned, ...memberWorkspaces].map(toDomain);
  }

  async findActiveMembershipByUser(userId: EntityId<"userId">): Promise<MembershipRecord | null> {
    const row = await this.prisma.workspaceMember.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
      select: { workspaceId: true, memberId: true, role: true }
    });

    if (!row) return null;

    return {
      workspaceId: row.workspaceId as EntityId<"workspaceId">,
      memberId: row.memberId as EntityId<"memberId">,
      role: row.role
    };
  }

  async updateStatus(
    workspaceId: EntityId<"workspaceId">,
    update: WorkspaceStatusUpdate,
    now: string
  ): Promise<Workspace> {
    const row = await this.prisma.workspace.update({
      where: { workspaceId },
      data: {
        ...(update.status !== undefined ? { status: update.status } : {}),
        ...(update.runtimeUrl !== undefined ? { runtimeUrl: update.runtimeUrl } : {}),
        ...(update.containerId !== undefined ? { containerId: update.containerId } : {}),
        ...(update.failureReason !== undefined ? { failureReason: update.failureReason } : {}),
        updatedAt: now
      }
    });
    return toDomain(row);
  }
}
