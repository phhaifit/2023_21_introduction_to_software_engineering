import { describe, expect, it, vi } from "vitest";

import {
  AgentApiClientError,
  createAgentManagementApiClient
} from "@vcp/frontend/features/agent-management/agent-management-api-client.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

const workspaceId = "workspace-a" as EntityId<"workspaceId">;
const agentId = "agent-a" as EntityId<"agentId">;

const summary = {
  agentId,
  workspaceId,
  name: "Research Agent",
  role: "Researcher",
  model: "gemini-2.5-flash",
  status: "enabled" as const,
  updatedAt: "2026-06-20T00:00:00.000Z"
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function success(data: unknown): Response {
  return response({
    ok: true,
    data,
    meta: { requestId: "test", timestamp: "2026-06-20T00:00:00.000Z" }
  });
}

function paginatedSuccess(data: unknown[], pagination: unknown): Response {
  return response({
    ok: true,
    data,
    meta: { requestId: "test", timestamp: "2026-06-20T00:00:00.000Z", pagination }
  });
}

describe("Agent Management API client", () => {
  it("lists workspace agents and parses successful data", async () => {
    const fetchImplementation = vi.fn(async () =>
      paginatedSuccess(
        [{ ...summary, createdAt: "2026-06-19T00:00:00.000Z" }],
        { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
      )
    );
    const client = createAgentManagementApiClient({ fetchImplementation });

    const result = await client.listAgents(workspaceId);

    expect(result.items[0].agentId).toBe(agentId);
    expect(result.pagination.totalItems).toBe(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-a/agents",
      expect.objectContaining({ headers: expect.objectContaining({ accept: "application/json" }) })
    );
  });

  it("lists workspace agents with query parameters", async () => {
    const fetchImplementation = vi.fn(async () =>
      paginatedSuccess([], { page: 2, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: true })
    );
    const client = createAgentManagementApiClient({ fetchImplementation });

    await client.listAgents(workspaceId, { search: "test", page: 2, pageSize: 10, sortOrder: "desc" });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-a/agents?search=test&sortOrder=desc&page=2&pageSize=10",
      expect.any(Object)
    );
  });

  it("creates an agent with the complete form payload", async () => {
    const fetchImplementation = vi.fn(async () => success(summary));
    const client = createAgentManagementApiClient({ fetchImplementation });
    const payload = {
      name: "Research Agent",
      role: "Researcher",
      model: "gemini-2.5-flash",
      instructions: "Prepare research."
    };

    await client.createAgent(workspaceId, payload);

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-a/agents",
      expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
    );
  });

  it("lists selectable agent models from the workspace catalog", async () => {
    const models = [
      {
        providerId: "gemini",
        modelId: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        capabilities: ["text-generation", "structured-output"],
        tier: "demo",
        enabled: true
      }
    ];
    const fetchImplementation = vi.fn(async () => success(models));
    const client = createAgentManagementApiClient({ fetchImplementation });

    const result = await client.listAgentModels(workspaceId);

    expect(result).toEqual(models);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-a/agents/models",
      expect.objectContaining({ headers: expect.objectContaining({ accept: "application/json" }) })
    );
  });

  it("reads configuration and updates the selected agent", async () => {
    const configuration = { ...summary, instructions: "Prepare research." };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(success(configuration))
      .mockResolvedValueOnce(success({ ...summary, role: "Analyst" }));
    const client = createAgentManagementApiClient({ fetchImplementation });

    await client.getAgentConfiguration(workspaceId, agentId);
    await client.updateAgent(workspaceId, agentId, {
      role: "Analyst",
      model: "gemini-2.5-flash-lite",
      instructions: "Prepare analysis."
    });

    expect(fetchImplementation.mock.calls[0][0]).toBe(
      "/api/workspaces/workspace-a/agents/agent-a/configuration"
    );
    expect(fetchImplementation.mock.calls[1]).toEqual([
      "/api/workspaces/workspace-a/agents/agent-a",
      expect.objectContaining({ method: "PATCH" })
    ]);
  });

  it("calls enable, disable, and delete with their expected methods and paths", async () => {
    const fetchImplementation = vi.fn(async () => success(summary));
    const client = createAgentManagementApiClient({ fetchImplementation });

    await client.enableAgent(workspaceId, agentId);
    await client.disableAgent(workspaceId, agentId);
    await client.deleteAgent(workspaceId, agentId);

    expect(fetchImplementation.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/workspaces/workspace-a/agents/agent-a/enable", "POST"],
      ["/api/workspaces/workspace-a/agents/agent-a/disable", "POST"],
      ["/api/workspaces/workspace-a/agents/agent-a", "DELETE"]
    ]);
  });

  it("calls rename and duplicate with expected methods and paths", async () => {
    const fetchImplementation = vi.fn(async () => success(summary));
    const client = createAgentManagementApiClient({ fetchImplementation });

    await client.renameAgent(workspaceId, agentId, "New Name");
    await client.duplicateAgent(workspaceId, agentId);

    expect(fetchImplementation.mock.calls[0]).toEqual([
      "/api/workspaces/workspace-a/agents/agent-a/name",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "New Name" }) })
    ]);
    expect(fetchImplementation.mock.calls[1]).toEqual([
      "/api/workspaces/workspace-a/agents/agent-a/duplicate",
      expect.objectContaining({ method: "POST" })
    ]);
  });

  it("preserves API validation details", async () => {
    const fetchImplementation = vi.fn(async () =>
      response(
        {
          ok: false,
          error: {
            code: "validation.invalid_input",
            message: "Invalid agent configuration",
            details: { issues: ["role is required"] }
          },
          meta: { requestId: "test", timestamp: "2026-06-20T00:00:00.000Z" }
        },
        400
      )
    );
    const client = createAgentManagementApiClient({ fetchImplementation });

    await expect(client.createAgent(workspaceId, {
      name: "Agent",
      role: "",
      model: "gemini-2.5-flash",
      instructions: "Work."
    })).rejects.toMatchObject({
      code: "validation.invalid_input",
      details: { issues: ["role is required"] },
      kind: "api",
      status: 400
    });
  });

  it("normalizes malformed and network failures", async () => {
    const malformedClient = createAgentManagementApiClient({
      fetchImplementation: vi.fn(async () => response({ ok: true, data: [] }))
    });
    const networkClient = createAgentManagementApiClient({
      fetchImplementation: vi.fn(async () => {
        throw new Error("offline");
      })
    });
    const errorClient = createAgentManagementApiClient({
      fetchImplementation: vi.fn(async () =>
        response(
          {
            ok: false,
            error: {
              code: "auth.unauthorized",
              message: "User is not authenticated"
            },
            meta: { requestId: "test", timestamp: "2026-06-20T00:00:00.000Z" }
          },
          401
        )
      )
    });

    await expect(malformedClient.listAgents(workspaceId)).rejects.toMatchObject({
      kind: "malformed-response",
      code: "system.unexpected_error"
    });
    await expect(malformedClient.listAgentModels(workspaceId)).rejects.toMatchObject({
      kind: "malformed-response",
      code: "system.unexpected_error"
    });
    await expect(errorClient.listAgentModels(workspaceId)).rejects.toMatchObject({
      kind: "api",
      code: "auth.unauthorized",
      status: 401
    });
    await expect(networkClient.listAgents(workspaceId)).rejects.toEqual(
      expect.objectContaining<Partial<AgentApiClientError>>({
        kind: "network",
        code: "system.unexpected_error"
      })
    );
  });
});
