import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { readFileSync } from "node:fs";

import { encodeWorkspaceCursor } from "./workspace-cursor.ts";
import { createWorkspaceManagementRouter } from "./workspace-routes.ts";
import {
  WORKSPACE_API_TEST_NOW,
  createWorkspaceApiTestComposition,
  operationRecord,
  visibilityRecord,
  workspaceRecord
} from "../../testing/workspace-api-test-composition.ts";

describe("Workspace Management API list", () => {
  it("list_requires_authentication", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "list");

    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe("auth.unauthorized");
  });

  it("list_returns_only_user_scoped_visible_workspaces", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    seedVisibleWorkspace(h, "workspace-b", "Workspace B", "user-2");

    const response = await invoke(h, "list", { auth: "USER1" });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.map((item: any) => item.workspaceId)).toEqual(["workspace-a"]);
  });

  it("list_never_leaks_inaccessible_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({ workspaceId: "workspace-secret", name: "Secret" }));
    h.visibility.seed(visibilityRecord({
      userId: "user-1",
      workspaceId: "workspace-secret"
    }));

    const response = await invoke(h, "list", { auth: "USER1" });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain("Secret");
  });

  it("list_uses_opaque_cursor_and_rejects_malformed_cursor", async () => {
    const h = createWorkspaceApiTestComposition();

    const response = await invoke(h, "list", {
      auth: "USER1",
      query: { cursor: "not-a-valid-cursor" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("validation.invalid_input");
  });

  it("list_returns_no_duplicate_workspace_across_cursor_pages", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1", "2026-06-26T00:03:00.000Z");
    seedVisibleWorkspace(h, "workspace-b", "Workspace B", "user-1", "2026-06-26T00:02:00.000Z");
    seedVisibleWorkspace(h, "workspace-c", "Workspace C", "user-1", "2026-06-26T00:01:00.000Z");

    const first = await invoke(h, "list", { auth: "USER1", query: { limit: "1" } });
    const second = await invoke(h, "list", {
      auth: "USER1",
      query: { limit: "1", cursor: first.body.meta.cursor.nextCursor }
    });

    expect(first.body.data).toHaveLength(1);
    expect(second.body.data).toHaveLength(1);
    expect(first.body.data[0].workspaceId).not.toBe(second.body.data[0].workspaceId);
  });

  it("list_includes_valid_pending_bootstrap_workspace_only_for_creator", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({
      workspaceId: "workspace-bootstrap",
      name: "Bootstrap",
      createdByUserId: "user-1",
      ownerBootstrapState: "pending",
      ownerBootstrapAttemptId: "bootstrap-1",
      ownerBootstrapAttemptVersion: 1,
      ownerBootstrapExpiresAt: "2026-06-26T00:30:00.000Z"
    }));

    const creator = await invoke(h, "list", { auth: "USER1" });
    const other = await invoke(h, "list", { auth: "USER2" });

    expect(creator.body.data.map((item: any) => item.workspaceId)).toContain("workspace-bootstrap");
    expect(other.body.data).toEqual([]);
  });

  it("list_excludes_expired_or_failed_bootstrap_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({
      workspaceId: "workspace-expired",
      createdByUserId: "user-1",
      ownerBootstrapState: "pending",
      ownerBootstrapExpiresAt: "2026-06-25T00:00:00.000Z"
    }));
    h.workspaces.seed(workspaceRecord({
      workspaceId: "workspace-failed",
      createdByUserId: "user-1",
      ownerBootstrapState: "failed",
      ownerBootstrapExpiresAt: "2026-06-26T00:30:00.000Z"
    }));

    const response = await invoke(h, "list", { auth: "USER1" });

    expect(response.body.data).toEqual([]);
  });

  it("list_excludes_deleted_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-deleted", "Deleted", "user-1");
    replaceWorkspace(h, "workspace-deleted", { status: "deleted" });

    const response = await invoke(h, "list", { auth: "USER1" });

    expect(response.body.data).toEqual([]);
  });
});

describe("Workspace Management API create", () => {
  it("create_requires_authentication", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "create", {
      body: createBody(),
      idempotencyKey: "create-key-1"
    });

    expect(response.statusCode).toBe(401);
  });

  it("create_requires_idempotency_key", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "create", { auth: "USER1", body: createBody() });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("validation.invalid_input");
  });

  it("create_rejects_invalid_idempotency_key", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "bad key",
      body: createBody()
    });

    expect(response.statusCode).toBe(400);
  });

  it("create_rejects_unknown_or_server_owned_body_fields", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: {
        ...createBody(),
        cpu: 99,
        runtimeRef: "runtime",
        idempotencyKey: "body-key"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.issues.map((issue: any) => issue.path)).toEqual(
      expect.arrayContaining(["cpu", "runtimeRef", "idempotencyKey"])
    );
  });

  it("create_returns_202_for_valid_request", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });

    expect(response.statusCode).toBe(202);
    expect(response.body.data.workspace).toMatchObject({
      workspaceId: "workspace-1",
      name: "Workspace One",
      status: "provisioning",
      requestedProfile: "standard"
    });
    expect(response.body.data.operation).toMatchObject({
      operationId: "operation-2",
      status: "queued"
    });
  });

  it("create_replays_same_key_same_payload_without_duplicate_acceptance", async () => {
    const h = createWorkspaceApiTestComposition();
    const first = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });
    const second = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });

    expect(second.statusCode).toBe(202);
    expect(second.body.data).toEqual(first.body.data);
    expect(h.workspaces.records).toHaveLength(1);
    expect(h.operations.records).toHaveLength(1);
  });

  it("create_returns_409_for_same_key_different_payload", async () => {
    const h = createWorkspaceApiTestComposition();
    await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });

    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody({ name: "Different Workspace" })
    });

    expect(response.statusCode).toBe(409);
    expect(response.body.error.code).toBe("workspace.idempotency_conflict");
  });

  it("create_different_actor_same_key_does_not_collide", async () => {
    const h = createWorkspaceApiTestComposition();
    const first = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "shared-key-1",
      body: createBody()
    });
    const second = await invoke(h, "create", {
      auth: "USER2",
      idempotencyKey: "shared-key-1",
      body: createBody({ name: "Workspace Two" })
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(h.workspaces.records).toHaveLength(2);
    expect(h.receipts.records.map((record) => record.actorUserId)).toEqual([
      "user-1",
      "user-2"
    ]);
  });

  it("create_maps_entitlement_denial_safely", async () => {
    const h = createWorkspaceApiTestComposition();
    h.entitlement.nextDecision = {
      kind: "denied",
      code: "workspace.entitlement_denied",
      message: "Requested profile is not available."
    };

    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody({ requestedProfile: "premium" })
    });

    expect(response.statusCode).toBe(403);
    expect(response.body.error.code).toBe("workspace.entitlement_denied");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("create_maps_entitlement_unavailable_to_503", async () => {
    const h = createWorkspaceApiTestComposition();
    h.entitlement.nextDecision = {
      kind: "unavailable",
      code: "system.unavailable",
      message: "Subscription unavailable."
    };

    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });

    expect(response.statusCode).toBe(503);
    expect(response.body.error.code).toBe("system.unavailable");
  });

  it("create_does_not_call_runtime_provider", async () => {
    const h = createWorkspaceApiTestComposition();
    await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });

    expect(h.runtime.calls).toHaveLength(0);
  });

  it("create_response_does_not_expose_internal_fields", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "create", {
      auth: "USER1",
      idempotencyKey: "create-key-1",
      body: createBody()
    });

    expectNoInternalWorkspaceFields(response.body);
  });
});

describe("Workspace Management API detail", () => {
  it("detail_requires_authentication", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "detail", { params: { workspaceId: "workspace-1" } });

    expect(response.statusCode).toBe(401);
  });

  it("detail_returns_safe_core_workspace_data", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    replaceWorkspace(h, "workspace-a", {
      runtimeRef: "runtime-secret",
      runtimeUrl: "https://runtime.example.test",
      provider: "provider"
    });

    const response = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({
      workspaceId: "workspace-a",
      name: "Workspace A",
      status: "active"
    });
    expectNoInternalWorkspaceFields(response.body);
  });

  it("detail_conceals_inaccessible_workspace_with_404", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({ workspaceId: "workspace-secret" }));

    const response = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-secret" }
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe("workspace.not_found");
  });

  it("detail_returns_403_only_for_confirmed-known-forbidden_case", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({ workspaceId: "workspace-known" }));
    h.access.knownForbidden.add("workspace-known");

    const response = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-known" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.body.error.code).toBe("auth.forbidden");
  });

  it("detail_allows_only_valid_pending_bootstrap_creator", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({
      workspaceId: "workspace-bootstrap",
      createdByUserId: "user-1",
      ownerBootstrapState: "pending",
      ownerBootstrapAttemptId: "bootstrap-1",
      ownerBootstrapAttemptVersion: 1,
      ownerBootstrapExpiresAt: "2026-06-26T00:30:00.000Z"
    }));

    const creator = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-bootstrap" }
    });
    const other = await invoke(h, "detail", {
      auth: "USER2",
      params: { workspaceId: "workspace-bootstrap" }
    });

    expect(creator.statusCode).toBe(200);
    expect(other.statusCode).toBe(404);
  });

  it("detail_hides_deleted_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-deleted", "Deleted", "user-1");
    replaceWorkspace(h, "workspace-deleted", { status: "deleted" });

    const response = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-deleted" }
    });

    expect(response.statusCode).toBe(404);
  });

  it("detail_does_not_expose_operations_or_runtime_internals", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");

    const response = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" }
    });

    expectNoInternalWorkspaceFields(response.body);
    expect(JSON.stringify(response.body)).not.toContain("operationId");
  });
});

describe("Workspace Management API delete", () => {
  it("delete_requires_authentication", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "delete", {
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(401);
  });

  it("delete_requires_idempotency_key", async () => {
    const h = createWorkspaceApiTestComposition();
    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" }
    });

    expect(response.statusCode).toBe(400);
  });

  it("delete_returns_202_for_authorized_active_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(202);
    expect(response.body.data).toMatchObject({
      workspaceId: "workspace-a",
      status: "deleting"
    });
    expect(h.workspaces.records.find((record) => record.workspaceId === "workspace-a")?.status)
      .toBe("deleting");
  });

  it("delete_while_provisioning_returns_202_and_blocks_on_provision_dependency", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    replaceWorkspace(h, "workspace-a", { status: "provisioning" });
    h.operations.seed(operationRecord({
      operationId: "operation-provision",
      workspaceId: "workspace-a",
      operationFamily: "provisioning",
      operationType: "provision",
      status: "queued",
      version: 1
    }));

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    const provision = h.operations.records.find((record) => record.operationId === "operation-provision");
    const deprovision = h.operations.records.find((record) => record.operationFamily === "deprovisioning");

    expect(response.statusCode).toBe(202);
    expect(provision?.cancellationRequestedAt).toBe(WORKSPACE_API_TEST_NOW);
    expect(deprovision).toMatchObject({
      status: "blocked",
      dependsOnOperationId: "operation-provision"
    });
  });

  it("delete_same_key_replays_same_safe_response", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");

    const first = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });
    const second = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(second.statusCode).toBe(202);
    expect(second.body.data).toEqual(first.body.data);
    expect(h.operations.records.filter((record) => record.operationFamily === "deprovisioning"))
      .toHaveLength(1);
  });

  it("delete_same_key_different_fingerprint_returns_409", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    h.receipts.records.push({
      commandReceiptId: "receipt-conflict",
      actorUserId: "user-1",
      commandType: "workspace.delete",
      commandTarget: "workspace:workspace-a",
      workspaceId: "workspace-a",
      idempotencyKeyHash: "delete-key-1",
      requestFingerprint: "different-fingerprint",
      responseStatusCode: 202,
      responseBody: null,
      responseHeaders: null,
      operationId: null,
      status: "completed",
      createdAt: WORKSPACE_API_TEST_NOW,
      updatedAt: WORKSPACE_API_TEST_NOW,
      expiresAt: "2026-06-27T00:00:00.000Z",
      completedAt: WORKSPACE_API_TEST_NOW
    });

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(409);
    expect(response.body.error.code).toBe("workspace.idempotency_conflict");
  });

  it("delete_from_deleting_reuses_existing_operation", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    replaceWorkspace(h, "workspace-a", { status: "deleting" });
    h.operations.seed(operationRecord({
      operationId: "operation-existing",
      workspaceId: "workspace-a",
      operationFamily: "deprovisioning",
      operationType: "deprovision",
      status: "queued"
    }));

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(202);
    expect(response.body.data.operation).toEqual({
      operationId: "operation-existing",
      status: "reused"
    });
    expect(h.operations.records).toHaveLength(1);
  });

  it("delete_failed_retry_is_reconcile_first_only", async () => {
    const h = createWorkspaceApiTestComposition({ deleteFailedRetryReconciled: true });
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    replaceWorkspace(h, "workspace-a", { status: "delete_failed" });

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(202);
    expect(h.operations.records[0]).toMatchObject({
      operationFamily: "deprovisioning",
      executionPhase: "reconcile"
    });
  });

  it("delete_failed_retry_same_key_replays_retry_receipt", async () => {
    const h = createWorkspaceApiTestComposition({ deleteFailedRetryReconciled: true });
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");
    replaceWorkspace(h, "workspace-a", { status: "delete_failed" });

    const first = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });
    const second = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(second.statusCode).toBe(202);
    expect(second.body.data).toEqual(first.body.data);
    expect(h.operations.records.filter((record) => record.executionPhase === "reconcile"))
      .toHaveLength(1);
  });

  it("delete_conceals_inaccessible_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({ workspaceId: "workspace-secret" }));

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-secret" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(404);
  });

  it("delete_returns_403_only_for_confirmed-known-forbidden_case", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({ workspaceId: "workspace-known" }));
    h.access.knownForbidden.add("workspace-known");

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-known" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(403);
  });

  it("delete_rejects_expired_bootstrap_creator", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({
      workspaceId: "workspace-expired",
      createdByUserId: "user-1",
      ownerBootstrapState: "pending",
      ownerBootstrapExpiresAt: "2026-06-25T00:00:00.000Z"
    }));

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-expired" },
      idempotencyKey: "delete-key-1"
    });

    expect(response.statusCode).toBe(404);
  });

  it("delete_never_calls_runtime_provider", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");

    await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expect(h.runtime.calls).toHaveLength(0);
  });

  it("delete_never_finalizes_workspace", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");

    await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    const workspace = h.workspaces.records.find((record) => record.workspaceId === "workspace-a");
    expect(workspace?.status).toBe("deleting");
    expect(workspace?.deletedAt).toBeNull();
  });

  it("delete_response_does_not_expose_internal_fields", async () => {
    const h = createWorkspaceApiTestComposition();
    seedVisibleWorkspace(h, "workspace-a", "Workspace A", "user-1");

    const response = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-a" },
      idempotencyKey: "delete-key-1"
    });

    expectNoInternalWorkspaceFields(response.body);
  });

  it("detail_and_delete_always_use_authoritative_access_decision_not_projection_only", async () => {
    const h = createWorkspaceApiTestComposition();
    h.workspaces.seed(workspaceRecord({ workspaceId: "workspace-projected" }));
    h.visibility.seed(visibilityRecord({
      userId: "user-1",
      workspaceId: "workspace-projected"
    }));

    const detail = await invoke(h, "detail", {
      auth: "USER1",
      params: { workspaceId: "workspace-projected" }
    });
    const deletion = await invoke(h, "delete", {
      auth: "USER1",
      params: { workspaceId: "workspace-projected" },
      idempotencyKey: "delete-key-1"
    });

    expect(detail.statusCode).toBe(404);
    expect(deletion.statusCode).toBe(404);
    expect(h.access.calls.filter((call) => call.kind === "detail")).toHaveLength(2);
  });
});

describe("Workspace Management API route boundaries", () => {
  it("workspace_routes_register_expected_methods_without_runtime_binding", () => {
    const h = createWorkspaceApiTestComposition();
    const router = createWorkspaceManagementRouter(h.httpDependencies);

    expect(router).toBeDefined();
    expect(h.runtime.calls).toHaveLength(0);
  });

  it("workspace_http_layer_does_not_import_prisma_docker_openclaw_or_private_modules", () => {
    const files = [
      "apps/backend/src/modules/workspace-management/interface/http/workspace-controller.ts",
      "apps/backend/src/modules/workspace-management/interface/http/workspace-routes.ts",
      "apps/backend/src/modules/workspace-management/interface/http/workspace-request-validation.ts",
      "apps/backend/src/modules/workspace-management/interface/http/workspace-response-mapper.ts"
    ];
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

    for (const forbidden of [
      "@vcp/database",
      "@prisma/client",
      "PrismaClient",
      "local-demo",
      "docker",
      "openclaw",
      "workspace-user-management",
      "subscription-payment",
      "agent-management",
      "workflow-management",
      "task-orchestration"
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

type InvokeOptions = {
  readonly auth?: "USER1" | "USER2";
  readonly idempotencyKey?: string;
  readonly body?: unknown;
  readonly params?: Record<string, string>;
  readonly query?: Record<string, string>;
};

async function invoke(
  h: ReturnType<typeof createWorkspaceApiTestComposition>,
  action: "list" | "create" | "detail" | "delete",
  options: InvokeOptions = {}
) {
  const response = makeResponse();
  const request = makeRequest(options);
  await h.controller[action](request as Request, response as unknown as Response);
  return {
    statusCode: response.statusCode,
    body: response.body
  };
}

function makeRequest(options: InvokeOptions): Partial<Request> & {
  context?: unknown;
} {
  const headers: Record<string, string> = {};
  if (options.idempotencyKey) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  const request: Partial<Request> & { context?: unknown } = {
    body: options.body,
    params: options.params ?? {},
    query: options.query ?? {},
    header(name: string) {
      return headers[name.toLowerCase()];
    }
  };

  if (options.auth) {
    request.context = {
      requestId: "workspace-api-test",
      user: {
        userId: options.auth === "USER1" ? "user-1" : "user-2",
        email: `${options.auth.toLowerCase()}@example.test`
      }
    };
  } else {
    request.context = { requestId: "workspace-api-test" };
  }

  return request;
}

function makeResponse() {
  return {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Workspace One",
    requestedProfile: "standard",
    ...overrides
  };
}

function seedVisibleWorkspace(
  h: ReturnType<typeof createWorkspaceApiTestComposition>,
  workspaceId: string,
  name: string,
  userId: string,
  updatedAt = WORKSPACE_API_TEST_NOW
) {
  h.workspaces.seed(workspaceRecord({
    workspaceId,
    name,
    normalizedName: name.toLowerCase(),
    updatedAt,
    createdByUserId: "creator",
    ownerBootstrapState: "not_applicable"
  }));
  h.visibility.seed(visibilityRecord({
    userId,
    workspaceId,
    projectionUpdatedAt: updatedAt
  }));
  h.access.readable.add(workspaceId);
  h.access.deletable.add(workspaceId);
}

function replaceWorkspace(
  h: ReturnType<typeof createWorkspaceApiTestComposition>,
  workspaceId: string,
  patch: Partial<ReturnType<typeof workspaceRecord>>
) {
  const index = h.workspaces.records.findIndex((record) => record.workspaceId === workspaceId);
  const current = h.workspaces.records[index];
  if (!current) {
    throw new Error(`Missing test workspace ${workspaceId}`);
  }
  h.workspaces.records[index] = { ...current, ...patch };
}

function expectNoInternalWorkspaceFields(body: unknown) {
  const serialized = JSON.stringify(body);
  for (const forbidden of [
    "runtimeRef",
    "runtimeUrl",
    "providerRequestKey",
    "leaseToken",
    "requestFingerprint",
    "commandReceiptId",
    "outboxMessageId",
    "ownerBootstrapAttemptId",
    "ownerBootstrapFailureMessage",
    "resolvedProvisioningProfile",
    "membershipVersion",
    "stack"
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}
