import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Agent } from "../domain/agent.ts";
import type { AgentListFilters, AgentPaginatedResult, AgentRepository } from "../application/agent-repository.ts";

export class InMemoryAgentRepository implements AgentRepository {
  private readonly agents = new Map<string, Agent>();

  async save(agent: Agent): Promise<Agent> {
    this.agents.set(this.key(agent.workspaceId, agent.agentId), this.copy(agent));
    return this.copy(agent);
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<Agent | null> {
    const agent = this.agents.get(this.key(workspaceId, agentId));
    return agent ? this.copy(agent) : null;
  }

  private filterAgents(workspaceId: EntityId<"workspaceId">, filters: AgentListFilters): Agent[] {
    const statusSet = filters.statuses ? new Set(filters.statuses) : null;
    const searchLower = filters.search?.toLowerCase();

    return [...this.agents.values()]
      .filter((agent) => agent.workspaceId === workspaceId)
      .filter((agent) => !statusSet || statusSet.has(agent.status))
      .filter((agent) => {
        if (!searchLower) return true;
        return (
          agent.name.toLowerCase().includes(searchLower) ||
          agent.role.toLowerCase().includes(searchLower)
        );
      });
  }

  async countByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters: AgentListFilters = {}
  ): Promise<number> {
    return this.filterAgents(workspaceId, filters).length;
  }

  async listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters: AgentListFilters = {}
  ): Promise<AgentPaginatedResult> {
    let filtered = this.filterAgents(workspaceId, filters);
    const total = filtered.length;

    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = filters.sortOrder || "asc";

    filtered.sort((left, right) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = left.name.localeCompare(right.name);
          break;
        case "updatedAt":
          cmp = left.updatedAt.localeCompare(right.updatedAt);
          break;
        case "status":
          cmp = left.status.localeCompare(right.status);
          break;
        case "createdAt":
        default:
          cmp = left.createdAt.localeCompare(right.createdAt);
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    filtered = filtered.slice(skip, skip + pageSize);

    return {
      agents: filtered.map((agent) => this.copy(agent)),
      total,
    };
  }

  async existsByName(workspaceId: EntityId<"workspaceId">, name: string): Promise<boolean> {
    const normalizedName = this.normalizeName(name);

    return [...this.agents.values()].some(
      (agent) =>
        agent.workspaceId === workspaceId && this.normalizeName(agent.name) === normalizedName
    );
  }

  private key(workspaceId: EntityId<"workspaceId">, agentId: EntityId<"agentId">): string {
    return `${workspaceId}:${agentId}`;
  }

  private copy(agent: Agent): Agent {
    return { ...agent };
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }
}
