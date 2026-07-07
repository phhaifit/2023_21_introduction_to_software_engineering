import type { WorkspaceMemberListResponse, InviteMemberRequest, InvitationResponse, WorkspaceMemberResponse, UpdateMemberRoleRequest } from "@vcp/shared/contracts/index.ts";

export class WorkspaceUserManagementAPI {
  constructor(private baseUrl: string) {}

  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Basic fetch wrapper, assume token is injected by interceptor or similar in real app.
    // For now, we mock the local-dev headers.
    const token = localStorage.getItem('vcp.auth.token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'API request failed');
    }
    
    const data = await res.json();
    return data.data; // Auth API response wraps in { data, success }
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberListResponse> {
    return this.fetchAPI<WorkspaceMemberListResponse>(`/api/workspaces/${workspaceId}/members`);
  }

  async inviteMember(workspaceId: string, req: InviteMemberRequest): Promise<InvitationResponse> {
    return this.fetchAPI<InvitationResponse>(`/api/workspaces/${workspaceId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async updateRole(workspaceId: string, memberId: string, req: UpdateMemberRoleRequest): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async acceptInvitation(code: string): Promise<void> {
    return this.fetchAPI<void>(`/api/invitations/${code}/accept`, {
      method: 'POST',
    });
  }

  async listWorkspaces(): Promise<any[]> {
    return this.fetchAPI<any[]>('/api/workspaces');
  }

  async createWorkspace(name: string): Promise<any> {
    return this.fetchAPI<any>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async listPendingInvitationsForUser(): Promise<any[]> {
    return this.fetchAPI<any[]>('/api/workspaces/invitations/pending');
  }

  async listWorkspaceEvents(workspaceId: string): Promise<any[]> {
    return this.fetchAPI<any[]>(`/api/workspaces/${workspaceId}/events`);
  }
}
