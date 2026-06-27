export const WORKSPACE_STATUSES = [
  "provisioning",
  "active",
  "failed",
  "deleting",
  "delete_failed",
  "deleted"
] as const;

export const AGENT_STATUSES = ["enabled", "disabled", "deleted"] as const;

export const TASK_STATUSES = [
  "queued",
  "running",
  "requires_action",
  "succeeded",
  "failed",
  "cancelled"
] as const;

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "active",
  "expiring_soon",
  "expired",
  "cancelled"
] as const;

export const WORKFLOW_STATUSES = ["draft", "published", "archived"] as const;

export const KNOWLEDGE_INDEX_STATUSES = [
  "pending",
  "ingesting",
  "ready",
  "failed"
] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type KnowledgeIndexStatus = (typeof KNOWLEDGE_INDEX_STATUSES)[number];
