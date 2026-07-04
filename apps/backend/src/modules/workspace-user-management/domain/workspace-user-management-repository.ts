import type { AdminRequestResponse, Workspace, WorkspaceMember, InvitationResponse } from "@vcp/shared/contracts/index.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";

export interface WorkspaceEvent {
  eventId: string;
  workspaceId: string;
  type: string;
  actor?: string;
  target?: string;
  description: string;
  timestamp: string;
}

export interface WorkspaceUserManagementRepository {
  createWorkspace(workspace: Workspace): Promise<void>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  
  getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  getWorkspaceMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  getWorkspaceMemberByMemberId(workspaceId: string, memberId: string): Promise<WorkspaceMember | null>;
  addWorkspaceMember(member: WorkspaceMember): Promise<void>;
  updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: WorkspaceRole): Promise<void>;
  removeWorkspaceMember(workspaceId: string, memberId: string): Promise<void>;
  
  getInvitations(workspaceId: string): Promise<InvitationResponse[]>;
  getInvitationsByEmail(email: string): Promise<InvitationResponse[]>;
  getInvitationByCode(code: string): Promise<InvitationResponse | null>;
  addInvitation(invitation: InvitationResponse): Promise<void>;
  updateInvitationStatus(invitationId: string, status: "pending" | "accepted" | "cancelled" | "expired" | "replaced" | "rejected" | "revoked"): Promise<void>;
  updateInvitationRole(invitationId: string, role: WorkspaceRole): Promise<void>;
  deleteInvitation(invitationId: string): Promise<void>;

  getAdminRequests(workspaceId: string): Promise<AdminRequestResponse[]>;
  addAdminRequest(request: AdminRequestResponse): Promise<void>;
  updateAdminRequestStatus(
    requestId: string,
    status: "approved" | "rejected",
    resolvedBy: string,
    resolvedAt: string
  ): Promise<void>;

  getUserIdByEmail(email: string): Promise<string | null>;
  getEmailByUserId(userId: string): Promise<string | null>;

  addWorkspaceEvent(event: WorkspaceEvent): Promise<void>;
  getWorkspaceEvents(workspaceId: string): Promise<WorkspaceEvent[]>;

  transaction<T>(operation: (tx: WorkspaceUserManagementRepository) => Promise<T>): Promise<T>;
}
