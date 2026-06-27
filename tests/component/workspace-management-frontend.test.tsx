import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWorkspaceManagementApiClient,
  WorkspaceApiClientError,
  type WorkspaceManagementApiClient
} from "@vcp/frontend/features/workspace-management/api/workspace-api-client.ts";
import { WorkspaceCreateForm } from "@vcp/frontend/features/workspace-management/components/workspace-create-form.tsx";
import { WorkspaceDeleteDialog } from "@vcp/frontend/features/workspace-management/components/workspace-delete-dialog.tsx";
import { WorkspaceDetail } from "@vcp/frontend/features/workspace-management/components/workspace-detail.tsx";
import { WorkspaceListPage } from "@vcp/frontend/features/workspace-management/pages/workspace-list-page.tsx";
import { WorkspaceDetailPage } from "@vcp/frontend/features/workspace-management/pages/workspace-detail-page.tsx";
import type {
  CreateWorkspaceAcceptedResponse,
  DeleteWorkspaceAcceptedResponse,
  WorkspaceDetailDto,
  WorkspaceLifecycleStatusDto,
  WorkspaceSummaryDto
} from "@vcp/shared/contracts/workspace-management.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const meta = {
  requestId: "test",
  timestamp: "2026-06-26T00:00:00.000Z"
};

function workspace(
  input: Partial<WorkspaceSummaryDto> & { workspaceId: string; name: string; status: WorkspaceLifecycleStatusDto }
): WorkspaceSummaryDto {
  return {
    requestedProfile: "standard",
    createdAt: "2026-06-25T08:00:00.000Z",
    updatedAt: "2026-06-25T09:00:00.000Z",
    failure: null,
    ...input,
    workspaceId: input.workspaceId as WorkspaceSummaryDto["workspaceId"]
  };
}

function success(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data, meta }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function cursorSuccess(data: unknown[], cursor: { nextCursor: string | null; hasMore: boolean }): Response {
  return new Response(
    JSON.stringify({ ok: true, data, meta: { ...meta, cursor } }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function failure(code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message }, meta }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function acceptedCreate(summary: WorkspaceSummaryDto): CreateWorkspaceAcceptedResponse {
  return {
    workspace: summary,
    operation: { operationId: "op-1", status: "queued" }
  };
}

function acceptedDelete(workspaceId = "workspace-1"): DeleteWorkspaceAcceptedResponse {
  return {
    workspaceId: workspaceId as DeleteWorkspaceAcceptedResponse["workspaceId"],
    status: "deleting",
    operation: { operationId: "op-delete", status: "queued" },
    acceptedAt: "2026-06-26T10:00:00.000Z"
  };
}

function clientStub(overrides: Partial<WorkspaceManagementApiClient>): WorkspaceManagementApiClient {
  return {
    listWorkspaces: vi.fn(async () => ({ items: [], cursor: { nextCursor: null, hasMore: false } })),
    createWorkspace: vi.fn(async () => acceptedCreate(workspace({
      workspaceId: "workspace-created",
      name: "Created",
      status: "provisioning"
    }))),
    getWorkspace: vi.fn(async () => workspace({
      workspaceId: "workspace-1",
      name: "Core Workspace",
      status: "active"
    }) as WorkspaceDetailDto),
    deleteWorkspace: vi.fn(async () => acceptedDelete()),
    ...overrides
  };
}

function apiError(code: string, message = "Safe error"): WorkspaceApiClientError {
  return new WorkspaceApiClientError({
    code: code as WorkspaceApiClientError["code"],
    message,
    kind: "api",
    status: code === "workspace.not_found" ? 404 : 400
  });
}

describe("Workspace API client", () => {
  it("workspace_create_submits_idempotency_key", async () => {
    const fetchImplementation = vi.fn(async () =>
      success(acceptedCreate(workspace({
        workspaceId: "workspace-1",
        name: "Alpha",
        status: "provisioning"
      })))
    );
    const client = createWorkspaceManagementApiClient({ fetchImplementation });

    await client.createWorkspace(
      { name: "Alpha", requestedProfile: "premium" },
      { idempotencyKey: "key-create-1" }
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "key-create-1",
          "content-type": "application/json"
        }),
        body: JSON.stringify({ name: "Alpha", requestedProfile: "premium" })
      })
    );
  });

  it("workspace_create_never_sends_server_owned_fields", async () => {
    const fetchImplementation = vi.fn(async () =>
      success(acceptedCreate(workspace({
        workspaceId: "workspace-1",
        name: "Alpha",
        status: "provisioning"
      })))
    );
    const client = createWorkspaceManagementApiClient({ fetchImplementation });

    await client.createWorkspace(
      {
        name: "Alpha",
        requestedProfile: "standard",
        workspaceId: "client-forged",
        status: "active",
        runtimeRef: "runtime-secret",
        resolvedProvisioningProfile: { cpu: 99 }
      } as never,
      { idempotencyKey: "key-create-2" }
    );

    const body = JSON.parse(String(fetchImplementation.mock.calls[0][1]?.body));
    expect(body).toEqual({ name: "Alpha", requestedProfile: "standard" });
    expect(body).not.toHaveProperty("workspaceId");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("runtimeRef");
    expect(body).not.toHaveProperty("resolvedProvisioningProfile");
  });

  it("workspace_delete_sends_idempotency_key", async () => {
    const fetchImplementation = vi.fn(async () => success(acceptedDelete()));
    const client = createWorkspaceManagementApiClient({ fetchImplementation });

    await client.deleteWorkspace("workspace-1", { idempotencyKey: "key-delete-1" });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "Idempotency-Key": "key-delete-1" })
      })
    );
    expect(fetchImplementation.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("workspace_create_handles_conflict_safely", async () => {
    const fetchImplementation = vi.fn(async () =>
      failure("workspace.idempotency_conflict", "Idempotency conflict", 409)
    );
    const client = createWorkspaceManagementApiClient({ fetchImplementation });

    await expect(
      client.createWorkspace(
        { name: "Alpha", requestedProfile: "standard" },
        { idempotencyKey: "key-conflict" }
      )
    ).rejects.toMatchObject({
      code: "workspace.idempotency_conflict",
      kind: "api",
      status: 409
    });
  });
});

describe("Workspace list UI", () => {
  it("workspace_list_renders_loading_state", () => {
    const client = clientStub({
      listWorkspaces: vi.fn(() => new Promise(() => undefined))
    });

    render(<WorkspaceListPage apiClient={client} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading workspaces...");
  });

  it("workspace_list_renders_empty_state", async () => {
    const client = clientStub({
      listWorkspaces: vi.fn(async () => ({ items: [], cursor: { nextCursor: null, hasMore: false } }))
    });

    render(<WorkspaceListPage apiClient={client} />);

    expect(await screen.findByText("No workspaces yet")).toBeVisible();
  });

  it("workspace_list_renders_safe_error_state", async () => {
    const client = clientStub({
      listWorkspaces: vi.fn(async () => {
        throw apiError("system.unavailable");
      })
    });

    render(<WorkspaceListPage apiClient={client} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Workspace list is temporarily unavailable."
    );
  });

  it("workspace_list_renders_each_lifecycle_status", async () => {
    const statuses: WorkspaceLifecycleStatusDto[] = [
      "provisioning",
      "active",
      "failed",
      "deleting",
      "delete_failed",
      "deleted"
    ];
    const client = clientStub({
      listWorkspaces: vi.fn(async () => ({
        items: statuses.map((status) => workspace({
          workspaceId: `workspace-${status}`,
          name: `Workspace ${status}`,
          status
        })),
        cursor: { nextCursor: null, hasMore: false }
      }))
    });

    render(<WorkspaceListPage apiClient={client} />);

    expect(await screen.findByText("Workspace provisioning")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText("Deleting")).toBeVisible();
    expect(screen.getByText("Delete failed")).toBeVisible();
    expect(screen.getByText("Deleted")).toBeVisible();
  });

  it("workspace_list_loads_next_cursor_page_without_duplicates", async () => {
    const client = clientStub({
      listWorkspaces: vi
        .fn()
        .mockResolvedValueOnce({
          items: [
            workspace({ workspaceId: "workspace-a", name: "Alpha", status: "active" }),
            workspace({ workspaceId: "workspace-b", name: "Beta", status: "active" })
          ],
          cursor: { nextCursor: "cursor-2", hasMore: true }
        })
        .mockResolvedValueOnce({
          items: [
            workspace({ workspaceId: "workspace-b", name: "Beta", status: "active" }),
            workspace({ workspaceId: "workspace-c", name: "Gamma", status: "provisioning" })
          ],
          cursor: { nextCursor: null, hasMore: false }
        })
    });
    const user = userEvent.setup();

    render(<WorkspaceListPage apiClient={client} />);
    expect(await screen.findByText("Alpha")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Gamma")).toBeVisible();
    expect(screen.getAllByText("Beta")).toHaveLength(1);
    expect(client.listWorkspaces).toHaveBeenLastCalledWith({
      cursor: "cursor-2",
      limit: 20
    });
  });

  it("workspace_list_does_not_render_inaccessible_fixture", async () => {
    const client = clientStub({
      listWorkspaces: vi.fn(async () => ({
        items: [workspace({ workspaceId: "workspace-a", name: "Visible", status: "active" })],
        cursor: { nextCursor: null, hasMore: false }
      }))
    });

    render(<WorkspaceListPage apiClient={client} />);

    expect(await screen.findByText("Visible")).toBeVisible();
    expect(screen.queryByText("Other user's workspace")).not.toBeInTheDocument();
  });
});

describe("Workspace create form", () => {
  it("workspace_create_form_has_only_name_and_requested_profile", () => {
    render(<WorkspaceCreateForm onCreate={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toBeVisible();
    expect(screen.getByLabelText("Requested profile")).toBeVisible();
    expect(screen.queryByLabelText(/cpu/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ram/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/storage/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/provider/i)).not.toBeInTheDocument();
  });

  it("workspace_create_requires_valid_name", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<WorkspaceCreateForm onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a workspace name.");
  });

  it("workspace_create_disables_duplicate_submission", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => new Promise<CreateWorkspaceAcceptedResponse>(() => undefined));
    render(<WorkspaceCreateForm keyFactory={() => "key-one"} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "Alpha");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    await user.click(screen.getByRole("button", { name: "Creating..." }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });

  it("workspace_create_handles_202_accepted", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () =>
      acceptedCreate(workspace({ workspaceId: "workspace-1", name: "Alpha", status: "provisioning" }))
    );
    render(<WorkspaceCreateForm keyFactory={() => "key-accepted"} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "  Alpha   Team ");
    await user.selectOptions(screen.getByLabelText("Requested profile"), "premium");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Alpha Team",
      requestedProfile: "premium",
      idempotencyKey: "key-accepted"
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Workspace request accepted"
    );
  });

  it("workspace_create_handles_idempotency_replay_as_success", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () =>
      acceptedCreate(workspace({ workspaceId: "workspace-1", name: "Replay", status: "provisioning" }))
    );
    render(<WorkspaceCreateForm keyFactory={() => "same-key"} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "Replay");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText(/Replay/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("workspace_create_handles_conflict_safely", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => {
      throw apiError("workspace.idempotency_conflict");
    });
    render(<WorkspaceCreateForm keyFactory={() => "conflict-key"} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "Conflict");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This request conflicts with a previous submission."
    );
  });
});

describe("Workspace detail and delete UI", () => {
  it("workspace_detail_renders_safe_core_fields_only", () => {
    render(
      <WorkspaceDetail
        workspace={{
          ...workspace({ workspaceId: "workspace-1", name: "Safe Detail", status: "active" }),
          runtimeRef: "runtime-ref-secret",
          providerRequestKey: "provider-key-secret",
          leaseToken: "lease-secret"
        } as never}
      />
    );

    expect(screen.getByText("Safe Detail")).toBeVisible();
    expect(screen.getByText("standard")).toBeVisible();
    expect(screen.queryByText("runtime-ref-secret")).not.toBeInTheDocument();
    expect(screen.queryByText("provider-key-secret")).not.toBeInTheDocument();
    expect(screen.queryByText("lease-secret")).not.toBeInTheDocument();
  });

  it("workspace_detail_hides_runtime_and_operation_internals", () => {
    render(
      <WorkspaceDetail
        workspace={workspace({
          workspaceId: "workspace-1",
          name: "No internals",
          status: "delete_failed",
          failure: {
            code: "safe_failure",
            message: "Delete failed. Retry or reconciliation may be required."
          }
        }) as WorkspaceDetailDto}
      />
    );

    const failureSummary = screen.getByLabelText("Safe failure summary");
    expect(
      within(failureSummary).getByText(
        "Delete failed. Retry or reconciliation may be required."
      )
    ).toBeVisible();
    expect(screen.queryByText(/runtimeRef/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/operationId/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/providerRequestKey/i)).not.toBeInTheDocument();
  });

  it("workspace_detail_renders_not_found_safely", async () => {
    const client = clientStub({
      getWorkspace: vi.fn(async () => {
        throw apiError("workspace.not_found");
      })
    });

    render(<WorkspaceDetailPage apiClient={client} workspaceId="missing" />);

    expect(await screen.findByText("Workspace not found")).toBeVisible();
    expect(screen.getByText(/not found or is no longer available/i)).toBeVisible();
  });

  it("workspace_detail_handles_confirmed_forbidden_safely", async () => {
    const client = clientStub({
      getWorkspace: vi.fn(async () => {
        throw apiError("auth.forbidden");
      })
    });

    render(<WorkspaceDetailPage apiClient={client} workspaceId="workspace-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not have permission"
    );
  });

  it("workspace_detail_links_only_to_existing_public_module_routes", () => {
    render(
      <WorkspaceDetail
        workspace={workspace({ workspaceId: "workspace-1", name: "Linked", status: "active" }) as WorkspaceDetailDto}
      />
    );

    expect(screen.getByRole("link", { name: "Agents" })).toHaveAttribute("href", "/agents");
    expect(screen.getByRole("link", { name: "Workflows" })).toHaveAttribute("href", "/workflows");
    expect(screen.queryByRole("link", { name: /tools/i })).not.toBeInTheDocument();
  });

  it("workspace_delete_requires_confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => acceptedDelete());
    render(
      <WorkspaceDeleteDialog
        isOpen
        onClose={vi.fn()}
        onDelete={onDelete}
        workspaceName="Delete Me"
      />
    );

    expect(screen.getByRole("button", { name: "Request deletion" })).toBeDisabled();
    await user.click(screen.getByLabelText("I understand this starts workspace deletion."));
    await user.click(screen.getByRole("button", { name: "Request deletion" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("workspace_delete_renders_deleting_truthfully", () => {
    render(
      <WorkspaceDetail
        workspace={workspace({ workspaceId: "workspace-1", name: "Deleting", status: "deleting" }) as WorkspaceDetailDto}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Deletion has been requested"
    );
  });

  it("workspace_delete_handles_delete_failed_without_internal_details", () => {
    render(
      <WorkspaceDetail
        workspace={{
          ...workspace({
            workspaceId: "workspace-1",
            name: "Delete Failed",
            status: "delete_failed",
            failure: { code: "delete_failed", message: "Safe delete failure." }
          }),
          runtimeUrl: "https://runtime.internal/token",
          stack: "stack trace"
        } as never}
      />
    );

    expect(screen.getByText("Safe delete failure.")).toBeVisible();
    expect(screen.queryByText(/runtime.internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
  });

  it("workspace_delete_never_calls_runtime_provider", () => {
    const workspaceFrontendRoot = join(
      process.cwd(),
      "apps/frontend/src/features/workspace-management"
    );
    const files = [
      "api/workspace-api-client.ts",
      "components/workspace-delete-dialog.tsx",
      "components/workspace-detail.tsx",
      "pages/workspace-detail-page.tsx",
      "pages/workspace-list-page.tsx"
    ];
    const source = files
      .map((file) => readFileSync(join(workspaceFrontendRoot, file), "utf8"))
      .join("\n");
    const importSpecifiers = Array.from(
      source.matchAll(/\b(?:import|export)\b(?:[\s\S]*?\bfrom\s*)?["']([^"']+)["']/g)
    ).map((match) => match[1]);
    const forbiddenImportSpecifiers = importSpecifiers.filter((specifier) =>
      /@vcp\/backend|@vcp\/database|@vcp\/workers|@prisma\/client|openclaw|docker|runtime-provider/i.test(
        specifier
      )
    );
    const forbiddenRuntimeCalls = [
      /\bWorkspaceRuntimeProvisioningPort\b/,
      /\b(provisionWorkspace|deprovisionWorkspace|getWorkspaceRuntimeStatus)\s*\(/,
      /\b(fetch|EventSource)\s*\([^)]*(openclaw|docker|provider)/i
    ];

    expect(forbiddenImportSpecifiers).toEqual([]);
    for (const pattern of forbiddenRuntimeCalls) {
      expect(source).not.toMatch(pattern);
    }
  });
});
