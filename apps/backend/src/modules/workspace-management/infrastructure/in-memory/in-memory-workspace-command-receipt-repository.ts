import type { WorkspaceCommandType } from "../../domain/workspace-command-idempotency.ts";
import type {
  CreateWorkspaceCommandReceiptInput,
  JsonValue,
  WorkspaceCommandReceiptRecord,
  WorkspaceTransaction
} from "../../application/ports/workspace-persistence-types.ts";
import type { WorkspaceCommandReceiptRepository } from "../../application/ports/workspace-command-receipt-repository.ts";

export class InMemoryWorkspaceCommandReceiptRepository
  implements WorkspaceCommandReceiptRepository
{
  readonly records: WorkspaceCommandReceiptRecord[] = [];

  async findByScope(input: {
    actorUserId: string;
    commandType: WorkspaceCommandType;
    commandTarget: string;
    idempotencyKey: string;
    tx?: WorkspaceTransaction;
  }): Promise<WorkspaceCommandReceiptRecord | null> {
    return (
      this.records.find(
        (r) =>
          r.actorUserId === input.actorUserId &&
          r.commandType === input.commandType &&
          r.commandTarget === input.commandTarget &&
          r.idempotencyKeyHash === input.idempotencyKey
      ) ?? null
    );
  }

  async create(
    input: CreateWorkspaceCommandReceiptInput,
    _tx: WorkspaceTransaction
  ): Promise<WorkspaceCommandReceiptRecord> {
    const record: WorkspaceCommandReceiptRecord = {
      responseStatusCode: null,
      responseBody: null,
      responseHeaders: null,
      operationId: null,
      status: "pending",
      completedAt: null,
      ...input
    } as WorkspaceCommandReceiptRecord;
    this.records.push(record);
    return record;
  }

  async attachOperation(input: {
    commandReceiptId: string;
    operationId: string;
    expectedVersion: number;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceCommandReceiptRecord | null> {
    const index = this.records.findIndex((r) => r.commandReceiptId === input.commandReceiptId);
    if (index < 0) return null;
    const next = {
      ...(this.records[index] as WorkspaceCommandReceiptRecord),
      operationId: input.operationId
    };
    this.records[index] = next;
    return next;
  }

  async completeResponse(input: {
    commandReceiptId: string;
    expectedVersion: number;
    responseStatusCode: number;
    safeResponsePayloadJson: JsonValue;
    completedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceCommandReceiptRecord | null> {
    const index = this.records.findIndex((r) => r.commandReceiptId === input.commandReceiptId);
    if (index < 0) return null;
    const next: WorkspaceCommandReceiptRecord = {
      ...(this.records[index] as WorkspaceCommandReceiptRecord),
      status: "completed",
      responseStatusCode: input.responseStatusCode,
      responseBody: input.safeResponsePayloadJson,
      completedAt: input.completedAt
    };
    this.records[index] = next;
    return next;
  }

  async deleteExpired(input: {
    now: string;
    limit: number;
    tx: WorkspaceTransaction;
  }): Promise<number> {
    const expired = this.records
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.expiresAt <= input.now)
      .slice(0, input.limit);
    for (const { i } of expired.reverse()) {
      this.records.splice(i, 1);
    }
    return expired.length;
  }
}
