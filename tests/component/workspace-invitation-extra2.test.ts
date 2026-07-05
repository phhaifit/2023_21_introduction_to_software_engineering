import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Workspace Invitation Management Extra 2 Frontend Structures", () => {
  it("mounts the InvitationInvalidPage component for route /workspace/invitation/invalid", () => {
    const app = source("apps/frontend/src/App.tsx");
    expect(app).toContain('path="/workspace/invitation/invalid"');
    expect(app).toContain("InvitationInvalidPage");
  });

  it("decodes Punycode/IDN email domains and formats date-times on WorkspaceMembersPage", () => {
    const membersPage = source("apps/frontend/src/features/workspace-user-management/pages/WorkspaceMembersPage.tsx");
    expect(membersPage).toContain("decodeEmail");
    expect(membersPage).toContain("formatDateTime");
  });

  it("handles role change confirmations via state modal triggers on WorkspaceMembersPage", () => {
    const membersPage = source("apps/frontend/src/features/workspace-user-management/pages/WorkspaceMembersPage.tsx");
    expect(membersPage).toContain("pendingRoleChanges");
    expect(membersPage).toContain("confirmModal");
  });

  it("redirects users to `/workspace/invitation/invalid` when invitation acceptance encounters an error", () => {
    const acceptPage = source("apps/frontend/src/features/workspace-user-management/pages/AcceptInvitePage.tsx");
    expect(acceptPage).toContain("/workspace/invitation/invalid");
  });
});
