import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Agent } from "../domain/agent.ts";
import type { AgentListFilters, AgentRepository } from "../application/agent-repository.ts";
import { toDomain, toPrismaCreate } from "./prisma-agent-mapper.ts";

export class PrismaAgentRepository implements AgentRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async save(agent: Agent): Promise<Agent> {
    const data = toPrismaCreate(agent);

    const record = await this.prisma.agent.upsert({
      where: { agentId: data.agentId },
      create: data,
      update: data
    });

    return toDomain(record);
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<Agent | null> {
    const record = await this.prisma.agent.findFirst({
      where: { agentId, workspaceId }
    });

    return record ? toDomain(record) : null;
  }

  async listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters: AgentListFilters = {}
  ): Promise<Agent[]> {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: [...filters.statuses] };
    }

    const records = await this.prisma.agent.findMany({
      where,
      orderBy: { createdAt: "asc" }
    });

    return records.map(toDomain);
  }

  async existsByName(
    workspaceId: EntityId<"workspaceId">,
    name: string
  ): Promise<boolean> {
    const record = await this.prisma.agent.findFirst({
      where: {
        workspaceId,
        name: { equals: name.trim(), mode: "insensitive" }
      }
    });

    return record !== null;
  }
}
