import type { EntityId } from "../../../../../shared/contracts/ids.ts";
import type { Agent } from "../domain/agent.ts";
import type { AgentListFilters, AgentRepository } from "../application/agent-repository.ts";

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

  async listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters: AgentListFilters = {}
  ): Promise<Agent[]> {
    const statusSet = filters.statuses ? new Set(filters.statuses) : null;

    return [...this.agents.values()]
      .filter((agent) => agent.workspaceId === workspaceId)
      .filter((agent) => !statusSet || statusSet.has(agent.status))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((agent) => this.copy(agent));
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
