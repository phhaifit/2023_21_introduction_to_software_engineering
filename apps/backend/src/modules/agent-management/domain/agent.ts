import type {
  AgentPublicSummary,
  AgentRuntimeConfiguration
} from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";

export type Agent = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  instructions: string;
  status: AgentStatus;
  runtimeConfiguration: AgentRuntimeConfiguration;
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
  responsibilities?: string[];
  operatingContext?: string;
  requestedTools?: AgentRuntimeConfiguration["requestedTools"];
  requestedKnowledge?: AgentRuntimeConfiguration["requestedKnowledge"];
  constraints?: string[];
  escalationRules?: string[];
  exampleTasks?: string[];
  runtimeConfiguration?: Partial<AgentRuntimeConfiguration>;
  createdAt: string;
  updatedAt: string;
  status?: AgentStatus;
};

export function createAgent(draft: AgentDraft): Agent {
  const runtimeConfiguration = normalizeAgentRuntimeConfiguration({
    ...draft.runtimeConfiguration,
    responsibilities: draft.responsibilities ?? draft.runtimeConfiguration?.responsibilities,
    operatingContext: draft.operatingContext ?? draft.runtimeConfiguration?.operatingContext,
    requestedTools: draft.requestedTools ?? draft.runtimeConfiguration?.requestedTools,
    requestedKnowledge: draft.requestedKnowledge ?? draft.runtimeConfiguration?.requestedKnowledge,
    constraints: draft.constraints ?? draft.runtimeConfiguration?.constraints,
    escalationRules: draft.escalationRules ?? draft.runtimeConfiguration?.escalationRules,
    exampleTasks: draft.exampleTasks ?? draft.runtimeConfiguration?.exampleTasks
  });

  return {
    ...draft,
    runtimeConfiguration,
    status: draft.status ?? "enabled"
  };
}

export function normalizeAgentRuntimeConfiguration(
  input: Partial<AgentRuntimeConfiguration> | Record<string, unknown> | undefined
): AgentRuntimeConfiguration {
  return {
    responsibilities: normalizeStringList(input?.responsibilities),
    operatingContext: normalizeOptionalString(input?.operatingContext),
    requestedTools: normalizeToolReferences(input?.requestedTools),
    requestedKnowledge: normalizeKnowledgeReferences(input?.requestedKnowledge),
    constraints: normalizeStringList(input?.constraints),
    escalationRules: normalizeStringList(input?.escalationRules),
    exampleTasks: normalizeStringList(input?.exampleTasks)
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

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOptionalString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

function normalizeToolReferences(values: unknown): AgentRuntimeConfiguration["requestedTools"] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter(
      (tool): tool is { toolId?: unknown; name: string; reason?: unknown } =>
        typeof tool === "object" &&
        tool !== null &&
        "name" in tool &&
        typeof (tool as { name?: unknown }).name === "string"
    )
    .map((tool) => ({
      ...(typeof tool.toolId === "string" ? { toolId: tool.toolId } : {}),
      name: tool.name.trim(),
      ...(typeof tool.reason === "string" && tool.reason.trim()
        ? { reason: tool.reason.trim() }
        : {})
    }))
    .filter((tool) => tool.name);
}

function normalizeKnowledgeReferences(
  values: unknown
): AgentRuntimeConfiguration["requestedKnowledge"] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter(
      (document): document is { documentId?: unknown; title: string; reason?: unknown } =>
        typeof document === "object" &&
        document !== null &&
        "title" in document &&
        typeof (document as { title?: unknown }).title === "string"
    )
    .map((document) => ({
      ...(typeof document.documentId === "string" ? { documentId: document.documentId } : {}),
      title: document.title.trim(),
      ...(typeof document.reason === "string" && document.reason.trim()
        ? { reason: document.reason.trim() }
        : {})
    }))
    .filter((document) => document.title);
}
