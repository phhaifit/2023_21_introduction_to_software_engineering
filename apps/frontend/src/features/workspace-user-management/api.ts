import type { WorkspaceMemberListResponse, InviteMemberRequest, InvitationResponse, WorkspaceMemberResponse, UpdateMemberRoleRequest, AcceptInvitationResponse, AdminRequestResponse } from "@vcp/shared/contracts/index.ts";

export class WorkspaceUserManagementApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "WorkspaceUserManagementApiError";
  }
}

export class WorkspaceUserManagementAPI {
  constructor(private baseUrl: string) {}

  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = globalThis.localStorage?.getItem('vcp.auth.token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as any),
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
      throw new WorkspaceUserManagementApiError(
        err.error?.message || err.message || 'API request failed',
        err.error?.code || "system.unexpected_error",
        res.status,
        err.error?.details
      );
    }
    
    const data = await res.json();
    return data.data; // Auth API response wraps in { data, success }
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberListResponse> {
    return this.fetchAPI<WorkspaceMemberListResponse>(`/api/workspaces/${workspaceId}/members`);
  }

  async inviteMember(workspaceId: string, req: InviteMemberRequest): Promise<InvitationResponse> {
    return this.fetchAPI<InvitationResponse>(`/api/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async updateRole(workspaceId: string, memberId: string, req: UpdateMemberRoleRequest): Promise<WorkspaceMemberResponse> {
    return this.fetchAPI<WorkspaceMemberResponse>(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  }

  async updateMemberRole(workspaceId: string, memberId: string, req: UpdateMemberRoleRequest): Promise<WorkspaceMemberResponse> {
    return this.updateRole(workspaceId, memberId, req);
  }

  async transferHost(workspaceId: string, memberId: string): Promise<WorkspaceMemberResponse> {
    return this.fetchAPI<WorkspaceMemberResponse>(`/api/workspaces/${workspaceId}/members/${memberId}/transfer-host`, {
      method: 'POST',
    });
  }

  async getAdminRequests(workspaceId: string): Promise<any[]> {
    return this.fetchAPI<any[]>(`/api/workspaces/${workspaceId}/admin-requests`);
  }

  async requestAdminRole(workspaceId: string): Promise<AdminRequestResponse> {
    return this.fetchAPI<AdminRequestResponse>(`/api/workspaces/${workspaceId}/admin-requests`, {
      method: 'POST',
    });
  }

  async approveAdminRequest(workspaceId: string, requestId: string): Promise<AdminRequestResponse> {
    return this.fetchAPI<AdminRequestResponse>(`/api/workspaces/${workspaceId}/admin-requests/${requestId}/approve`, {
      method: 'POST',
    });
  }

  async rejectAdminRequest(workspaceId: string, requestId: string): Promise<AdminRequestResponse> {
    return this.fetchAPI<AdminRequestResponse>(`/api/workspaces/${workspaceId}/admin-requests/${requestId}/reject`, {
      method: 'POST',
    });
  }

  async listWorkspaceEvents(workspaceId: string): Promise<any[]> {
    return this.fetchAPI<any[]>(`/api/workspaces/${workspaceId}/events`);
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async updateInvitationRole(workspaceId: string, invitationId: string, req: UpdateMemberRoleRequest): Promise<InvitationResponse> {
    return this.fetchAPI<InvitationResponse>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  }

  async cancelInvitation(workspaceId: string, invitationId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }

  async resendInvitation(workspaceId: string, invitationId: string): Promise<InvitationResponse> {
    return this.fetchAPI<InvitationResponse>(`/api/workspaces/${workspaceId}/invitations/${invitationId}/resend`, {
      method: 'POST',
    });
  }

  async acceptInvitation(code: string): Promise<AcceptInvitationResponse> {
    return this.fetchAPI<AcceptInvitationResponse>(`/api/invitations/${encodeURIComponent(code)}/accept`, {
      method: 'POST',
    });
  }

  async rejectInvitation(code: string): Promise<void> {
    return this.fetchAPI<void>(`/api/invitations/${encodeURIComponent(code)}/reject`, {
      method: 'POST',
    });
  }

  async listPendingInvitationsForUser(): Promise<any[]> {
    return this.fetchAPI<any[]>('/api/invitations/pending');
  }
}
