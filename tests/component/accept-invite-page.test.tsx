import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AcceptInvitePage } from "../../apps/frontend/src/features/workspace-user-management/pages/AcceptInvitePage.tsx";

function success(data: unknown) {
  return {
    ok: true,
    json: async () => ({ ok: true, data })
  } as Response;
}

describe("AcceptInvitePage", () => {
  it("does not stay stuck on the verifying state under React StrictMode", async () => {
    const fetchMock = vi.fn(async () =>
      success({
        invitationId: "token-1",
        workspaceId: "workspace-1",
        email: "member@example.com",
        role: "viewer"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={["/workspace/invitation/accept?token=token-1"]}>
          <Routes>
            <Route path="/workspace/invitation/accept" element={<AcceptInvitePage />} />
            <Route path="/workspaces/:workspaceId" element={<div>Workspace page</div>} />
          </Routes>
        </MemoryRouter>
      </React.StrictMode>
    );

    expect(await screen.findByText("Invitation Accepted!")).toBeInTheDocument();
    expect(screen.queryByText("Verifying invitation...")).not.toBeInTheDocument();
  });
});
