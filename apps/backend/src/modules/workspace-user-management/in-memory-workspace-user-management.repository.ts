import type { WorkspaceUserManagementRepository } from "./workspace-user-management.repository.ts";

export class InMemoryWorkspaceUserManagementRepository implements WorkspaceUserManagementRepository {
  private workspaces: any[] = [];
  private members: any[] = [];
  private invitations: any[] = [];
  private users: any[] = [
    { userId: "master-user-id", email: "mapmobile123456@gmail.com", name: "Master" }
  ];

  constructor() {
    this.members.push({
      memberId: "mock-member-master",
      workspaceId: "workspace-product-demo",
      userId: "master-user-id",
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async findUserByEmail(email: string) {
    return this.users.find(u => u.email === email) || null;
  }

  async findMember(workspaceId: string, userId: string) {
    return this.members.find(m => m.workspaceId === workspaceId && m.userId === userId) || null;
  }

  async findMemberById(memberId: string) {
    return this.members.find(m => m.memberId === memberId) || null;
  }

  async listMembers(workspaceId: string) {
    const workspaceMembers = this.members.filter(m => m.workspaceId === workspaceId);
    return workspaceMembers.map(m => {
      const user = this.users.find(u => u.userId === m.userId);
      return {
        ...m,
        email: user?.email,
        name: user?.name
      };
    });
  }

  async countAdmins(workspaceId: string) {
    return this.members.filter(m => m.workspaceId === workspaceId && m.role === "admin" && m.status === "active").length;
  }

  async updateMemberRole(memberId: string, role: string) {
    const idx = this.members.findIndex(m => m.memberId === memberId);
    if (idx !== -1) {
      this.members[idx].role = role;
      this.members[idx].updatedAt = new Date().toISOString();
      return this.members[idx];
    }
    return null;
  }

  async removeMember(memberId: string) {
    const idx = this.members.findIndex(m => m.memberId === memberId);
    if (idx !== -1) {
      const removed = this.members[idx];
      this.members.splice(idx, 1);
      return removed;
    }
    return null;
  }

  async addMember(data: any) {
    this.members.push(data);
    return data;
  }

  async findInvitation(invitationId: string) {
    return this.invitations.find(i => i.invitationId === invitationId) || null;
  }

  async findPendingInvitationByEmail(workspaceId: string, email: string) {
    return this.invitations.find(i => i.workspaceId === workspaceId && i.email === email && i.status === "pending") || null;
  }

  async listInvitations(workspaceId: string) {
    return this.invitations.filter(i => i.workspaceId === workspaceId && i.status === "pending");
  }

  async createInvitation(data: any) {
    data.status = "pending";
    this.invitations.push(data);
    return data;
  }

  async acceptInvitation(invitationId: string) {
    const idx = this.invitations.findIndex(i => i.invitationId === invitationId);
    if (idx !== -1) {
      this.invitations[idx].status = "accepted";
      this.invitations[idx].updatedAt = new Date().toISOString();
      return this.invitations[idx];
    }
    return null;
  }

  async revokeInvitation(invitationId: string) {
    const idx = this.invitations.findIndex(i => i.invitationId === invitationId);
    if (idx !== -1) {
      this.invitations[idx].status = "revoked";
      this.invitations[idx].updatedAt = new Date().toISOString();
      return this.invitations[idx];
    }
    return null;
  }
  async updateInvitationRole(invitationId: string, role: string) {
    const idx = this.invitations.findIndex(i => i.invitationId === invitationId);
    if (idx !== -1) {
      this.invitations[idx].role = role;
      this.invitations[idx].updatedAt = new Date().toISOString();
      return this.invitations[idx];
    }
    return null;
  }

  async createUser(data: { userId: string; email: string; name?: string }) {
    this.users.push(data);
    return data;
  }

  async createWorkspace(data: any) {
    this.workspaces.push(data);
    return data;
  }

  async listWorkspacesByUserId(userId: string) {
    const memberOf = this.members.filter(m => m.userId === userId).map(m => m.workspaceId);
    return this.workspaces.filter(w => memberOf.includes(w.workspaceId));
  }
}
