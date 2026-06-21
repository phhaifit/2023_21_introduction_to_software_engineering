import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";
import type { Agent } from "../domain/agent.ts";

export type AgentListFilters = {
  statuses?: readonly AgentStatus[];
};

export type AgentRepository = {
  save(agent: Agent): Promise<Agent>;
  findById(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<Agent | null>;
  listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters?: AgentListFilters
  ): Promise<Agent[]>;
  existsByName(workspaceId: EntityId<"workspaceId">, name: string): Promise<boolean>;
};
