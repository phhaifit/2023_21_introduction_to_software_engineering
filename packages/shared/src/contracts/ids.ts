export const ENTITY_ID_KINDS = [
  "userId",
  "sessionId",
  "workspaceId",
  "memberId",
  "agentId",
  "toolId",
  "workflowId",
  "taskId",
  "workId",
  "documentId",
  "subscriptionId",
  "transactionId",
  "eventId",
  "jobId",
  "executionId",
  "workflowStepId",
  "conversationId",
  "logId"
] as const;

export type EntityIdKind = (typeof ENTITY_ID_KINDS)[number];

export type EntityId<K extends EntityIdKind = EntityIdKind> = string & {
  readonly __entityIdKind: K;
};

export type EntityRef<K extends EntityIdKind = EntityIdKind> = {
  kind: K;
  id: EntityId<K>;
};

export type WorkspaceScopedRef<K extends EntityIdKind = EntityIdKind> = {
  workspaceId: EntityId<"workspaceId">;
  ref: EntityRef<K>;
};
