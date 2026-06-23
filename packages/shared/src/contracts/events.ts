import type { EntityId } from "./ids";
import type { SubscriptionPlan } from "./plans";
import type { WorkspaceRole } from "./roles";
import type {
  AgentStatus,
  KnowledgeIndexStatus,
  TaskStatus,
  WorkspaceStatus
} from "./statuses";

export const DOMAIN_EVENTS = [
  "subscription.activated",
  "subscription.upgraded",
  "workspace.provisioning_requested",
  "workspace.running",
  "workspace.deleted",
  "member.invited",
  "agent.created",
  "agent.updated",
  "tool.connected",
  "workflow.published",
  "workflow.created",
  "workflow.execution_started",
  "workflow.execution_completed",
  "workflow.execution_failed",
  "task.submitted",
  "task.completed",
  "knowledge.document_uploaded",
  "knowledge.index_ready"
] as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[number];

export type BaseDomainEvent<Name extends DomainEventName, Payload> = {
  name: Name;
  eventId: EntityId<"eventId">;
  occurredAt: string;
  payload: Payload;
};

export type DomainEventPayloads = {
  "subscription.activated": {
    userId: EntityId<"userId">;
    subscriptionId: EntityId<"subscriptionId">;
    plan: SubscriptionPlan;
  };
  "subscription.upgraded": {
    userId: EntityId<"userId">;
    subscriptionId: EntityId<"subscriptionId">;
    fromPlan: SubscriptionPlan;
    toPlan: SubscriptionPlan;
  };
  "workspace.provisioning_requested": {
    workspaceId: EntityId<"workspaceId">;
    subscriptionId: EntityId<"subscriptionId">;
    plan: SubscriptionPlan;
  };
  "workspace.running": {
    workspaceId: EntityId<"workspaceId">;
    status: WorkspaceStatus;
    runtimeUrl?: string;
  };
  "workspace.deleted": {
    workspaceId: EntityId<"workspaceId">;
    deletedBy: EntityId<"userId">;
  };
  "member.invited": {
    workspaceId: EntityId<"workspaceId">;
    email: string;
    role: WorkspaceRole;
  };
  "agent.created": {
    workspaceId: EntityId<"workspaceId">;
    agentId: EntityId<"agentId">;
    status: AgentStatus;
  };
  "agent.updated": {
    workspaceId: EntityId<"workspaceId">;
    agentId: EntityId<"agentId">;
    status: AgentStatus;
  };
  "tool.connected": {
    workspaceId: EntityId<"workspaceId">;
    toolId: EntityId<"toolId">;
    provider: string;
  };
  "workflow.published": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
  };
  "workflow.created": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
  };
  "workflow.execution_started": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: string;
  };
  "workflow.execution_completed": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: string;
  };
  "workflow.execution_failed": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: string;
    errorMsg: string;
  };
  "task.submitted": {
    workspaceId: EntityId<"workspaceId">;
    taskId: EntityId<"taskId">;
    submittedBy: EntityId<"userId">;
  };
  "task.completed": {
    workspaceId: EntityId<"workspaceId">;
    taskId: EntityId<"taskId">;
    status: TaskStatus;
  };
  "knowledge.document_uploaded": {
    workspaceId: EntityId<"workspaceId">;
    documentId: EntityId<"documentId">;
    uploadedBy: EntityId<"userId">;
  };
  "knowledge.index_ready": {
    workspaceId: EntityId<"workspaceId">;
    documentId: EntityId<"documentId">;
    status: KnowledgeIndexStatus;
  };
};

export type DomainEvent<Name extends DomainEventName = DomainEventName> =
  Name extends DomainEventName
    ? BaseDomainEvent<Name, DomainEventPayloads[Name]>
    : never;
