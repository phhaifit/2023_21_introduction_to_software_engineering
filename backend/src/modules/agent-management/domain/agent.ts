import type { AgentPublicSummary } from "../../../../../shared/contracts/agent-management.ts";
import type { EntityId } from "../../../../../shared/contracts/ids.ts";
import type { AgentStatus } from "../../../../../shared/contracts/statuses.ts";

export type Agent = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  instructions: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentDraft = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  status?: AgentStatus;
};

export function createAgent(draft: AgentDraft): Agent {
  return {
    ...draft,
    status: draft.status ?? "enabled"
  };
}

export function isAgentSelectable(agent: Pick<Agent, "status">): boolean {
  return agent.status === "enabled";
}

export function toAgentPublicSummary(agent: Agent): AgentPublicSummary {
  return {
    agentId: agent.agentId,
    workspaceId: agent.workspaceId,
    name: agent.name,
    role: agent.role,
    model: agent.model,
    status: agent.status,
    updatedAt: agent.updatedAt
  };
}
