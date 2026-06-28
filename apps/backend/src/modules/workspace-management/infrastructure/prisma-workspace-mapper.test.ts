import { describe, it, expect } from "vitest";
import { toDomain, toPrismaCreate } from "./prisma-workspace-mapper.ts";

const baseRow = {
  workspaceId: "ws_001",
  userId: "user_001",
  name: "My Workspace",
  status: "running",
  plan: "standard",
  runtimeUrl: "https://runtime.example.com",
  containerId: "ctr_abc",
  failureReason: null,
  subscriptionId: "sub_xyz",
  createdAt: "2026-01-15T10:00:00.000Z",
  updatedAt: "2026-01-16T12:00:00.000Z"
};

describe("toDomain", () => {
  it("maps all fields from a database row to a domain workspace", () => {
    const ws = toDomain(baseRow);
    expect(ws.workspaceId).toBe("ws_001");
    expect(ws.userId).toBe("user_001");
    expect(ws.name).toBe("My Workspace");
    expect(ws.status).toBe("running");
    expect(ws.plan).toBe("standard");
    expect(ws.runtimeUrl).toBe("https://runtime.example.com");
    expect(ws.containerId).toBe("ctr_abc");
    expect(ws.failureReason).toBeUndefined();
    expect(ws.subscriptionId).toBe("sub_xyz");
  });

  it("converts null optional fields to undefined", () => {
    const row = { ...baseRow, runtimeUrl: null, containerId: null, subscriptionId: null };
    const ws = toDomain(row);
    expect(ws.runtimeUrl).toBeUndefined();
    expect(ws.containerId).toBeUndefined();
    expect(ws.subscriptionId).toBeUndefined();
  });

  it("preserves failureReason when set", () => {
    const row = { ...baseRow, status: "failed", failureReason: "Container OOM" };
    const ws = toDomain(row);
    expect(ws.failureReason).toBe("Container OOM");
  });
});

describe("toPrismaCreate", () => {
  it("converts a domain workspace to a Prisma create payload", () => {
    const ws = toDomain(baseRow);
    const payload = toPrismaCreate(ws);
    expect(payload.workspaceId).toBe("ws_001");
    expect(payload.runtimeUrl).toBe("https://runtime.example.com");
    expect(payload.containerId).toBe("ctr_abc");
    expect(payload.failureReason).toBeNull();
  });

  it("converts undefined optional fields back to null", () => {
    const row = { ...baseRow, runtimeUrl: null, containerId: null, subscriptionId: null };
    const ws = toDomain(row);
    const payload = toPrismaCreate(ws);
    expect(payload.runtimeUrl).toBeNull();
    expect(payload.containerId).toBeNull();
    expect(payload.subscriptionId).toBeNull();
  });
});
