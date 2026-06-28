import type { Agent as PrismaAgent } from "@vcp/database";
import type { Agent } from "../domain/agent.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";
import { normalizeAgentRuntimeConfiguration } from "../domain/agent.ts";

export function toDomain(record: PrismaAgent): Agent {
  return {
    agentId: record.agentId as EntityId<"agentId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    name: record.name,
    role: record.role,
    model: record.model,
    instructions: record.instructions,
    runtimeConfiguration: normalizeAgentRuntimeConfiguration(readRuntimeConfig(record)),
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
  runtimeConfig: unknown;
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
    runtimeConfig: agent.runtimeConfiguration,
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

function readRuntimeConfig(record: PrismaAgent): Record<string, unknown> | undefined {
  const runtimeConfig = (record as { runtimeConfig?: unknown }).runtimeConfig;
  return runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig)
    ? (runtimeConfig as Record<string, unknown>)
    : undefined;
}
