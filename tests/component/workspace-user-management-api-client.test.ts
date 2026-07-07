import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceUserManagementAPI } from "@vcp/frontend/features/workspace-user-management/api.ts";

function success(data: unknown): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      data,
      meta: { requestId: "test", timestamp: "2026-06-29T00:00:00.000Z" }
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function failure(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message },
      meta: { requestId: "test", timestamp: "2026-06-29T00:00:00.000Z" }
    }),
    { status, headers: { "content-type": "application/json" } }
  );
}

describe("Workspace User Management API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the workspace-scoped invitation route from the API matrix", async () => {
    const fetchMock = vi.fn(async () => success({ invitationId: "inv-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WorkspaceUserManagementAPI("");

    await client.inviteMember("workspace-1", { email: "member@example.com", role: "viewer" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspaces/workspace-1/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "member@example.com", role: "viewer" })
      })
    );
  });

  it("updates and removes members through memberId routes", async () => {
    const fetchMock = vi.fn(async () => success({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WorkspaceUserManagementAPI("");

    await client.updateRole("workspace-1", "member-1", { role: "editor" });
    await client.removeMember("workspace-1", "member-1");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/workspaces/workspace-1/members/member-1", "PATCH"],
      ["/api/workspaces/workspace-1/members/member-1", "DELETE"]
    ]);
  });

  it("updates and cancels pending invitations through invitation routes", async () => {
    const fetchMock = vi.fn(async () => success({ invitationId: "invitation-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WorkspaceUserManagementAPI("");

    await client.updateInvitationRole("workspace-1", "invitation-1", { role: "editor" });
    await client.cancelInvitation("workspace-1", "invitation-1");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
      [
        "/api/workspaces/workspace-1/invitations/invitation-1",
        "PATCH",
        JSON.stringify({ role: "editor" })
      ],
      [
        "/api/workspaces/workspace-1/invitations/invitation-1",
        "DELETE",
        undefined
      ]
    ]);
  });

  it("uses a non-workspace route for current-user pending invitations", async () => {
    const fetchMock = vi.fn(async () => success([]));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WorkspaceUserManagementAPI("");

    await client.listPendingInvitationsForUser();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/invitations/pending");
  });

  it("loads workspace activity and submits Admin requests through workspace routes", async () => {
    const fetchMock = vi.fn(async () => success([]));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WorkspaceUserManagementAPI("");

    await client.listWorkspaceEvents("workspace-1");
    await client.requestAdminRole("workspace-1");
    await client.approveAdminRequest("workspace-1", "request-1");
    await client.rejectAdminRequest("workspace-1", "request-2");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"])).toEqual([
      ["/api/workspaces/workspace-1/events", "GET"],
      ["/api/workspaces/workspace-1/admin-requests", "POST"],
      ["/api/workspaces/workspace-1/admin-requests/request-1/approve", "POST"],
      ["/api/workspaces/workspace-1/admin-requests/request-2/reject", "POST"]
    ]);
  });

  it("accepts invitations by token and returns workspace redirect context", async () => {
    const fetchMock = vi.fn(async () => success({
      invitationId: "token-1",
      workspaceId: "workspace-1",
      email: "member@example.com",
      role: "viewer"
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new WorkspaceUserManagementAPI("");

    const result = await client.acceptInvitation("token-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/invitations/token-1/accept",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.workspaceId).toBe("workspace-1");
  });

  it("preserves API error code for invitation authentication redirects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failure(401, "auth.unauthorized", "Authentication required.")));
    const client = new WorkspaceUserManagementAPI("");

    await expect(client.acceptInvitation("token-1")).rejects.toMatchObject({
      code: "auth.unauthorized",
      status: 401,
      message: "Authentication required."
    });
  });

  it("does not expose workspace creation from the user-management API", () => {
    const client = new WorkspaceUserManagementAPI("");

    expect("createWorkspace" in client).toBe(false);
  });
});
