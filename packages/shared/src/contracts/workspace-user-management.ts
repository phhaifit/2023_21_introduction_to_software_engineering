import type { WorkspaceRole } from "./roles.ts";
export type { WorkspaceRole };

export interface Workspace {
  workspaceId: string;
  name: string;
  createdAt: string;
  ownerId: string;
}

export interface WorkspaceMember {
  memberId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  isAccepted: boolean;
  joinedAt?: string;
  invitedAt?: string;
  inviteCode?: string;
}

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
  code: string;
}


export interface WorkspaceMemberResponse {
  memberId: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: "active" | "inactive";
  createdAt: string;
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
