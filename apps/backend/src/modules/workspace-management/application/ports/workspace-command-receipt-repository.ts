import type { WorkspaceCommandType } from "../../domain/workspace-command-idempotency.ts";
import type {
  CreateWorkspaceCommandReceiptInput,
  JsonValue,
  WorkspaceCommandReceiptRecord,
  WorkspaceReadContext,
  WorkspaceTransaction
} from "./workspace-persistence-types.ts";

export interface WorkspaceCommandReceiptRepository {
  findByScope(input: {
    actorUserId: string;
    commandType: WorkspaceCommandType;
    commandTarget: string;
    idempotencyKey: string;
    tx?: WorkspaceReadContext;
  }): Promise<WorkspaceCommandReceiptRecord | null>;

  create(
    input: CreateWorkspaceCommandReceiptInput,
    tx: WorkspaceTransaction
  ): Promise<WorkspaceCommandReceiptRecord>;

  attachOperation(input: {
    commandReceiptId: string;
    operationId: string;
    expectedVersion: number;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceCommandReceiptRecord | null>;

  completeResponse(input: {
    commandReceiptId: string;
    expectedVersion: number;
    responseStatusCode: number;
    safeResponsePayloadJson: JsonValue;
    completedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceCommandReceiptRecord | null>;

  deleteExpired(input: {
    now: string;
    limit: number;
    tx: WorkspaceTransaction;
  }): Promise<number>;
}
