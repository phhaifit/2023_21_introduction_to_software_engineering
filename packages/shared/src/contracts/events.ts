import type { EntityId } from "./ids";
import type {
  KnowledgeDataSourceStatus,
  KnowledgeSyncJobStatus,
  UploadValidationStatus
} from "./knowledge-base-rag.ts";
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
  "workflow.step_started",
  "workflow.step_completed",
  "workflow.step_failed",
  "task.submitted",
  "task.completed",
  "knowledge.document_uploaded",
  "knowledge.index_ready",
  "knowledge.document.uploadValidated",
  "knowledge.document.ingestionQueued",
  "knowledge.document.ingestionStarted",
  "knowledge.document.ingestionCompleted",
  "knowledge.document.ingestionFailed",
  "knowledge.dataSource.connected",
  "knowledge.dataSource.connectionFailed",
  "knowledge.sync.scopeUpdated",
  "knowledge.sync.requested",
  "knowledge.sync.started",
  "knowledge.sync.completed",
  "knowledge.sync.failed"
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
    executionId: EntityId<"executionId">;
  };
  "workflow.execution_completed": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: EntityId<"executionId">;
  };
  "workflow.execution_failed": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: EntityId<"executionId">;
    errorMsg: string;
  };
  "workflow.step_started": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: EntityId<"executionId">;
    workflowStepId: EntityId<"workflowStepId">;
    stepOrder: number;
    agentId?: string;
  };
  "workflow.step_completed": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: EntityId<"executionId">;
    workflowStepId: EntityId<"workflowStepId">;
    stepOrder: number;
    agentId?: string;
    outputData?: any;
  };
  "workflow.step_failed": {
    workspaceId: EntityId<"workspaceId">;
    workflowId: EntityId<"workflowId">;
    executionId: EntityId<"executionId">;
    workflowStepId: EntityId<"workflowStepId">;
    stepOrder: number;
    agentId?: string;
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
  "knowledge.document.uploadValidated": {
    eventType: "knowledge.document.uploadValidated";
    workspaceId: EntityId<"workspaceId">;
    actorId: EntityId<"userId">;
    status: UploadValidationStatus;
    acceptedCount: number;
    rejectedCount: number;
  };
  "knowledge.document.ingestionQueued": {
    eventType: "knowledge.document.ingestionQueued";
    workspaceId: EntityId<"workspaceId">;
    actorId?: EntityId<"userId">;
    documentId: EntityId<"documentId">;
    jobId: EntityId<"jobId">;
    status: KnowledgeIndexStatus;
  };
  "knowledge.document.ingestionStarted": {
    eventType: "knowledge.document.ingestionStarted";
    workspaceId: EntityId<"workspaceId">;
    documentId: EntityId<"documentId">;
    jobId: EntityId<"jobId">;
    status: KnowledgeIndexStatus;
  };
  "knowledge.document.ingestionCompleted": {
    eventType: "knowledge.document.ingestionCompleted";
    workspaceId: EntityId<"workspaceId">;
    documentId: EntityId<"documentId">;
    jobId: EntityId<"jobId">;
    status: KnowledgeIndexStatus;
    chunkCount: number;
    indexedChunkCount: number;
  };
  "knowledge.document.ingestionFailed": {
    eventType: "knowledge.document.ingestionFailed";
    workspaceId: EntityId<"workspaceId">;
    documentId: EntityId<"documentId">;
    jobId: EntityId<"jobId">;
    status: KnowledgeIndexStatus;
    errorCode: string;
    errorMessage: string;
  };
  "knowledge.dataSource.connected": {
    eventType: "knowledge.dataSource.connected";
    workspaceId: EntityId<"workspaceId">;
    actorId: EntityId<"userId">;
    sourceId: string;
    status: KnowledgeDataSourceStatus;
  };
  "knowledge.dataSource.connectionFailed": {
    eventType: "knowledge.dataSource.connectionFailed";
    workspaceId: EntityId<"workspaceId">;
    actorId: EntityId<"userId">;
    sourceId: string;
    status: KnowledgeDataSourceStatus;
    errorCode: string;
    errorMessage: string;
  };
  "knowledge.sync.scopeUpdated": {
    eventType: "knowledge.sync.scopeUpdated";
    workspaceId: EntityId<"workspaceId">;
    actorId: EntityId<"userId">;
    sourceId: string;
    selectedScopeNodeCount: number;
  };
  "knowledge.sync.requested": {
    eventType: "knowledge.sync.requested";
    workspaceId: EntityId<"workspaceId">;
    actorId: EntityId<"userId">;
    jobId: EntityId<"jobId">;
    sourceId?: string;
    status: KnowledgeSyncJobStatus;
  };
  "knowledge.sync.started": {
    eventType: "knowledge.sync.started";
    workspaceId: EntityId<"workspaceId">;
    jobId: EntityId<"jobId">;
    sourceId?: string;
    status: KnowledgeSyncJobStatus;
  };
  "knowledge.sync.completed": {
    eventType: "knowledge.sync.completed";
    workspaceId: EntityId<"workspaceId">;
    jobId: EntityId<"jobId">;
    sourceId?: string;
    status: KnowledgeSyncJobStatus;
    scannedItemCount: number;
    changedItemCount: number;
  };
  "knowledge.sync.failed": {
    eventType: "knowledge.sync.failed";
    workspaceId: EntityId<"workspaceId">;
    jobId: EntityId<"jobId">;
    sourceId?: string;
    status: KnowledgeSyncJobStatus;
    errorCode: string;
    errorMessage: string;
  };
};

export type DomainEvent<Name extends DomainEventName = DomainEventName> =
  Name extends DomainEventName
    ? BaseDomainEvent<Name, DomainEventPayloads[Name]>
    : never;
