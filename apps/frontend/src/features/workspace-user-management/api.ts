import type { 
  WorkspaceMemberListResponse, 
  InviteMemberRequest, 
  InvitationResponse, 
  WorkspaceMemberResponse, 
  UpdateMemberRoleRequest 
} from "@vcp/shared/contracts/index.ts";

export class WorkspaceUserManagementApiError extends Error {
  code?: string;
  status?: number;
  details?: any;

  constructor(message: string, code?: string, status?: number, details?: any) {
    super(message);
    this.name = 'WorkspaceUserManagementApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class WorkspaceUserManagementAPI {
  constructor(private baseUrl: string) {}

  private async fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
      const err = await res.json().catch(() => ({}));
      const errorPayload = err.error || err;
      throw new WorkspaceUserManagementApiError(
        errorPayload.message || 'API request failed',
        errorPayload.code,
        res.status,
        errorPayload.details
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

  async updateRole(workspaceId: string, memberId: string, req: UpdateMemberRoleRequest): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async updateInvitationRole(workspaceId: string, invitationId: string, req: { role: string }): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
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

  async transferHost(workspaceId: string, memberId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/members/${memberId}/transfer-host`, {
      method: 'POST',
    });
  }

  async acceptInvitation(code: string): Promise<any> {
    return this.fetchAPI<any>(`/api/invitations/${code}/accept`, {
      method: 'POST',
    });
  }

  async listPendingInvitationsForUser(): Promise<any[]> {
    return this.fetchAPI<any[]>('/api/invitations/pending');
  }

  async listWorkspaceEvents(workspaceId: string): Promise<any[]> {
    return this.fetchAPI<any[]>(`/api/workspaces/${workspaceId}/events`);
  }

  async requestAdminRole(workspaceId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/admin-requests`, {
      method: 'POST',
    });
  }

  async approveAdminRequest(workspaceId: string, requestId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/admin-requests/${requestId}/approve`, {
      method: 'POST',
    });
  }

  async rejectAdminRequest(workspaceId: string, requestId: string): Promise<void> {
    return this.fetchAPI<void>(`/api/workspaces/${workspaceId}/admin-requests/${requestId}/reject`, {
      method: 'POST',
    });
  }
}
