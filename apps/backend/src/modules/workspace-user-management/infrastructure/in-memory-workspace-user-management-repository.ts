import type { Workspace, WorkspaceMember, InvitationResponse } from "@vcp/shared/contracts/index.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import type { WorkspaceUserManagementRepository, WorkspaceEvent } from "../domain/workspace-user-management-repository.ts";

export class InMemoryWorkspaceUserManagementRepository implements WorkspaceUserManagementRepository {
  private workspaces: Map<string, Workspace> = new Map();
  private members: Map<string, WorkspaceMember> = new Map();
  private invitations: Map<string, InvitationResponse> = new Map();
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

  async addWorkspaceMember(member: WorkspaceMember): Promise<void> {
    this.members.set(member.memberId, member);
  }

  async updateWorkspaceMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    const member = await this.getWorkspaceMember(workspaceId, userId);
    if (member) {
      member.role = role;
      this.members.set(member.memberId, member);
    }
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    const member = await this.getWorkspaceMember(workspaceId, userId);
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

  async listWorkspacesByUserId(userId: string): Promise<Workspace[]> {
    const userMemberWorkspaces = Array.from(this.members.values())
      .filter(m => m.userId === userId)
      .map(m => m.workspaceId);
      
    return Array.from(this.workspaces.values())
      .filter(w => userMemberWorkspaces.includes(w.workspaceId));
  }

  async listAllWorkspaces(): Promise<Workspace[]> {
    return Array.from(this.workspaces.values());
  }

  async getUserIdByEmail(email: string): Promise<string | null> {
    const emailToUserMap = new Map<string, string>([
      ["dev@local.test", "local-dev-user"],
      ["mapmobile123456@gmail.com", "local-dev-user"]
    ]);
    return emailToUserMap.get(email) || email; // fallback to email as userId
  }

  async addWorkspaceEvent(event: WorkspaceEvent): Promise<void> {
    this.events.push(event);
  }

  async getWorkspaceEvents(workspaceId: string): Promise<WorkspaceEvent[]> {
    return this.events.filter(e => e.workspaceId === workspaceId);
  }
}
