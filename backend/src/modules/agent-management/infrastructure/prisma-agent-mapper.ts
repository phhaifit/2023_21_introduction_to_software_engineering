import type { Agent as PrismaAgent } from "@prisma/client";
import type { Agent } from "../domain/agent.ts";
import type { EntityId } from "../../../../../shared/contracts/ids.ts";
import type { AgentStatus } from "../../../../../shared/contracts/statuses.ts";

export function toDomain(record: PrismaAgent): Agent {
  return {
    agentId: record.agentId as EntityId<"agentId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    name: record.name,
    role: record.role,
    model: record.model,
    instructions: record.instructions,
    status: record.status as AgentStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toPrismaCreate(agent: Agent): {
  agentId: string;
  workspaceId: string;
  name: string;
  role: string;
  model: string;
  instructions: string;
  status: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    agentId: agent.agentId,
    workspaceId: agent.workspaceId,
    name: agent.name,
    role: agent.role,
    model: agent.model,
    instructions: agent.instructions,
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}
