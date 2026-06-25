import { WorkspaceRole } from "./roles.ts";

export interface InviteMemberRequest {
  email: string;
  role: WorkspaceRole;
}

export interface InvitationResponse {
  invitationId: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: "pending" | "accepted" | "revoked";
  invitedByUserId: string;
  createdAt: string;
}

export interface AcceptInvitationRequest {
  token: string; // token is usually the invitationId
}

export interface WorkspaceMemberResponse {
  memberId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: "active" | "inactive";
  createdAt: string;
  // Included from User relation if needed
  email?: string;
  name?: string;
}

export interface UpdateMemberRoleRequest {
  role: WorkspaceRole;
}

export interface WorkspaceMemberListResponse {
  members: WorkspaceMemberResponse[];
  invitations: InvitationResponse[];
}
