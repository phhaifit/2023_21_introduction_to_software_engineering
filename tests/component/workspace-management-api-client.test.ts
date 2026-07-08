import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWorkspace,
  listWorkspaces
} from "@vcp/frontend/features/workspace-management/workspace-management-api-client.ts";

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

function stubLocalStorage(): Storage {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  } as Storage;
  vi.stubGlobal("localStorage", storage);
  return storage;
}

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return entry?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
}

describe("Workspace Management API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses current workspace summary DTOs without legacy status mapping", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => success([
      {
        workspaceId: "workspace-1",
        name: "Workspace 1",
        status: "pending",
        plan: "standard",
        createdAt: "2026-06-29T00:00:00.000Z",
        updatedAt: "2026-06-29T00:00:00.000Z"
      }
    ])));

    const result = await listWorkspaces();

    expect(result[0].status).toBe("pending");
    expect(result[0].plan).toBe("standard");
  });

  it("sends the current plan field when creating a workspace", async () => {
    const fetchMock = vi.fn(async () => success({
      workspaceId: "workspace-1",
      name: "Workspace 1",
      status: "pending",
      plan: "premium",
      createdAt: "2026-06-29T00:00:00.000Z",
      updatedAt: "2026-06-29T00:00:00.000Z"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createWorkspace({ name: "Workspace 1", plan: "premium" });

    expect(result.plan).toBe("premium");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: "Workspace 1",
      plan: "premium",
      requestedProfile: "premium"
    });
  });

  it("sends the persisted auth token when listing workspaces", async () => {
    stubLocalStorage().setItem("vcp.auth.token", "session-token");
    const fetchMock = vi.fn(async () => success([]));
    vi.stubGlobal("fetch", fetchMock);

    await listWorkspaces();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(headerValue(init.headers, "Authorization")).toBe("Bearer session-token");
  });

  it("sends the persisted auth token when creating a workspace", async () => {
    stubLocalStorage().setItem("vcp.auth.token", "session-token");
    const fetchMock = vi.fn(async () => success({
      workspaceId: "workspace-1",
      name: "Workspace 1",
      status: "pending",
      plan: "standard",
      createdAt: "2026-06-29T00:00:00.000Z",
      updatedAt: "2026-06-29T00:00:00.000Z"
    }));
    vi.stubGlobal("fetch", fetchMock);

    await createWorkspace({ name: "Workspace 1", plan: "standard" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(headerValue(init.headers, "Authorization")).toBe("Bearer session-token");
  });
});
