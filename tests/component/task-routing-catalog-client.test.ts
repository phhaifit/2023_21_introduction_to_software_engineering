import { describe, expect, it, vi } from "vitest";

import { createTaskRoutingCatalogClient } from
  "@vcp/frontend/features/task-orchestration/model/task-routing-catalog-client.ts";
import type { EntityId } from "@vcp/shared";

describe("Task routing catalog client", () => {
  it("loads agents and published workflows from public module APIs", async () => {
    const fetchImplementation = vi.fn(async (url: string) => {
      if (url.endsWith("/agents")) {
        return jsonResponse({
          ok: true,
          data: [
            {
              agentId: "agent-enabled",
              workspaceId: "workspace-product-demo",
              name: "Support Agent",
              role: "Support",
              model: "gemini-2.5-flash",
              status: "enabled",
              updatedAt: "2026-06-29T00:00:00.000Z"
            },
            {
              agentId: "agent-disabled",
              workspaceId: "workspace-product-demo",
              name: "Paused Agent",
              role: "Review",
              model: "gemini-2.5-flash",
              status: "disabled",
              updatedAt: "2026-06-29T00:00:00.000Z"
            }
          ]
        });
      }

      return jsonResponse({
        ok: true,
        data: [
          {
            workflowId: "workflow-published",
            name: "Published Workflow",
            description: "Ready to execute",
            status: "published",
            triggerType: "manual",
            updatedAt: "2026-06-29T00:00:00.000Z",
            stepCount: 2
          },
          {
            workflowId: "workflow-draft",
            name: "Draft Workflow",
            description: "Not executable yet",
            status: "draft",
            triggerType: "manual",
            updatedAt: "2026-06-29T00:00:00.000Z",
            stepCount: 1
          }
        ]
      });
    });

    const client = createTaskRoutingCatalogClient({ fetchImplementation });
    const catalog = await client.listRoutingCatalog(
      "workspace-product-demo" as EntityId<"workspaceId">
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-product-demo/agents",
      expect.any(Object)
    );
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/workspaces/workspace-product-demo/workflows",
      expect.any(Object)
    );
    expect(catalog.agents).toEqual([
      {
        id: "agent-enabled",
        name: "Support Agent",
        description: "Support using gemini-2.5-flash",
        capabilities: ["Support", "gemini-2.5-flash"],
        available: true
      },
      {
        id: "agent-disabled",
        name: "Paused Agent",
        description: "Review using gemini-2.5-flash",
        capabilities: ["Review", "gemini-2.5-flash"],
        available: false
      }
    ]);
    expect(catalog.workflows).toEqual([
      {
        id: "workflow-published",
        name: "Published Workflow",
        description: "Ready to execute",
        agentIds: []
      }
    ]);
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
