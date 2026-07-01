import { describe, expect, it, vi } from "vitest";

import type {
  AdminRequestResponse,
  InvitationResponse,
  Workspace,
  WorkspaceMember
} from "@vcp/shared/contracts/index.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";
import type {
  WorkspaceEvent,
  WorkspaceUserManagementRepository
} from "../domain/workspace-user-management-repository.ts";
import { WorkspaceUserManagementService } from "./workspace-user-management-service.ts";

const workspaceId = "workspace-1";
const hostUserId = "user-host";
const adminUserId = "user-admin";
const invitedUserId = "user-invited";

class FakeWorkspaceUserManagementRepository implements WorkspaceUserManagementRepository {
  workspaces = new Map<string, Workspace>();
  members = new Map<string, WorkspaceMember>();
  invitations = new Map<string, InvitationResponse>();
  adminRequests = new Map<string, AdminRequestResponse>();
  events: WorkspaceEvent[] = [];
  emailToUserId = new Map<string, string>();
  userIdToEmail = new Map<string, string>();

  async createWorkspace(workspace: Workspace): Promise<void> {
    this.workspaces.set(workspace.workspaceId, workspace);
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) ?? null;
  }

  async getWorkspaceMembers(id: string): Promise<WorkspaceMember[]> {
    return [...this.members.values()].filter((member) => member.workspaceId === id);
  }

  async getWorkspaceMember(id: string, userId: string): Promise<WorkspaceMember | null> {
    return (await this.getWorkspaceMembers(id)).find((member) => member.userId === userId) ?? null;
  }

  async getWorkspaceMemberByMemberId(id: string, memberId: string): Promise<WorkspaceMember | null> {
    const member = this.members.get(memberId);
    return member?.workspaceId === id ? member : null;
  }

  async addWorkspaceMember(member: WorkspaceMember): Promise<void> {
    this.members.set(member.memberId, { ...member });
  }

  async updateWorkspaceMemberRole(id: string, memberId: string, role: WorkspaceRole): Promise<void> {
    const member = await this.getWorkspaceMemberByMemberId(id, memberId);
    if (member) {
      this.members.set(member.memberId, { ...member, role });
    }
  }

  async removeWorkspaceMember(id: string, memberId: string): Promise<void> {
    const member = await this.getWorkspaceMemberByMemberId(id, memberId);
    if (member) {
      this.members.delete(member.memberId);
    }
  }

  async getInvitations(id: string): Promise<InvitationResponse[]> {
    return [...this.invitations.values()].filter((invitation) => invitation.workspaceId === id);
  }

  async getInvitationsByEmail(email: string): Promise<InvitationResponse[]> {
    return [...this.invitations.values()].filter((invitation) => invitation.email === email);
  }

  async getInvitationByCode(code: string): Promise<InvitationResponse | null> {
    return this.invitations.get(code) ?? null;
  }

  async getAdminRequests(id: string): Promise<AdminRequestResponse[]> {
    return [...this.adminRequests.values()].filter((request) => request.workspaceId === id);
  }

  async addAdminRequest(request: AdminRequestResponse): Promise<void> {
    this.adminRequests.set(request.requestId, { ...request });
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

  async addInvitation(invitation: InvitationResponse): Promise<void> {
    this.invitations.set(invitation.invitationId, { ...invitation });
  }

  async updateInvitationStatus(invitationId: string, status: "pending" | "accepted" | "revoked"): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (invitation) {
      this.invitations.set(invitationId, { ...invitation, status });
    }
  }

  async deleteInvitation(invitationId: string): Promise<void> {
    this.invitations.delete(invitationId);
  }

  async updateInvitationRole(invitationId: string, role: WorkspaceRole): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (invitation) {
      this.invitations.set(invitationId, { ...invitation, role });
    }
  }

  async getUserIdByEmail(email: string): Promise<string | null> {
    return this.emailToUserId.get(email) ?? null;
  }

  async getEmailByUserId(userId: string): Promise<string | null> {
    return this.userIdToEmail.get(userId) ?? null;
  }

  async addWorkspaceEvent(event: WorkspaceEvent): Promise<void> {
    this.events.push(event);
  }

  async getWorkspaceEvents(id: string): Promise<WorkspaceEvent[]> {
    return this.events.filter((event) => event.workspaceId === id);
  }
}

function makeService() {
  const repository = new FakeWorkspaceUserManagementRepository();
  repository.workspaces.set(workspaceId, {
    workspaceId,
    name: "Workspace 1",
    createdAt: "2026-06-29T00:00:00.000Z",
    ownerId: hostUserId
  });
  repository.members.set("member-host", {
    memberId: "member-host",
    workspaceId,
    userId: hostUserId,
    role: "host",
    isAccepted: true,
    joinedAt: "2026-06-29T00:00:00.000Z"
  });
  repository.members.set("member-admin", {
    memberId: "member-admin",
    workspaceId,
    userId: adminUserId,
    role: "admin",
    isAccepted: true,
    joinedAt: "2026-06-29T00:00:00.000Z"
  });
  repository.emailToUserId.set("invited@example.com", invitedUserId);
  repository.userIdToEmail.set(hostUserId, "host@example.com");
  repository.userIdToEmail.set(adminUserId, "admin@example.com");
  repository.userIdToEmail.set(invitedUserId, "invited@example.com");

  const emailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
  const service = new WorkspaceUserManagementService({
    repository,
    emailService,
    frontendUrl: "http://localhost:5173",
    generateId: vi.fn()
      .mockReturnValueOnce("invitation-1")
      .mockReturnValueOnce("event-1")
      .mockReturnValueOnce("member-invited")
      .mockReturnValue("event-next")
  });

  return { repository, service, emailService };
}

describe("WorkspaceUserManagementService", () => {
  it("does not own workspace creation", () => {
    const { service } = makeService();

    expect("createWorkspace" in service).toBe(false);
  });

  it("rejects invitations with unsupported roles", async () => {
    const { repository, service } = makeService();

    await expect(
      service.inviteMember(
        workspaceId,
        { email: "new@example.com", role: "owner" as WorkspaceRole },
        hostUserId,
        "host@example.com",
        "host"
      )
    ).rejects.toThrow("Invalid workspace role");
    expect(await repository.getInvitations(workspaceId)).toHaveLength(0);
  });

  it("models Host as a first-class role separate from Admin", async () => {
    const { repository, service } = makeService();

    const list = await service.listMembers(workspaceId);

    expect(list.members.map((member) => member.role)).toEqual(["host", "admin"]);
    expect((await repository.getWorkspaceMembers(workspaceId)).filter((member) => member.role === "host")).toHaveLength(1);
  });

  it("allows Admin to invite only Editor or Viewer", async () => {
    const { repository, service } = makeService();

    await service.inviteMember(
      workspaceId,
      { email: "editor@example.com", role: "editor" },
      adminUserId,
      "admin@example.com",
      "admin"
    );

    await expect(
      service.inviteMember(
        workspaceId,
        { email: "another-admin@example.com", role: "admin" },
        adminUserId,
        "admin@example.com",
        "admin"
      )
    ).rejects.toThrow("Admin can only invite Editor or Viewer");

    expect((await repository.getInvitations(workspaceId)).map((invite) => invite.role)).toEqual(["editor"]);
  });

  it("blocks Editor and Viewer from mutating workspace membership", async () => {
    const { repository, service } = makeService();
    repository.members.set("member-editor", {
      memberId: "member-editor",
      workspaceId,
      userId: "user-editor",
      role: "editor",
      isAccepted: true,
      joinedAt: "2026-06-29T00:00:00.000Z"
    });

    await expect(
      service.inviteMember(
        workspaceId,
        { email: "new@example.com", role: "viewer" },
        "user-editor",
        "editor@example.com",
        "editor"
      )
    ).rejects.toThrow("Editor can only view the member list");

    await expect(
      service.removeMember(workspaceId, "member-admin", "user-editor", "editor")
    ).rejects.toThrow("Editor can only view the member list");
  });

  it("allows Host to transfer ownership and downgrades the previous Host to Admin", async () => {
    const { repository, service, emailService } = makeService();

    await service.transferHost(workspaceId, "member-admin", hostUserId, "host");

    expect((await repository.getWorkspaceMemberByMemberId(workspaceId, "member-host"))?.role).toBe("admin");
    expect((await repository.getWorkspaceMemberByMemberId(workspaceId, "member-admin"))?.role).toBe("host");
    expect((await repository.getWorkspaceMembers(workspaceId)).filter((member) => member.role === "host")).toHaveLength(1);
    expect(emailService.sendMail).toHaveBeenCalledWith(
      "admin@example.com",
      expect.stringContaining("Host"),
      expect.stringContaining("transferred")
    );
  });

  it("prevents Admin from assigning or removing Admin and keeps Host-only ownership powers", async () => {
    const { service } = makeService();

    await expect(
      service.updateMemberRole(workspaceId, "member-host", "admin", adminUserId, "admin")
    ).rejects.toThrow("Use transfer host");

    await expect(
      service.updateMemberRole(workspaceId, "member-admin", "viewer", adminUserId, "admin")
    ).rejects.toThrow("Admin cannot manage another Admin");

    await expect(
      service.removeMember(workspaceId, "member-admin", adminUserId, "admin")
    ).rejects.toThrow("Admin can only remove Editor or Viewer");
  });

  it("lets managers update or cancel a pending invitation without recreating it", async () => {
    const { repository, service, emailService } = makeService();
    await repository.addInvitation({
      invitationId: "invitation-pending",
      workspaceId,
      email: "pending@example.com",
      role: "viewer",
      status: "pending",
      invitedByUserId: hostUserId,
      createdAt: "2026-06-29T00:00:00.000Z"
    });

    const updated = await service.updateInvitationRole(
      workspaceId,
      "invitation-pending",
      "editor",
      hostUserId,
      "host"
    );
    await service.cancelInvitation(workspaceId, "invitation-pending", hostUserId, "host");

    expect(updated.invitationId).toBe("invitation-pending");
    expect(updated.role).toBe("editor");
    expect(await repository.getInvitationByCode("invitation-pending")).toBe(null);
    expect(emailService.sendMail).toHaveBeenCalledWith(
      "pending@example.com",
      expect.stringContaining("role updated"),
      expect.stringContaining("Editor")
    );
    expect(emailService.sendMail).toHaveBeenCalledWith(
      "pending@example.com",
      expect.stringContaining("cancelled"),
      expect.stringContaining("cancelled")
    );
  });

  it("does not create an invitation when invitation email delivery fails", async () => {
    const { repository, service, emailService } = makeService();
    emailService.sendMail.mockRejectedValueOnce(new Error("SMTP rejected recipient"));

    await expect(
      service.inviteMember(
        workspaceId,
        { email: "sang10102005@gmail.com", role: "viewer" },
        hostUserId,
        "host@example.com",
        "host"
      )
    ).rejects.toThrow("SMTP rejected recipient");

    expect(await repository.getInvitations(workspaceId)).toEqual([]);
  });

  it("creates a token-only invitation link and expiration metadata", async () => {
    const { repository, service, emailService } = makeService();

    const invitation = await service.inviteMember(
      workspaceId,
      { email: "new@example.com", role: "viewer" },
      hostUserId,
      "host@example.com",
      "host"
    );

    expect(invitation.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await repository.getInvitationByCode(invitation.invitationId)).toMatchObject({
      invitationId: "invitation-1",
      workspaceId,
      email: "new@example.com",
      role: "viewer",
      status: "pending"
    });
    expect(emailService.sendMail).toHaveBeenCalledWith(
      "new@example.com",
      expect.stringContaining("Invitation"),
      expect.stringContaining("/workspace/invitation/accept?token=invitation-1")
    );
    expect(emailService.sendMail).toHaveBeenCalledWith(
      "new@example.com",
      expect.stringContaining("Invitation"),
      expect.not.stringContaining("workspaceId=")
    );
  });

  it("prevents Admin from managing pending Admin invitations", async () => {
    const { repository, service } = makeService();
    await repository.addInvitation({
      invitationId: "admin-invitation",
      workspaceId,
      email: "pending-admin@example.com",
      role: "admin",
      status: "pending",
      invitedByUserId: hostUserId,
      createdAt: "2026-06-29T00:00:00.000Z"
    });

    await expect(
      service.updateInvitationRole(workspaceId, "admin-invitation", "viewer", adminUserId, "admin")
    ).rejects.toThrow("Admin can only manage Editor or Viewer invitations");
    await expect(
      service.cancelInvitation(workspaceId, "admin-invitation", adminUserId, "admin")
    ).rejects.toThrow("Admin can only manage Editor or Viewer invitations");
  });

  it("only lets the invited email accept a pending invitation", async () => {
    const { repository, service } = makeService();
    await repository.addInvitation({
      invitationId: "invitation-1",
      workspaceId,
      email: "invited@example.com",
      role: "viewer",
      status: "pending",
      invitedByUserId: adminUserId,
      createdAt: "2026-06-29T00:00:00.000Z"
    });

    await expect(
      service.acceptInvitation("invitation-1", "other-user", "other@example.com")
    ).rejects.toThrow("This invitation was sent to a different email account");
    expect(await repository.getWorkspaceMember(workspaceId, "other-user")).toBe(null);
  });

  it("accepts a valid token, creates one membership, and returns workspace context", async () => {
    const { repository, service } = makeService();
    await repository.addInvitation({
      invitationId: "invitation-1",
      workspaceId,
      email: "invited@example.com",
      role: "viewer",
      status: "pending",
      invitedByUserId: adminUserId,
      createdAt: "2026-06-29T00:00:00.000Z",
      expiresAt: "2026-07-06T00:00:00.000Z"
    });

    const result = await service.acceptInvitation("invitation-1", invitedUserId, "invited@example.com");

    expect(result).toEqual({
      invitationId: "invitation-1",
      workspaceId,
      email: "invited@example.com",
      role: "viewer"
    });
    expect((await repository.getInvitationByCode("invitation-1"))?.status).toBe("accepted");
    expect(await repository.getWorkspaceMember(workspaceId, invitedUserId)).toMatchObject({
      workspaceId,
      userId: invitedUserId,
      role: "viewer",
      isAccepted: true
    });
  });

  it("rejects expired, cancelled, already accepted, and duplicate-member invitations", async () => {
    const { repository, service } = makeService();
    await repository.addInvitation({
      invitationId: "expired-invitation",
      workspaceId,
      email: "invited@example.com",
      role: "viewer",
      status: "pending",
      invitedByUserId: adminUserId,
      createdAt: "2026-06-01T00:00:00.000Z",
      expiresAt: "2026-06-02T00:00:00.000Z"
    });
    await repository.addInvitation({
      invitationId: "cancelled-invitation",
      workspaceId,
      email: "invited@example.com",
      role: "viewer",
      status: "revoked",
      invitedByUserId: adminUserId,
      createdAt: "2026-06-29T00:00:00.000Z"
    });
    await repository.addInvitation({
      invitationId: "accepted-invitation",
      workspaceId,
      email: "invited@example.com",
      role: "viewer",
      status: "accepted",
      invitedByUserId: adminUserId,
      createdAt: "2026-06-29T00:00:00.000Z"
    });
    await repository.addInvitation({
      invitationId: "duplicate-invitation",
      workspaceId,
      email: "admin@example.com",
      role: "viewer",
      status: "pending",
      invitedByUserId: hostUserId,
      createdAt: "2026-06-29T00:00:00.000Z",
      expiresAt: "2026-07-06T00:00:00.000Z"
    });

    await expect(
      service.acceptInvitation("expired-invitation", invitedUserId, "invited@example.com")
    ).rejects.toThrow("Invitation expired");
    await expect(
      service.acceptInvitation("cancelled-invitation", invitedUserId, "invited@example.com")
    ).rejects.toThrow("Invitation cancelled");
    await expect(
      service.acceptInvitation("accepted-invitation", invitedUserId, "invited@example.com")
    ).rejects.toThrow("Invitation already accepted");
    await expect(
      service.acceptInvitation("duplicate-invitation", adminUserId, "admin@example.com")
    ).rejects.toThrow("User is already a member of this workspace");
  });

  it("lets members request Admin and lets only Host approve or reject the request", async () => {
    const { repository, service } = makeService();
    repository.members.set("member-viewer", {
      memberId: "member-viewer",
      workspaceId,
      userId: "user-viewer",
      role: "viewer",
      isAccepted: true,
      joinedAt: "2026-06-29T00:00:00.000Z"
    });

    const request = await service.requestAdminRole(workspaceId, "user-viewer", "viewer");

    expect(request).toMatchObject({
      workspaceId,
      memberId: "member-viewer",
      requester: "user-viewer",
      status: "pending"
    });
    await expect(
      service.approveAdminRequest(workspaceId, request.requestId, adminUserId, "admin")
    ).rejects.toThrow("Only Host can approve Admin requests");

    const approved = await service.approveAdminRequest(workspaceId, request.requestId, hostUserId, "host");

    expect(approved.status).toBe("approved");
    expect((await repository.getWorkspaceMemberByMemberId(workspaceId, "member-viewer"))?.role).toBe("admin");
  });

  it("orders workspace activity newest first with actor and target context", async () => {
    const { repository, service } = makeService();
    await repository.addWorkspaceEvent({
      eventId: "event-old",
      workspaceId,
      type: "MEMBER_INVITED",
      actor: "host@example.com",
      target: "old@example.com",
      description: "Host invited old@example.com as Viewer.",
      timestamp: "2026-06-29T00:00:00.000Z"
    });
    await repository.addWorkspaceEvent({
      eventId: "event-new",
      workspaceId,
      type: "ROLE_CHANGED",
      actor: "host@example.com",
      target: "new@example.com",
      description: "Host changed new@example.com to Editor.",
      timestamp: "2026-06-29T01:00:00.000Z"
    });

    const events = await service.listWorkspaceEvents(workspaceId, hostUserId);

    expect(events.map((event) => event.eventId)).toEqual(["event-new", "event-old"]);
    expect(events[0]).toMatchObject({
      actor: "host@example.com",
      target: "new@example.com",
      description: "Host changed new@example.com to Editor."
    });
  });
});
