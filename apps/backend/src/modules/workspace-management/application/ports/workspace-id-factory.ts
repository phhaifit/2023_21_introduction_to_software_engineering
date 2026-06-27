export interface WorkspaceIdFactory {
  nextWorkspaceId(): string;
  nextOperationId(): string;
  nextOutboxMessageId(): string;
  nextCommandReceiptId(): string;
  nextEventId(): string;
  nextBootstrapAttemptId(): string;
  nextCorrelationId(): string;
}
