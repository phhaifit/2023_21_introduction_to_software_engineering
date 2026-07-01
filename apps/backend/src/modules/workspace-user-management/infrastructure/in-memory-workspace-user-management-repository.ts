import type { AdminRequestResponse, Workspace, WorkspaceMember, InvitationResponse } from "@vcp/shared/contracts/index.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import type { WorkspaceUserManagementRepository, WorkspaceEvent } from "../domain/workspace-user-management-repository.ts";

export class InMemoryWorkspaceUserManagementRepository implements WorkspaceUserManagementRepository {
  private workspaces: Map<string, Workspace> = new Map();
  private members: Map<string, WorkspaceMember> = new Map();
  private invitations: Map<string, InvitationResponse> = new Map();
  private adminRequests: Map<string, AdminRequestResponse> = new Map();
  private events: WorkspaceEvent[] = [];

  async createWorkspace(workspace: Workspace): Promise<void> {
    this.workspaces.set(workspace.workspaceId, workspace);
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return this.workspaces.get(workspaceId) || null;
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return Array.from(this.members.values()).filter(m => m.workspaceId === workspaceId);
  }

  async getWorkspaceMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const members = await this.getWorkspaceMembers(workspaceId);
    return members.find(m => m.userId === userId) || null;
  }

  async getWorkspaceMemberByMemberId(workspaceId: string, memberId: string): Promise<WorkspaceMember | null> {
    const member = this.members.get(memberId);
    return member?.workspaceId === workspaceId ? member : null;
  }

  async addWorkspaceMember(member: WorkspaceMember): Promise<void> {
    this.members.set(member.memberId, member);
  }

  async updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: WorkspaceRole): Promise<void> {
    const member = await this.getWorkspaceMemberByMemberId(workspaceId, memberId);
    if (member) {
      member.role = role;
      this.members.set(member.memberId, member);
    }
  }

  async removeWorkspaceMember(workspaceId: string, memberId: string): Promise<void> {
    const member = await this.getWorkspaceMemberByMemberId(workspaceId, memberId);
    if (member) {
      this.members.delete(member.memberId);
    }
  }

  async getInvitations(workspaceId: string): Promise<InvitationResponse[]> {
    return Array.from(this.invitations.values()).filter(i => i.workspaceId === workspaceId);
  }

  async getInvitationsByEmail(email: string): Promise<InvitationResponse[]> {
    return Array.from(this.invitations.values()).filter(i => i.email === email);
  }

  async getInvitationByCode(code: string): Promise<InvitationResponse | null> {
    // We treat invitationId as the code here for simplicity
    return this.invitations.get(code) || null;
  }

  async addInvitation(invitation: InvitationResponse): Promise<void> {
    this.invitations.set(invitation.invitationId, invitation);
  }

  async updateInvitationStatus(invitationId: string, status: "pending" | "accepted" | "revoked"): Promise<void> {
    const inv = this.invitations.get(invitationId);
    if (inv) {
      inv.status = status;
      this.invitations.set(invitationId, inv);
    }
  }

  async updateInvitationRole(invitationId: string, role: WorkspaceRole): Promise<void> {
    const inv = this.invitations.get(invitationId);
    if (inv) {
      inv.role = role;
      this.invitations.set(invitationId, inv);
    }
  }

  async deleteInvitation(invitationId: string): Promise<void> {
    this.invitations.delete(invitationId);
  }

  async getAdminRequests(workspaceId: string): Promise<AdminRequestResponse[]> {
    return Array.from(this.adminRequests.values()).filter(request => request.workspaceId === workspaceId);
  }

  async addAdminRequest(request: AdminRequestResponse): Promise<void> {
    this.adminRequests.set(request.requestId, request);
  }

  async updateAdminRequestStatus(
    requestId: string,
    status: "approved" | "rejected",
    resolvedBy: string,
    resolvedAt: string
  ): Promise<void> {
    const request = this.adminRequests.get(requestId);
    if (request) {
      this.adminRequests.set(requestId, { ...request, status, resolvedBy, resolvedAt });
    }
  }

  async getUserIdByEmail(email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const localEmailUserEmail = process.env.GMAIL_USER?.trim().toLowerCase();
    const emailToUserMap = new Map<string, string>();
    emailToUserMap.set("dev@local.test", "local-dev-user");
    if (localEmailUserEmail) {
      emailToUserMap.set(localEmailUserEmail, "local-email-user");
    }
    return emailToUserMap.get(normalizedEmail) || normalizedEmail; // fallback to email as userId
  }

  async getEmailByUserId(userId: string): Promise<string | null> {
    const localEmailUserEmail = process.env.GMAIL_USER?.trim().toLowerCase();
    const userToEmailMap = new Map<string, string>();
    userToEmailMap.set("local-dev-user", "dev@local.test");
    if (localEmailUserEmail) {
      userToEmailMap.set("local-email-user", localEmailUserEmail);
    }
    if (userId.includes("@")) {
      return userId;
    }
    return userToEmailMap.get(userId) || null;
  }

  async addWorkspaceEvent(event: WorkspaceEvent): Promise<void> {
    this.events.push(event);
  }

  async getWorkspaceEvents(workspaceId: string): Promise<WorkspaceEvent[]> {
    return this.events.filter(e => e.workspaceId === workspaceId);
  }
}
