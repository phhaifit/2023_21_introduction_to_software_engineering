import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";
import type { Agent } from "../domain/agent.ts";

export type AgentListFilters = {
  search?: string;
  statuses?: readonly AgentStatus[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type AgentPaginatedResult = {
  agents: Agent[];
  total: number;
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
  ): Promise<AgentPaginatedResult>;
  countByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters?: AgentListFilters
  ): Promise<number>;
  existsByName(workspaceId: EntityId<"workspaceId">, name: string): Promise<boolean>;
};
