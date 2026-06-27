import type { Workspace, WorkspaceMember, InvitationResponse } from "@vcp/shared/contracts/index.ts";
import type { WorkspaceRole } from "@vcp/shared/contracts/roles.ts";

export interface WorkspaceEvent {
  eventId: string;
  workspaceId: string;
  type: string;
  description: string;
  timestamp: string;
}

export interface WorkspaceUserManagementRepository {
  createWorkspace(workspace: Workspace): Promise<void>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  
  getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  getWorkspaceMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  addWorkspaceMember(member: WorkspaceMember): Promise<void>;
  updateWorkspaceMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<void>;
  
  getInvitations(workspaceId: string): Promise<InvitationResponse[]>;
  getInvitationsByEmail(email: string): Promise<InvitationResponse[]>;
  getInvitationByCode(code: string): Promise<InvitationResponse | null>;
  addInvitation(invitation: InvitationResponse): Promise<void>;
  updateInvitationStatus(invitationId: string, status: "pending" | "accepted" | "revoked"): Promise<void>;

  listWorkspacesByUserId(userId: string): Promise<Workspace[]>;
  listAllWorkspaces(): Promise<Workspace[]>;
  getUserIdByEmail(email: string): Promise<string | null>;

  addWorkspaceEvent(event: WorkspaceEvent): Promise<void>;
  getWorkspaceEvents(workspaceId: string): Promise<WorkspaceEvent[]>;
}
