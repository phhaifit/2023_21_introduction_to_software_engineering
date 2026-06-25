import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import type { WorkspaceUserManagementRepository } from "./workspace-user-management.repository.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/workspace-user-management.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Nạp biến môi trường từ file .env nằm chung thư mục với file này
dotenv.config({ path: path.join(__dirname, '.env') });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || ''
  }
});

export class WorkspaceUserManagementService {
  private readonly repo: WorkspaceUserManagementRepository;
  private readonly generateId: () => string;

  constructor(dependencies: {
    repository: WorkspaceUserManagementRepository;
    generateId?: () => string;
  }) {
    this.repo = dependencies.repository;
    this.generateId = dependencies.generateId || (() => randomUUID());
  }

  async inviteMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedByUserId: string
  ) {
    // Basic validation
    if (!email || !email.includes("@")) {
      throw new Error("Invalid email");
    }

    // Check if pending invite already exists
    const existingInvite = await this.repo.findPendingInvitationByEmail(workspaceId, email);
    let invite;

    if (existingInvite) {
      if (existingInvite.role === role) {
        throw new Error("Người dùng này đã được mời với quyền này rồi.");
      }
      // Update the existing invitation role and reset it
      await this.repo.revokeInvitation(existingInvite.invitationId);
    }

    const user = await this.repo.findUserByEmail(email);
    if (user) {
      const existingMember = await this.repo.findMember(workspaceId, user.userId);
      if (existingMember && existingMember.status === "active") {
        if (existingMember.role === role) {
          throw new Error("Người dùng này đã là thành viên với quyền này rồi.");
        } else {
          throw new Error("Người dùng này đã là thành viên. Hãy đổi quyền ở danh sách thành viên.");
        }
      }
    }

    const invitationId = randomUUID();
    const now = new Date().toISOString();

    invite = await this.repo.createInvitation({
      invitationId,
      workspaceId,
      email,
      role,
      invitedByUserId,
      createdAt: now,
      updatedAt: now,
    });

    try {
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        await transporter.sendMail({
          from: `"VCP Platform" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: 'Bạn được mời tham gia Workspace trên VCP Platform',
          html: `<p>Xin chào,</p><p>Bạn vừa nhận được một lời mời tham gia vào không gian làm việc (Workspace) trên hệ thống <strong>Virtual Company Platform</strong>.</p><p>Người dùng <strong>${invitedByUserId}</strong> đã mời bạn làm thành viên với vai trò là: <strong>${role.toUpperCase()}</strong>.</p><p>Để chấp nhận lời mời, vui lòng nhấn vào đường link bên dưới:</p><p><a href="http://localhost:5173/invite/accept?token=${invitationId}">http://localhost:5173/invite/accept?token=${invitationId}</a></p><p>Trân trọng,<br>Đội ngũ VCP Platform.</p>`
        });
        console.log(`[EMAIL SENT] Invitation sent to ${email}`);
      } else {
        console.log(`[MOCK EMAIL] Invitation sent to ${email} for workspace ${workspaceId} with role ${role}. Accept Token: ${invitationId}`);
      }
    } catch (e) {
      console.error("[EMAIL ERROR] Failed to send email", e);
      throw e;
    }

    return invite;
  }

  async acceptInvitation(token: string, currentUserId: string) {
    const invitation = await this.repo.findInvitation(token);

    if (!invitation || invitation.status !== "pending") {
      throw new Error("Invalid or expired invitation.");
    }

    // Mock local env behavior: Pretend the user accepting it is the invited user
    let targetUserId = currentUserId;
    let user = await this.repo.findUserByEmail(invitation.email);
    if (!user) {
      targetUserId = randomUUID();
      // Only available in memory repo for mock local dev
      if ((this.repo as any).createUser) {
        await (this.repo as any).createUser({ userId: targetUserId, email: invitation.email, name: invitation.email.split("@")[0] });
      }
    } else {
      targetUserId = user.userId;
    }

    // Check if user is already a member
    const existingMember = await this.repo.findMember(invitation.workspaceId, targetUserId);
    if (existingMember) {
      // Just mark invitation accepted, they are already a member
      await this.repo.acceptInvitation(token);
      return existingMember;
    }

    // Create member
    const memberId = randomUUID();
    const now = new Date().toISOString();

    const member = await this.repo.addMember({
      memberId,
      workspaceId: invitation.workspaceId,
      userId: targetUserId,
      role: invitation.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Mark accepted
    await this.repo.acceptInvitation(token);

    return member;
  }

  async updateInvitationRole(invitationId: string, newRole: WorkspaceRole) {
    if (!["admin", "editor", "viewer"].includes(newRole)) {
      throw new Error("Invalid role provided");
    }

    let invite = null;
    // Only available in memory repo for now
    if ((this.repo as any).updateInvitationRole) {
      invite = await (this.repo as any).updateInvitationRole(invitationId, newRole);
    } else {
      throw new Error("Not implemented in production repo");
    }

    if (invite) {
      try {
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          await transporter.sendMail({
            from: `"VCP Platform" <${process.env.GMAIL_USER}>`,
            to: invite.email,
            subject: 'Quyền hạn lời mời của bạn đã được cập nhật',
            html: `<p>Xin chào,</p><p>Lời mời tham gia <strong>Virtual Company Platform</strong> của bạn vừa được cập nhật quyền hạn thành: <strong>${newRole.toUpperCase()}</strong>.</p><p>Để chấp nhận lời mời, vui lòng nhấn vào đường link bên dưới:</p><p><a href="http://localhost:5173/invite/accept?token=${invite.invitationId}">http://localhost:5173/invite/accept?token=${invite.invitationId}</a></p><p>Trân trọng,<br>Đội ngũ VCP Platform.</p>`
          });
          console.log(`[EMAIL SENT] Update invitation role sent to ${invite.email}`);
        } else {
          console.log(`[MOCK EMAIL] Invitation role updated to ${newRole} for email ${invite.email}.`);
        }
      } catch (e) {
        console.error("[EMAIL ERROR] Failed to send email", e);
      }
    }

    return invite;
  }

  async listMembers(workspaceId: string) {
    const members = await this.repo.listMembers(workspaceId);
    const invitations = await this.repo.listInvitations(workspaceId);

    return {
      members,
      invitations,
    };
  }

  async updateMemberRole(workspaceId: string, memberId: string, newRole: WorkspaceRole) {
    // Validate role
    if (!["admin", "editor", "viewer"].includes(newRole)) {
      throw new Error("Invalid role.");
    }

    // Check if member exists
    const member = await this.repo.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw new Error("Member not found in this workspace.");
    }

    // Prevent removing the last admin
    if (member.role === "admin" && newRole !== "admin") {
      const adminCount = await this.repo.countAdmins(workspaceId);
      if (adminCount <= 1) {
        throw new Error("Cannot change role of the last admin.");
      }
    }

    const updated = await this.repo.updateMemberRole(memberId, newRole);

    try {
      const user = await this.repo.findUserByEmail(member.email || "mapmobile123456@gmail.com");
      const userEmail = user?.email || "mapmobile123456@gmail.com";

      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        await transporter.sendMail({
          from: `"VCP Platform" <${process.env.GMAIL_USER}>`,
          to: userEmail,
          subject: 'Quyền hạn của bạn đã được thay đổi',
          html: `<p>Xin chào,</p><p>Quyền truy cập của bạn trong <strong>Virtual Company Platform</strong> vừa được thay đổi thành: <strong>${newRole.toUpperCase()}</strong>.</p><p>Vui lòng đăng nhập để xem các thay đổi.</p><p>Trân trọng,<br>Đội ngũ VCP Platform.</p>`
        });
      } else {
        console.log(`[MOCK EMAIL] Role updated to ${newRole} for member ${memberId}.`);
      }
    } catch (e) {
      console.error("[EMAIL ERROR] Failed to send role update email", e);
      throw e;
    }

    return updated;
  }

  async removeMember(workspaceId: string, memberId: string) {
    const member = await this.repo.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw new Error("Member not found");
    }

    if (member.role === "admin") {
      // Check minimum 1 admin
      const adminCount = await this.repo.countAdmins(workspaceId);
      if (adminCount <= 1) {
        throw new Error("Cannot remove the last admin of the workspace.");
      }
    }

    await this.repo.removeMember(memberId);
    return true;
  }

  async revokeInvitation(workspaceId: string, invitationId: string) {
    const invite = await this.repo.findInvitation(invitationId);
    if (!invite || invite.workspaceId !== workspaceId) {
      throw new Error("Invitation not found");
    }

    await this.repo.revokeInvitation(invitationId);
    return true;
  }

  async createWorkspace(name: string, userId: string) {
    const workspaceId = this.generateId();
    const now = new Date().toISOString();
    
    // Create the workspace
    const workspace = await (this.repo as any).createWorkspace({
      workspaceId,
      name,
      ownerId: userId,
      createdAt: now
    });

    // Create the member as admin
    await this.repo.addMember({
      memberId: this.generateId(),
      workspaceId,
      userId,
      role: "admin",
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    return workspace;
  }

  async listWorkspacesByUserId(userId: string) {
    return (this.repo as any).listWorkspacesByUserId(userId);
  }
}
