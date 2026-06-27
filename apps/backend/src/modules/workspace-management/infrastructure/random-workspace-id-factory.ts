import { randomUUID } from "node:crypto";
import type { WorkspaceIdFactory } from "../application/ports/workspace-id-factory.ts";

export class RandomWorkspaceIdFactory implements WorkspaceIdFactory {
  nextWorkspaceId(): string { return randomUUID(); }
  nextOperationId(): string { return randomUUID(); }
  nextOutboxMessageId(): string { return randomUUID(); }
  nextCommandReceiptId(): string { return randomUUID(); }
  nextEventId(): string { return randomUUID(); }
  nextBootstrapAttemptId(): string { return randomUUID(); }
  nextCorrelationId(): string { return randomUUID(); }
}
