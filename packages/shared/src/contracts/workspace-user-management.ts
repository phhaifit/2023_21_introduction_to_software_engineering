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
  status: "pending" | "accepted" | "cancelled" | "expired" | "replaced" | "rejected" | "revoked";
  invitedByUserId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface WorkspaceActivityResponse {
  eventId: string;
  workspaceId: string;
  type: string;
  actor?: string;
  target?: string;
  description: string;
  timestamp: string;
}

export interface AdminRequestResponse {
  requestId: string;
  workspaceId: string;
  memberId: string;
  requester: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AcceptInvitationRequest {
  code: string;
}

export interface AcceptInvitationResponse {
  invitationId: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
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
  adminRequests: AdminRequestResponse[];
  currentUserRole?: WorkspaceRole;
  permissions: {
    canInvite: boolean;
    canManagePendingInvitations: boolean;
    canChangeMemberRoles: boolean;
    canRemoveMembers: boolean;
    canTransferHost: boolean;
  };
}
