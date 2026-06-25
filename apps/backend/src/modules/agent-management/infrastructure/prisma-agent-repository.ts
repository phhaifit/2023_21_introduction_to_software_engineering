import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Agent } from "../domain/agent.ts";
import type { AgentListFilters, AgentPaginatedResult, AgentRepository } from "../application/agent-repository.ts";
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

  private buildWhereClause(workspaceId: EntityId<"workspaceId">, filters: AgentListFilters): any {
    const where: any = { workspaceId };

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: [...filters.statuses] };
    }

    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { role: { contains: search, mode: "insensitive" } }
      ];
    }

    return where;
  }

  async countByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters: AgentListFilters = {}
  ): Promise<number> {
    const where = this.buildWhereClause(workspaceId, filters);
    return this.prisma.agent.count({ where });
  }

  async listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    filters: AgentListFilters = {}
  ): Promise<AgentPaginatedResult> {
    const where = this.buildWhereClause(workspaceId, filters);
    const total = await this.prisma.agent.count({ where });

    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = filters.sortOrder || "asc";
    const orderBy = { [sortBy]: sortOrder };

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const records = await this.prisma.agent.findMany({
      where,
      orderBy,
      skip,
      take: pageSize
    });

    return {
      agents: records.map(toDomain),
      total
    };
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
