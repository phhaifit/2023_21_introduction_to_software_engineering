import { describe, it, expect } from "vitest";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  createWorkspace,
  isWorkspaceDeletable,
  isWorkspaceAccessible,
  toWorkspaceSummaryDto,
  toWorkspaceDetailDto,
  type WorkspaceDraft
} from "./workspace.ts";

const baseId = "ws_test_001" as EntityId<"workspaceId">;
const userId = "user_001" as EntityId<"userId">;
const ts = "2026-01-15T10:00:00.000Z";

const draft: WorkspaceDraft = {
  workspaceId: baseId,
  userId,
  name: "Test Workspace",
  plan: "free",
  createdAt: ts,
  updatedAt: ts
};

describe("createWorkspace", () => {
  it("creates workspace with status 'pending'", () => {
    const ws = createWorkspace(draft);
    expect(ws.status).toBe("pending");
  });

  it("preserves all draft fields", () => {
    const ws = createWorkspace(draft);
    expect(ws.workspaceId).toBe(baseId);
    expect(ws.userId).toBe(userId);
    expect(ws.name).toBe("Test Workspace");
    expect(ws.plan).toBe("free");
    expect(ws.createdAt).toBe(ts);
    expect(ws.updatedAt).toBe(ts);
  });

  it("carries optional subscriptionId when provided", () => {
    const subId = "sub_abc" as EntityId<"subscriptionId">;
    const ws = createWorkspace({ ...draft, subscriptionId: subId });
    expect(ws.subscriptionId).toBe(subId);
  });
});

describe("isWorkspaceDeletable", () => {
  it.each(["running", "failed", "pending"] as const)("returns true for status %s", (status) => {
    expect(isWorkspaceDeletable({ status })).toBe(true);
  });

  it.each(["stopping", "deleted"] as const)("returns false for status %s", (status) => {
    expect(isWorkspaceDeletable({ status })).toBe(false);
  });
});

describe("isWorkspaceAccessible", () => {
  it.each(["pending", "running", "failed", "stopping"] as const)(
    "returns true for status %s",
    (status) => {
      expect(isWorkspaceAccessible({ status })).toBe(true);
    }
  );

  it("returns false for status 'deleted'", () => {
    expect(isWorkspaceAccessible({ status: "deleted" })).toBe(false);
  });
});

describe("toWorkspaceSummaryDto", () => {
  it("maps domain entity to summary DTO", () => {
    const ws = createWorkspace(draft);
    const dto = toWorkspaceSummaryDto(ws);
    expect(dto.workspaceId).toBe(ws.workspaceId);
    expect(dto.name).toBe(ws.name);
    expect(dto.status).toBe("pending");
    expect(dto.plan).toBe("free");
    expect(dto.createdAt).toBe(ts);
    expect(dto.updatedAt).toBe(ts);
  });
});

describe("toWorkspaceDetailDto", () => {
  it("includes aggregate counts and runtimeUrl in detail DTO", () => {
    const ws = { ...createWorkspace(draft), status: "running" as const, runtimeUrl: "https://ws.example.com" };
    const dto = toWorkspaceDetailDto(ws, { agentCount: 3, workflowCount: 5, toolCount: 2 });
    expect(dto.runtimeUrl).toBe("https://ws.example.com");
    expect(dto.agentCount).toBe(3);
    expect(dto.workflowCount).toBe(5);
    expect(dto.toolCount).toBe(2);
  });

  it("omits runtimeUrl when not set", () => {
    const ws = createWorkspace(draft);
    const dto = toWorkspaceDetailDto(ws, { agentCount: 0, workflowCount: 0, toolCount: 0 });
    expect(dto.runtimeUrl).toBeUndefined();
  });
});
