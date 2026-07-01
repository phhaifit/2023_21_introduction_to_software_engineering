import type { WorkspaceUserManagementRepository } from "../domain/workspace-user-management-repository.ts";
import type {
  AcceptInvitationResponse,
  AdminRequestResponse,
  WorkspaceMemberResponse,
  WorkspaceMemberListResponse,
  InviteMemberRequest,
  InvitationResponse
} from "@vcp/shared/contracts/index.ts";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import type { EmailService } from "../../../shared/email/email-service.ts";

export type WorkspaceUserManagementServiceDependencies = {
  repository: WorkspaceUserManagementRepository;
  emailService: EmailService;
  frontendUrl: string;
  generateId: () => string;
  sessionRepository?: any;
};

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  async listMembers(workspaceId: string, actorRole?: WorkspaceRole): Promise<WorkspaceMemberListResponse> {
    const members = await this.repository.getWorkspaceMembers(workspaceId);
    const invitations = await this.repository.getInvitations(workspaceId);
    const adminRequests = await this.repository.getAdminRequests(workspaceId);
    const memberResponses = await Promise.all(members.map(async (m) => ({
      memberId: m.memberId,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
      status: m.isAccepted ? "active" as const : "inactive" as const,
      createdAt: m.joinedAt || new Date().toISOString(),
      email: await this.repository.getEmailByUserId(m.userId) ?? undefined,
    })));

    return {
      members: memberResponses,
      invitations,
      adminRequests,
      currentUserRole: actorRole,
      permissions: this.permissionsForRole(actorRole),
    };
  }

  async inviteMember(
    workspaceId: string, 
    request: InviteMemberRequest, 
    invitedByUserId: string,
    inviterEmail: string,
    actorRole: WorkspaceRole
  ): Promise<InvitationResponse> {
    if (!WORKSPACE_ROLES.includes(request.role)) {
      throw new Error("Invalid workspace role.");
    }
    this.ensureCanInvite(actorRole, request.role);

    const email = request.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email address.");
    }

    // 1. Self-invite check
    if (email === inviterEmail.trim().toLowerCase()) {
      throw new Error("You cannot invite yourself.");
    }

    // 2. Duplicate member check
    const targetUserId = await this.repository.getUserIdByEmail(email);
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
    if (invitations.some(i => i.email.toLowerCase() === email && i.status === "pending")) {
      throw new Error("User already has a pending invitation.");
    }

    recent.push(new Date());
    this.inviteHistory.set(invitedByUserId, recent);

    const invitation: InvitationResponse = {
      invitationId: this.generateId(),
      workspaceId,
      email,
      role: request.role,
      status: "pending",
      invitedByUserId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
    };

    // Send invitation email
    const acceptLink = `${this.frontendUrl}/workspace/invitation/accept?token=${encodeURIComponent(invitation.invitationId)}`;
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>You've been invited!</h2>
        <p>User <b>${invitedByUserId}</b> has invited you to join workspace <b>${workspaceId}</b> as a <b>${this.roleLabel(request.role)}</b>.</p>
        <p>Click the button below to accept the invitation (You may need to log in or create an account first).</p>
        <a href="${acceptLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Accept Invitation</a>
      </div>
    `;

    await this.emailService.sendMail(
      email,
      "Invitation to join workspace", 
      emailHtml
    );

    await this.repository.addInvitation(invitation);

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "MEMBER_INVITED",
      actor: invitedByUserId,
      target: email,
      description: `Member ${email} invited as ${this.roleLabel(request.role)}.`,
      timestamp: new Date().toISOString()
    });

    return invitation;
  }

  async acceptInvitation(code: string, userId: string, userEmail: string): Promise<AcceptInvitationResponse> {
    const invitation = await this.repository.getInvitationByCode(code);
    if (!invitation) {
      throw new Error("Invalid invitation.");
    }
    if (invitation.status === "accepted") {
      throw new Error("Invitation already accepted.");
    }
    if (invitation.status === "revoked") {
      throw new Error("Invitation cancelled.");
    }
    if (this.isInvitationExpired(invitation)) {
      throw new Error("Invitation expired.");
    }
    if (invitation.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new Error("This invitation was sent to a different email account.");
    }
    const existingMember = await this.repository.getWorkspaceMember(invitation.workspaceId, userId);
    if (existingMember?.isAccepted) {
      throw new Error("User is already a member of this workspace.");
    }

    // Add as member
    await this.repository.addWorkspaceMember({
      memberId: this.generateId(),
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
      isAccepted: true,
      joinedAt: new Date().toISOString(),
    });

    // Mark as accepted only after the membership write succeeds.
    await this.repository.updateInvitationStatus(invitation.invitationId, "accepted");

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId: invitation.workspaceId,
      type: "MEMBER_JOINED",
      actor: userId,
      target: invitation.email,
      description: `Member ${userId} joined the workspace.`,
      timestamp: new Date().toISOString()
    });

    await this.emailService.sendMail(
      invitation.email,
      "Workspace invitation accepted",
      `<p>Your invitation to workspace <b>${invitation.workspaceId}</b> was accepted.</p>`
    );

    return {
      invitationId: invitation.invitationId,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role
    };
  }

  async rejectInvitation(code: string, userEmail: string): Promise<void> {
    const invitation = await this.repository.getInvitationByCode(code);
    if (!invitation) {
      throw new Error("Invalid invitation.");
    }
    if (invitation.status === "accepted") {
      throw new Error("Invitation already accepted.");
    }
    if (invitation.status === "revoked") {
      throw new Error("Invitation cancelled.");
    }
    if (this.isInvitationExpired(invitation)) {
      throw new Error("Invitation expired.");
    }
    if (invitation.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new Error("This invitation was sent to a different email account.");
    }

    await this.repository.updateInvitationStatus(invitation.invitationId, "revoked");
    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId: invitation.workspaceId,
      type: "INVITE_REJECTED",
      actor: userEmail,
      target: invitation.email,
      description: `Invitation for ${invitation.email} was rejected.`,
      timestamp: new Date().toISOString()
    });
    await this.emailService.sendMail(
      invitation.email,
      "Workspace invitation rejected",
      `<p>Your invitation to workspace <b>${invitation.workspaceId}</b> was rejected.</p>`
    );
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    newRole: WorkspaceRole,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<WorkspaceMemberResponse> {
    if (!WORKSPACE_ROLES.includes(newRole)) {
      throw new Error("Invalid workspace role.");
    }
    const member = await this.repository.getWorkspaceMemberByMemberId(workspaceId, memberId);
    if (!member) {
      throw new Error("Member not found.");
    }
    if (member.userId === actorUserId && member.role === "host") {
      throw new Error("Host must transfer ownership before changing their own role.");
    }
    if (member.role === "host" || newRole === "host") {
      throw new Error("Use transfer host to change workspace ownership.");
    }
    this.ensureCanChangeRole(actorRole, newRole);
    if (actorRole === "admin" && member.role === "admin") {
      throw new Error("Admin cannot manage another Admin.");
    }
    if (member.role === newRole) {
      return this.toMemberResponse(member);
    }
    const oldRole = member.role;
    await this.repository.updateWorkspaceMemberRole(workspaceId, memberId, newRole);

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "ROLE_CHANGED",
      actor: actorUserId,
      target: member.userId,
      description: `Role of member ${member.userId} changed from ${this.roleLabel(oldRole)} to ${this.roleLabel(newRole)}.`,
      timestamp: new Date().toISOString()
    });

    await this.sendMemberNotification(
      member.userId,
      "Workspace role changed",
      `<p>Your role in workspace <b>${workspaceId}</b> changed from <b>${this.roleLabel(oldRole)}</b> to <b>${this.roleLabel(newRole)}</b>.</p>`
    );

    return this.toMemberResponse({ ...member, role: newRole });
  }

  async removeMember(
    workspaceId: string,
    targetId: string,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<void> {
    this.ensureCanMutateMembers(actorRole);
    // 1. Try to remove active member
    const member = await this.repository.getWorkspaceMemberByMemberId(workspaceId, targetId);
    if (member) {
      this.ensureCanRemove(actorRole, member.role);
      if (member.userId === actorUserId && member.role === "host") {
        throw new Error("Host must transfer ownership before leaving the workspace.");
      }
      await this.repository.removeWorkspaceMember(workspaceId, targetId);

      // Invalidate target user sessions (simulate Force Logout)
      if (this.sessionRepository) {
        await this.sessionRepository.revokeAllForUser(member.userId, new Date().toISOString());
      }

      await this.repository.addWorkspaceEvent({
        eventId: this.generateId(),
        workspaceId,
        type: "MEMBER_REMOVED",
        actor: actorUserId,
        target: member.userId,
        description: `Member ${member.userId} was removed.`,
        timestamp: new Date().toISOString()
      });
      await this.sendMemberNotification(
        member.userId,
        "Removed from workspace",
        `<p>You were removed from workspace <b>${workspaceId}</b>.</p>`
      );
      return;
    }

    // 2. Try to revoke pending invitation
    await this.cancelInvitation(workspaceId, targetId, actorUserId, actorRole);
  }

  async updateInvitationRole(
    workspaceId: string,
    invitationId: string,
    newRole: WorkspaceRole,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<InvitationResponse> {
    if (!WORKSPACE_ROLES.includes(newRole)) {
      throw new Error("Invalid workspace role.");
    }
    const invitation = await this.findPendingInvitation(workspaceId, invitationId);
    this.ensureCanManageInvitationTarget(actorRole, invitation.role);
    this.ensureCanInvite(actorRole, newRole);
    const oldRole = invitation.role;
    if (oldRole !== newRole) {
      await this.emailService.sendMail(
        invitation.email,
        "Workspace invitation role updated",
        `<p>Your invitation role was updated to <b>${this.roleLabel(newRole)}</b>.</p>`
      );

      await this.repository.updateInvitationRole(invitation.invitationId, newRole);
      await this.repository.addWorkspaceEvent({
        eventId: this.generateId(),
        workspaceId,
        type: "INVITE_ROLE_CHANGED",
        actor: actorUserId,
        target: invitation.email,
        description: `Invitation for ${invitation.email} changed from ${this.roleLabel(oldRole)} to ${this.roleLabel(newRole)} by ${actorUserId}.`,
        timestamp: new Date().toISOString()
      });
    }

    return { ...invitation, role: newRole };
  }

  async cancelInvitation(
    workspaceId: string,
    invitationId: string,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<void> {
    this.ensureCanManageInvitations(actorRole);
    const invitation = await this.findPendingInvitation(workspaceId, invitationId);
    this.ensureCanManageInvitationTarget(actorRole, invitation.role);

    await this.emailService.sendMail(
      invitation.email,
      "Workspace invitation cancelled",
      `<p>Your invitation to workspace <b>${workspaceId}</b> was cancelled.</p>`
    );

    await this.repository.deleteInvitation(invitation.invitationId);

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "INVITE_REVOKED",
      actor: actorUserId,
      target: invitation.email,
      description: `Invitation for ${invitation.email} was revoked by ${actorUserId}.`,
      timestamp: new Date().toISOString()
    });
  }

  async transferHost(
    workspaceId: string,
    newHostMemberId: string,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<WorkspaceMemberResponse> {
    if (actorRole !== "host") {
      throw new Error("Only Host can transfer workspace ownership.");
    }

    const members = await this.repository.getWorkspaceMembers(workspaceId);
    const currentHost = members.find(member => member.userId === actorUserId && member.role === "host");
    if (!currentHost) {
      throw new Error("Current Host membership not found.");
    }
    const newHost = members.find(member => member.memberId === newHostMemberId && member.isAccepted);
    if (!newHost) {
      throw new Error("Member not found.");
    }
    if (newHost.memberId === currentHost.memberId) {
      return this.toMemberResponse(newHost);
    }

    await this.repository.updateWorkspaceMemberRole(workspaceId, currentHost.memberId, "admin");
    await this.repository.updateWorkspaceMemberRole(workspaceId, newHost.memberId, "host");

    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "HOST_TRANSFERRED",
      actor: actorUserId,
      target: newHost.userId,
      description: `Host transferred from ${currentHost.userId} to ${newHost.userId}.`,
      timestamp: new Date().toISOString()
    });

    await this.sendMemberNotification(
      newHost.userId,
      "Workspace Host transferred",
      `<p>Workspace ownership was transferred to you.</p>`
    );
    await this.sendMemberNotification(
      currentHost.userId,
      "Workspace Host transferred",
      `<p>You are now an Admin after transferring workspace ownership.</p>`
    );

    return this.toMemberResponse({ ...newHost, role: "host" });
  }

  async requestAdminRole(
    workspaceId: string,
    requesterUserId: string,
    requesterRole: WorkspaceRole
  ): Promise<AdminRequestResponse> {
    if (requesterRole === "host" || requesterRole === "admin") {
      throw new Error("User already has administrative permissions.");
    }
    const member = await this.repository.getWorkspaceMember(workspaceId, requesterUserId);
    if (!member || !member.isAccepted) {
      throw new Error("Member not found.");
    }
    const requests = await this.repository.getAdminRequests(workspaceId);
    if (requests.some(request => request.memberId === member.memberId && request.status === "pending")) {
      throw new Error("Admin request already pending.");
    }

    const request: AdminRequestResponse = {
      requestId: this.generateId(),
      workspaceId,
      memberId: member.memberId,
      requester: requesterUserId,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await this.repository.addAdminRequest(request);
    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "ADMIN_REQUESTED",
      actor: requesterUserId,
      target: requesterUserId,
      description: `${requesterUserId} requested Admin permission.`,
      timestamp: new Date().toISOString()
    });

    return request;
  }

  async approveAdminRequest(
    workspaceId: string,
    requestId: string,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<AdminRequestResponse> {
    if (actorRole !== "host") {
      throw new Error("Only Host can approve Admin requests.");
    }
    const request = await this.findPendingAdminRequest(workspaceId, requestId);
    const member = await this.repository.getWorkspaceMemberByMemberId(workspaceId, request.memberId);
    if (!member || !member.isAccepted) {
      throw new Error("Member not found.");
    }

    const resolvedAt = new Date().toISOString();
    await this.repository.updateWorkspaceMemberRole(workspaceId, member.memberId, "admin");
    await this.repository.updateAdminRequestStatus(request.requestId, "approved", actorUserId, resolvedAt);
    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "ADMIN_REQUEST_APPROVED",
      actor: actorUserId,
      target: member.userId,
      description: `${actorUserId} approved Admin permission for ${member.userId}.`,
      timestamp: resolvedAt
    });

    return { ...request, status: "approved", resolvedBy: actorUserId, resolvedAt };
  }

  async rejectAdminRequest(
    workspaceId: string,
    requestId: string,
    actorUserId: string,
    actorRole: WorkspaceRole
  ): Promise<AdminRequestResponse> {
    if (actorRole !== "host") {
      throw new Error("Only Host can reject Admin requests.");
    }
    const request = await this.findPendingAdminRequest(workspaceId, requestId);
    const resolvedAt = new Date().toISOString();
    await this.repository.updateAdminRequestStatus(request.requestId, "rejected", actorUserId, resolvedAt);
    await this.repository.addWorkspaceEvent({
      eventId: this.generateId(),
      workspaceId,
      type: "ADMIN_REQUEST_REJECTED",
      actor: actorUserId,
      target: request.requester,
      description: `${actorUserId} rejected Admin permission for ${request.requester}.`,
      timestamp: resolvedAt
    });

    return { ...request, status: "rejected", resolvedBy: actorUserId, resolvedAt };
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
    const events = await this.repository.getWorkspaceEvents(workspaceId);
    return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }

  private toMemberResponse(member: {
    memberId: string;
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    isAccepted: boolean;
    joinedAt?: string;
  }): WorkspaceMemberResponse {
    return {
      memberId: member.memberId,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
      status: member.isAccepted ? "active" : "inactive",
      createdAt: member.joinedAt || new Date().toISOString()
    };
  }

  private ensureCanInvite(actorRole: WorkspaceRole, targetRole: WorkspaceRole): void {
    this.ensureCanMutateMembers(actorRole);
    if (targetRole === "host") {
      throw new Error("Use transfer host to change workspace ownership.");
    }
    if (actorRole === "admin" && !["editor", "viewer"].includes(targetRole)) {
      throw new Error("Admin can only invite Editor or Viewer.");
    }
  }

  private ensureCanChangeRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): void {
    this.ensureCanMutateMembers(actorRole);
    if (targetRole === "host") {
      throw new Error("Use transfer host to change workspace ownership.");
    }
    if (actorRole === "admin" && !["editor", "viewer"].includes(targetRole)) {
      throw new Error("Admin can only assign Editor or Viewer.");
    }
  }

  private ensureCanRemove(actorRole: WorkspaceRole, targetRole: WorkspaceRole): void {
    this.ensureCanMutateMembers(actorRole);
    if (targetRole === "host") {
      throw new Error("Host cannot be removed. Transfer ownership first.");
    }
    if (actorRole === "admin" && !["editor", "viewer"].includes(targetRole)) {
      throw new Error("Admin can only remove Editor or Viewer.");
    }
  }

  private ensureCanManageInvitations(actorRole: WorkspaceRole): void {
    this.ensureCanMutateMembers(actorRole);
  }

  private ensureCanManageInvitationTarget(actorRole: WorkspaceRole, invitationRole: WorkspaceRole): void {
    if (actorRole === "admin" && !["editor", "viewer"].includes(invitationRole)) {
      throw new Error("Admin can only manage Editor or Viewer invitations.");
    }
  }

  private ensureCanMutateMembers(actorRole: WorkspaceRole): void {
    if (actorRole === "viewer") {
      throw new Error("Viewer can only view the member list.");
    }
    if (actorRole === "editor") {
      throw new Error("Editor can only view the member list.");
    }
  }

  private async findPendingInvitation(workspaceId: string, invitationId: string): Promise<InvitationResponse> {
    const invitations = await this.repository.getInvitations(workspaceId);
    const invitation = invitations.find(i => i.invitationId === invitationId || i.email === invitationId);
    if (!invitation || invitation.status !== "pending") {
      throw new Error("Pending invitation not found.");
    }
    return invitation;
  }

  private async findPendingAdminRequest(workspaceId: string, requestId: string): Promise<AdminRequestResponse> {
    const requests = await this.repository.getAdminRequests(workspaceId);
    const request = requests.find(item => item.requestId === requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Pending Admin request not found.");
    }
    return request;
  }

  private isInvitationExpired(invitation: InvitationResponse): boolean {
    if (!invitation.expiresAt) return false;
    const expiresAt = Date.parse(invitation.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  }

  private async sendMemberNotification(userId: string, subject: string, html: string): Promise<void> {
    const email = await this.repository.getEmailByUserId(userId);
    if (!email) {
      return;
    }
    await this.emailService.sendMail(email, subject, html);
  }

  private roleLabel(role: WorkspaceRole): string {
    const labels: Record<WorkspaceRole, string> = {
      host: "Host",
      admin: "Admin",
      editor: "Editor",
      viewer: "Viewer"
    };
    return labels[role];
  }

  private permissionsForRole(role?: WorkspaceRole): WorkspaceMemberListResponse["permissions"] {
    return {
      canInvite: role === "host" || role === "admin",
      canManagePendingInvitations: role === "host" || role === "admin",
      canChangeMemberRoles: role === "host" || role === "admin",
      canRemoveMembers: role === "host" || role === "admin",
      canTransferHost: role === "host"
    };
  }
}
