import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("unified Workspace experience", () => {
  it("keeps Workspace Management and Workspace User Management under one workspace route family", () => {
    const app = source("apps/frontend/src/App.tsx");

    expect(app).toContain('path="/workspaces"');
    expect(app).toContain('path="/workspaces/new"');
    expect(app).toContain('path="/workspaces/:workspaceId"');
    expect(app).toContain('path="/workspaces/:workspaceId/members"');
    expect(app).not.toContain('path="/workspace-select"');
    expect(app).not.toContain('path="/workspace/:workspaceId"');
    expect(app).not.toContain('path="/workspace/:workspaceId/members"');
  });

  it("links from Workspace Management detail to the dedicated member-management page", () => {
    const detailPage = source("apps/frontend/src/features/workspace-management/WorkspaceDetailPage.tsx");
    const membersPage = source("apps/frontend/src/features/workspace-user-management/pages/WorkspaceMembersPage.tsx");

    expect(detailPage).not.toContain("WorkspaceMembersPanel");
    expect(detailPage).toContain("View Member List");
    expect(detailPage).toContain("members");
    expect(membersPage).toContain("Search by name or email");
    expect(membersPage).toContain("Transfer Host");
  });

  it("keeps Transfer Host behind an explicit confirmation dialog", () => {
    const membersPage = source("apps/frontend/src/features/workspace-user-management/pages/WorkspaceMembersPage.tsx");
    const confirmationModal = source("apps/frontend/src/features/workspace-user-management/components/ConfirmationModal.tsx");

    expect(membersPage).toContain("isTransferModalOpen");
    expect(membersPage).toContain("selectedUserToTransfer");
    expect(membersPage).toContain("openTransferHostModal(member)");
    expect(membersPage).toContain("Are you sure you want to transfer the host role to this user?");
    expect(membersPage).toContain("onConfirm={confirmTransferHost}");
    expect(confirmationModal).toContain('role="dialog"');
    expect(confirmationModal).toContain('aria-modal="true"');
  });

  it("keeps invite and structured search inside the Workspace User Management page", () => {
    const membersPage = source("apps/frontend/src/features/workspace-user-management/pages/WorkspaceMembersPage.tsx");

    expect(membersPage).not.toContain("Search By");
    expect(membersPage).not.toContain("wum-search-by");
    expect(membersPage).toContain("Invite Member");
    expect(membersPage).toContain("filter-chip");
    expect(membersPage).toContain("roleFilters");
    expect(membersPage).toContain("memberStatusFilters");
    expect(membersPage).toContain("role=\"dialog\"");
    expect(membersPage).not.toContain("<h2>Invitations</h2>");
    expect(membersPage).not.toContain("Pending invitations");
    expect(membersPage).toContain("Workspace Activity");
    expect(membersPage).toContain("wum-timeline");
    expect(membersPage).toContain("Request Admin Permission");
  });

  it("does not mount the obsolete workspace list router", () => {
    const server = source("apps/backend/src/local-agent-management-server.ts");
    const index = source("apps/backend/src/modules/workspace-user-management/index.ts");

    expect(server).not.toContain("createWorkspaceListRouter");
    expect(index).not.toContain("workspace-list-router");
  });

  it("keeps invitation acceptance token based and login-return aware", () => {
    const app = source("apps/frontend/src/App.tsx");
    const acceptPage = source("apps/frontend/src/features/workspace-user-management/pages/AcceptInvitePage.tsx");

    expect(app).toContain('path="/workspace/invitation/accept"');
    expect(acceptPage).toContain('searchParams.get("token")');
    expect(acceptPage).not.toContain('searchParams.get("workspaceId")');
    expect(acceptPage).toContain("/authentication?redirect=");
    expect(acceptPage).toContain("auth.unauthorized");
    expect(acceptPage).toContain("result.workspaceId");
  });

  it("keeps Workspace User Management API responses independent from the Authentication module", () => {
    const membersRouter = source("apps/backend/src/modules/workspace-user-management/api/workspace-user-management-router.ts");
    const invitationRouter = source("apps/backend/src/modules/workspace-user-management/api/accept-invitation-router.ts");
    const contextMiddleware = source("apps/backend/src/modules/workspace-user-management/api/workspace-context-middleware.ts");

    expect(membersRouter).not.toContain("../../authentication/api/api-response.ts");
    expect(invitationRouter).not.toContain("../../authentication/api/api-response.ts");
    expect(contextMiddleware).not.toContain("../../authentication/api/api-response.ts");
  });

  it("keeps local authentication seed accounts aligned with WUM email mappings", () => {
    const server = source("apps/backend/src/local-agent-management-server.ts");
    const inMemoryWum = source("apps/backend/src/modules/workspace-user-management/infrastructure/in-memory-workspace-user-management-repository.ts");

    expect(server).toContain("local-email-user");
    expect(server).toContain("process.env.GMAIL_USER");
    expect(inMemoryWum).toContain("local-email-user");
  });
});
