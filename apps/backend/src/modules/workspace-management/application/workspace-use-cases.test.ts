import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceRepository } from "./workspace-repository.ts";
import type { Workspace } from "../domain/workspace.ts";
import {
  WorkspaceUseCases,
  WorkspaceNotFoundError,
  WorkspaceAccessDeniedError,
  WorkspaceValidationError,
  WorkspaceCannotBeDeletedError,
  type WorkspaceUseCaseDeps
} from "./workspace-use-cases.ts";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const WS_ID = "ws_001" as EntityId<"workspaceId">;
const USER_ID = "user_001" as EntityId<"userId">;
const TS = "2026-01-15T10:00:00.000Z";

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    workspaceId: WS_ID,
    userId: USER_ID,
    name: "Test WS",
    status: "running",
    plan: "free",
    createdAt: TS,
    updatedAt: TS,
    ...overrides
  };
}

// ── Minimal PrismaClient mock ─────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    agent: { count: vi.fn().mockResolvedValue(2) },
    workflow: { count: vi.fn().mockResolvedValue(3) },
    toolConnection: { count: vi.fn().mockResolvedValue(1) },
    workspaceMember: { findFirst: vi.fn().mockResolvedValue(null) },
    ...overrides
  } as unknown as WorkspaceUseCaseDeps["prisma"];
}

// ── Repository mock ───────────────────────────────────────────────────────────

function makeRepo(overrides: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    save: vi.fn().mockImplementation(async (ws: Workspace) => ws),
    findById: vi.fn().mockResolvedValue(null),
    listAccessibleByUser: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

// ── EventBus mock ─────────────────────────────────────────────────────────────

function makeEventBus() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

// ── Factory ───────────────────────────────────────────────────────────────────

function makeUseCases(
  repoOverrides: Partial<WorkspaceRepository> = {},
  prismaOverrides: Record<string, unknown> = {}
): { useCases: WorkspaceUseCases; repo: WorkspaceRepository; eventBus: ReturnType<typeof makeEventBus> } {
  const repo = makeRepo(repoOverrides);
  const eventBus = makeEventBus();
  const deps: WorkspaceUseCaseDeps = {
    repository: repo,
    prisma: makePrisma(prismaOverrides),
    eventBus,
    now: () => TS,
    generateWorkspaceId: () => WS_ID,
    generateEventId: () => "evt_001" as EntityId<"eventId">
  };
  return { useCases: new WorkspaceUseCases(deps), repo, eventBus };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorkspaceUseCases.listWorkspaces", () => {
  it("returns summary DTOs for accessible workspaces", async () => {
    const ws = makeWorkspace();
    const { useCases } = makeUseCases({ listAccessibleByUser: vi.fn().mockResolvedValue([ws]) });
    const result = await useCases.listWorkspaces(USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe(WS_ID);
    expect(result[0].status).toBe("running");
  });

  it("returns empty array when user has no workspaces", async () => {
    const { useCases } = makeUseCases();
    const result = await useCases.listWorkspaces(USER_ID);
    expect(result).toEqual([]);
  });
});

describe("WorkspaceUseCases.getWorkspaceDetail", () => {
  it("returns detail DTO with aggregate counts", async () => {
    const ws = makeWorkspace();
    const { useCases } = makeUseCases({ findById: vi.fn().mockResolvedValue(ws) });
    const dto = await useCases.getWorkspaceDetail(WS_ID, USER_ID);
    expect(dto.agentCount).toBe(2);
    expect(dto.workflowCount).toBe(3);
    expect(dto.toolCount).toBe(1);
  });

  it("throws WorkspaceNotFoundError when workspace does not exist", async () => {
    const { useCases } = makeUseCases({ findById: vi.fn().mockResolvedValue(null) });
    await expect(useCases.getWorkspaceDetail(WS_ID, USER_ID)).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  it("throws WorkspaceNotFoundError when workspace is deleted", async () => {
    const ws = makeWorkspace({ status: "deleted" });
    const { useCases } = makeUseCases({ findById: vi.fn().mockResolvedValue(ws) });
    await expect(useCases.getWorkspaceDetail(WS_ID, USER_ID)).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  it("throws WorkspaceAccessDeniedError when user is not owner and not a member", async () => {
    const ws = makeWorkspace({ userId: "other_user" as EntityId<"userId"> });
    const { useCases } = makeUseCases({ findById: vi.fn().mockResolvedValue(ws) });
    await expect(useCases.getWorkspaceDetail(WS_ID, USER_ID)).rejects.toBeInstanceOf(WorkspaceAccessDeniedError);
  });
});

describe("WorkspaceUseCases.createWorkspace", () => {
  it("saves workspace with status 'pending' and publishes provisioning_requested event", async () => {
    const { useCases, repo, eventBus } = makeUseCases();
    await useCases.createWorkspace({ userId: USER_ID, name: "New WS", plan: "free" });
    expect(repo.save).toHaveBeenCalledOnce();
    expect(eventBus.publish).toHaveBeenCalledOnce();
    const [event] = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(event.name).toBe("workspace.provisioning_requested");
  });

  it("throws WorkspaceValidationError when name is blank", async () => {
    const { useCases } = makeUseCases();
    await expect(useCases.createWorkspace({ userId: USER_ID, name: "   ", plan: "free" })).rejects.toBeInstanceOf(WorkspaceValidationError);
  });

  it("throws WorkspaceValidationError when name exceeds 100 chars", async () => {
    const { useCases } = makeUseCases();
    const longName = "a".repeat(101);
    await expect(useCases.createWorkspace({ userId: USER_ID, name: longName, plan: "free" })).rejects.toBeInstanceOf(WorkspaceValidationError);
  });
});

describe("WorkspaceUseCases.deleteWorkspace", () => {
  it("updates status to stopping and publishes workspace.deleted event", async () => {
    const ws = makeWorkspace({ status: "running" });
    const { useCases, repo, eventBus } = makeUseCases({ findById: vi.fn().mockResolvedValue(ws) });
    const ack = await useCases.deleteWorkspace(WS_ID, USER_ID);
    expect(ack.status).toBe("stopping");
    expect(repo.updateStatus).toHaveBeenCalledWith(WS_ID, { status: "stopping" }, TS);
    expect(eventBus.publish).toHaveBeenCalledOnce();
    const [event] = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(event.name).toBe("workspace.deleted");
  });

  it("throws WorkspaceCannotBeDeletedError for status 'stopping'", async () => {
    const ws = makeWorkspace({ status: "stopping" });
    const { useCases } = makeUseCases({ findById: vi.fn().mockResolvedValue(ws) });
    await expect(useCases.deleteWorkspace(WS_ID, USER_ID)).rejects.toBeInstanceOf(WorkspaceCannotBeDeletedError);
  });

  it("throws WorkspaceCannotBeDeletedError for status 'deleted'", async () => {
    const ws = makeWorkspace({ status: "deleted" });
    const { useCases } = makeUseCases({ findById: vi.fn().mockResolvedValue(ws) });
    await expect(useCases.deleteWorkspace(WS_ID, USER_ID)).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });
});
