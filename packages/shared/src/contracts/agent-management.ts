import type { EntityId } from "./ids.ts";
import type { AgentStatus } from "./statuses.ts";

export const AGENT_PUBLIC_SUMMARY_FIELDS = [
  "agentId",
  "workspaceId",
  "name",
  "role",
  "model",
  "status",
  "updatedAt"
] as const;

export const SELECTABLE_AGENT_STATUSES = ["enabled"] as const;

export type SelectableAgentStatus = (typeof SELECTABLE_AGENT_STATUSES)[number];

export type AgentPublicSummary = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  status: AgentStatus;
  updatedAt: string;
};
