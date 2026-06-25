const getHeaders = () => {
  const token = localStorage.getItem("vcp.auth.token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const fetchWorkspaces = async () => {
  const res = await fetch(`/api/workspaces`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to fetch workspaces");
  return res.json();
};

export const createWorkspace = async (name: string) => {
  const res = await fetch(`/api/workspaces`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create workspace");
  return res.json();
};

export const fetchMembers = async (workspaceId: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to fetch members");
  return res.json();
};

export const inviteMember = async (workspaceId: string, email: string, role: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || "Failed to invite member");
  }
  return res.json();
};

export const updateRole = async (workspaceId: string, memberId: string, role: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || "Failed to update role");
  }
  return res.json();
};

export const removeMember = async (workspaceId: string, memberId: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
    headers: getHeaders()
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || "Failed to remove member");
  }
  return true;
};

export const updateInvitationRole = async (workspaceId: string, invitationId: string, role: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || "Failed to update invitation role");
  }
  return res.json();
};

export const revokeInvitation = async (workspaceId: string, invitationId: string) => {
  const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
    method: "DELETE",
    headers: getHeaders()
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || "Failed to revoke invitation");
  }
  return true;
};

export const acceptInvitation = async (token: string) => {
  const res = await fetch(`/api/invitations/accept`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || "Failed to accept invitation");
  }
  return res.json();
};
