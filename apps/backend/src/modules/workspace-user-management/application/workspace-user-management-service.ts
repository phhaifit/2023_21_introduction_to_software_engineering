import type { WorkspaceUserManagementRepository } from "../domain/workspace-user-management-repository.ts";
import type { WorkspaceMemberResponse, WorkspaceMemberListResponse, InviteMemberRequest, InvitationResponse } from "@vcp/shared/contracts/index.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import type { EmailService } from "../../../shared/email/email-service.ts";

export type WorkspaceUserManagementServiceDependencies = {
  repository: WorkspaceUserManagementRepository;
  emailService: EmailService;
  frontendUrl: string;
  generateId: () => string;
  sessionRepository?: any;
};

export class WorkspaceUserManagementService {
  private repository: WorkspaceUserManagementRepository;
  private emailService: EmailService;
  private frontendUrl: string;
  private generateId: () => string;
  private sessionRepository?: any;
  private inviteHistory: Map<string, Date[]> = new Map();

  constructor(deps: WorkspaceUserManagementServiceDependencies) {
    this.repository = deps.repository;
    this.emailService = deps.emailService;
    this.frontendUrl = deps.frontendUrl;
    this.generateId = deps.generateId;
    this.sessionRepository = deps.sessionRepository;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberListResponse> {
    const members = await this.repository.getWorkspaceMembers(workspaceId);
    const invitations = await this.repository.getInvitations(workspaceId);

    return {
      members: members.map(m => ({
        memberId: m.memberId,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        status: m.isAccepted ? "active" : "inactive",
        createdAt: m.joinedAt || new Date().toISOString(),
      })),
      invitations,
    };
  }

  async inviteMember(
    workspaceId: string, 
    request: InviteMemberRequest, 
    invitedByUserId: string,
    inviterEmail: string
  ): Promise<InvitationResponse> {
    // 1. Self-invite check
    if (request.email === inviterEmail) {
      throw new Error("You cannot invite yourself.");
    }

    // 2. Duplicate member check
    const targetUserId = await this.repository.getUserIdByEmail(request.email);
    if (targetUserId) {
      const existingMember = await this.repository.getWorkspaceMember(workspaceId, targetUserId);
      if (existingMember && existingMember.isAccepted) {
        throw new Error("User is already a member of this workspace.");
      }
    }

    // 3. Rate Limit check (10 invites per admin per hour)
    const history = this.inviteHistory.get(invitedByUserId) || [];
    const oneHourAgo = Date.now() - 3600000;
    const recent = history.filter(t => t.getTime() > oneHourAgo);
    if (recent.length >= 10) {
      throw new Error("Rate limit exceeded. You can only invite up to 10 members per hour.");
    }

    const invitations = await this.repository.getInvitations(workspaceId);
    if (invitations.some(i => i.email === request.email && i.status === "pending")) {
      throw new Error("User already has a pending invitation.");
    }

    recent.push(new Date());
    this.inviteHistory.set(invitedByUserId, recent);

    const invitation: InvitationResponse = {
      invitationId: this.generateId(),
      workspaceId,
      email: request.email,
      role: request.role,
      status: "pending",
      invitedByUserId,
      createdAt: new Date().toISOString(),
    };

    await this.repository.addInvitation(invitation);

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "MEMBER_INVITED",
      description: `Member ${request.email} invited as ${request.role === 'admin' ? 'Host' : request.role}.`,
      timestamp: new Date().toISOString()
    });

    // Send invitation email
    const acceptLink = `${this.frontendUrl}/accept-invite?code=${invitation.invitationId}&workspaceId=${workspaceId}`;
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>You've been invited!</h2>
        <p>User <b>${invitedByUserId}</b> has invited you to join workspace <b>${workspaceId}</b> as a <b>${request.role === 'admin' ? 'Host' : request.role}</b>.</p>
        <p>Click the button below to accept the invitation (You may need to log in or create an account first).</p>
        <a href="${acceptLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Accept Invitation</a>
      </div>
    `;

    await this.emailService.sendMail(
      request.email, 
      "Invitation to join workspace", 
      emailHtml
    );

    return invitation;
  }

  async acceptInvitation(code: string, userId: string): Promise<void> {
    const invitation = await this.repository.getInvitationByCode(code);
    if (!invitation || invitation.status !== "pending") {
      throw new Error("Invalid or expired invitation.");
    }

    // Mark as accepted
    await this.repository.updateInvitationStatus(invitation.invitationId, "accepted");

    // Add as member
    await this.repository.addWorkspaceMember({
      memberId: this.generateId(),
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
      isAccepted: true,
      joinedAt: new Date().toISOString(),
    });

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId: invitation.workspaceId,
      type: "MEMBER_JOINED",
      description: `Member ${userId} joined the workspace.`,
      timestamp: new Date().toISOString()
    });
  }

  async updateMemberRole(workspaceId: string, targetUserId: string, newRole: WorkspaceRole): Promise<void> {
    const member = await this.repository.getWorkspaceMember(workspaceId, targetUserId);
    if (!member) {
      throw new Error("Member not found.");
    }
    if (member.role === newRole) {
      return;
    }
    if (newRole !== "admin") {
      await this.ensureNotLastAdmin(workspaceId, targetUserId);
    }
    const oldRole = member.role;
    await this.repository.updateWorkspaceMemberRole(workspaceId, targetUserId, newRole);

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "ROLE_CHANGED",
      description: `Role of member ${targetUserId} changed from ${oldRole === 'admin' ? 'Host' : oldRole} to ${newRole === 'admin' ? 'Host' : newRole}.`,
      timestamp: new Date().toISOString()
    });
  }

  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    // 1. Try to remove active member
    const member = await this.repository.getWorkspaceMember(workspaceId, targetUserId);
    if (member) {
      await this.ensureNotLastAdmin(workspaceId, targetUserId);
      await this.repository.removeWorkspaceMember(workspaceId, targetUserId);

      // Invalidate target user sessions (simulate Force Logout)
      if (this.sessionRepository) {
        await this.sessionRepository.revokeAllForUser(targetUserId, new Date().toISOString());
      }

      await this.repository.addWorkspaceEvent({
        eventId: this.generateId(),
        workspaceId,
        type: "MEMBER_REMOVED",
        description: `Member ${targetUserId} was removed.`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 2. Try to revoke pending invitation
    const invitations = await this.repository.getInvitations(workspaceId);
    const invitation = invitations.find(i => i.invitationId === targetUserId || i.email === targetUserId);
    if (invitation && invitation.status === "pending") {
      await this.repository.updateInvitationStatus(invitation.invitationId, "revoked");

      await this.repository.addWorkspaceEvent({
        eventId: this.generateId(),
        workspaceId,
        type: "INVITE_REVOKED",
        description: `Invitation for ${invitation.email} was revoked.`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    throw new Error("Member not found.");
  }

  async listWorkspacesForUser(userId: string) {
    return this.repository.listWorkspacesByUserId(userId);
  }

  async listAllWorkspacesWithAccess(userId: string) {
    const allWorkspaces = await this.repository.listAllWorkspaces();
    const result = [];
    for (const ws of allWorkspaces) {
      const member = await this.repository.getWorkspaceMember(ws.workspaceId, userId);
      const isMember = !!(member && member.isAccepted);
      result.push({ ...ws, isMember });
    }
    return result;
  }

  async createWorkspace(name: string, userId: string): Promise<any> {
    const workspaceId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
    const workspace = {
      workspaceId,
      name,
      createdAt: new Date().toISOString(),
      ownerId: userId
    };
    await this.repository.createWorkspace(workspace);
    await this.repository.addWorkspaceMember({
      memberId: this.generateId(),
      workspaceId,
      userId,
      role: "admin",
      isAccepted: true,
      joinedAt: new Date().toISOString()
    });

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "WORKSPACE_CREATED",
      description: `Workspace was created by Host.`,
      timestamp: new Date().toISOString()
    });

    return workspace;
  }

  private async ensureNotLastAdmin(workspaceId: string, targetUserId: string) {
    const members = await this.repository.getWorkspaceMembers(workspaceId);
    const targetMember = members.find(m => m.userId === targetUserId);
    
    if (targetMember?.role === "admin") {
      const adminCount = members.filter(m => m.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error("Cannot demote or remove the last admin of the workspace.");
      }
    }
  }

  async listPendingInvitationsForEmail(email: string): Promise<any[]> {
    const invitations = await this.repository.getInvitationsByEmail(email);
    const pending = invitations.filter(i => i.status === "pending");

    const result = [];
    for (const inv of pending) {
      const workspace = await this.repository.getWorkspace(inv.workspaceId);
      result.push({
        ...inv,
        workspaceName: workspace ? workspace.name : inv.workspaceId,
      });
    }
    return result;
  }

  async listWorkspaceEvents(workspaceId: string, userId: string) {
    const members = await this.repository.getWorkspaceMembers(workspaceId);
    const isMember = members.some(m => m.userId === userId && m.isAccepted);
    if (!isMember) {
      throw new Error("You do not have access to this workspace.");
    }
    return this.repository.getWorkspaceEvents(workspaceId);
  }
}
