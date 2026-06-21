import type { EntityId } from "@vcp/shared/contracts/ids.ts";

import type { AgentManagementViewInput } from "./agent-management-view.ts";

const workspaceId = "workspace-product-demo" as EntityId<"workspaceId">;

export const agentManagementMockInput: AgentManagementViewInput = {
  selectedAgentId: "agent-research" as EntityId<"agentId">,
  agents: [
    {
      agentId: "agent-research" as EntityId<"agentId">,
      workspaceId,
      name: "Research Agent",
      role: "Market researcher",
      model: "gpt-4.1-mini",
      status: "enabled",
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:30:00.000Z"
    },
    {
      agentId: "agent-support" as EntityId<"agentId">,
      workspaceId,
      name: "Support Agent",
      role: "Customer support",
      model: "gpt-4.1-mini",
      status: "disabled",
      createdAt: "2026-06-19T09:15:00.000Z",
      updatedAt: "2026-06-20T07:45:00.000Z"
    }
  ],
  form: {
    mode: "create",
    values: {
      name: "",
      role: "",
      model: "gpt-4.1-mini",
      instructions: ""
    }
  }
};

export const agentManagementMockInstructions: Record<string, string> = {
  "agent-research": "Track market signals and prepare concise opportunity briefs.",
  "agent-support": "Draft support replies and flag conversations that need a human owner."
};
