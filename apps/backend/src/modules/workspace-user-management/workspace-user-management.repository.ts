import type { PrismaClient } from "@vcp/database";
import type { WorkspaceRole } from "@vcp/shared/contracts/workspace-user-management.ts";

export class WorkspaceUserManagementRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // --- Users (Cross-boundary read for invite check) ---

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  // --- Members ---

  async findMember(workspaceId: string, userId: string) {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
  }

  async findMemberById(memberId: string) {
    return this.prisma.workspaceMember.findUnique({
      where: { memberId }
    });
  }

  async listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId }
    });
  }

  async countAdmins(workspaceId: string) {
    return this.prisma.workspaceMember.count({
      where: { workspaceId, role: "admin", status: "active" }
    });
  }

  async updateMemberRole(memberId: string, role: string) {
    return this.prisma.workspaceMember.update({
      where: { memberId },
      data: { role, updatedAt: new Date().toISOString() }
    });
  }

  async removeMember(memberId: string) {
    return this.prisma.workspaceMember.delete({
      where: { memberId }
    });
  }

  async addMember(data: { memberId: string; workspaceId: string; userId: string; role: string; createdAt: string; updatedAt: string }) {
    return this.prisma.workspaceMember.create({ data });
  }

  // --- Workspaces ---

  async createWorkspace(data: any) {
    return this.prisma.workspace.create({ data });
  }

  async listWorkspacesByUserId(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: { userId }
        }
      }
    });
  }

  // --- Invitations ---

  async findInvitation(invitationId: string) {
    return this.prisma.invitation.findUnique({
      where: { invitationId }
    });
  }

  async findPendingInvitationByEmail(workspaceId: string, email: string) {
    return this.prisma.invitation.findUnique({
      where: {
        workspaceId_email_status: { workspaceId, email, status: "pending" }
      }
    });
  }

  async listInvitations(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: { workspaceId, status: "pending" }
    });
  }

  async createInvitation(data: { invitationId: string; workspaceId: string; email: string; role: string; invitedByUserId: string; createdAt: string; updatedAt: string }) {
    return this.prisma.invitation.create({ data });
  }

  async acceptInvitation(invitationId: string) {
    return this.prisma.invitation.update({
      where: { invitationId },
      data: { status: "accepted", updatedAt: new Date().toISOString() }
    });
  }

  async revokeInvitation(invitationId: string) {
    return this.prisma.invitation.update({
      where: { invitationId },
      data: { status: "revoked", updatedAt: new Date().toISOString() }
    });
  }
}
