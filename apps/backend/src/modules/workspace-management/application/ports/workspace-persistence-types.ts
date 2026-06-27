import type {
  RuntimeFinalityProof,
  WorkspaceExecutionPhase,
  WorkspaceLifecycleStatus,
  WorkspaceOperationFamily,
  WorkspaceOperationStatus
} from "../../domain/workspace-types.ts";
import type { WorkspaceSafeFailure } from "../../domain/workspace-failure.ts";
import type { WorkspaceCommandType } from "../../domain/workspace-command-idempotency.ts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type WorkspaceKeysetCursor = {
  readonly updatedAt: string;
  readonly workspaceId: string;
};

export type WorkspaceVisibilityCursor = {
  readonly projectionUpdatedAt: string;
  readonly workspaceId: string;
};

export type WorkspacePersistenceClient = {
  readonly workspace: WorkspaceModelDelegate;
  readonly workspaceProvisioningOperation: WorkspaceOperationModelDelegate;
  readonly outboxMessage: OutboxMessageModelDelegate;
  readonly workspaceCommandReceipt: WorkspaceCommandReceiptModelDelegate;
  readonly workspaceVisibilityProjection: WorkspaceVisibilityProjectionModelDelegate;
};

export type WorkspaceReadContext = WorkspacePersistenceClient;
export type WorkspaceTransaction = WorkspacePersistenceClient;

export type WorkspaceModelDelegate = {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args: unknown): Promise<unknown | null>;
  findMany(args: unknown): Promise<unknown[]>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

export type WorkspaceOperationModelDelegate = {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args: unknown): Promise<unknown | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

export type OutboxMessageModelDelegate = {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args: unknown): Promise<unknown | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

export type WorkspaceCommandReceiptModelDelegate = {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args: unknown): Promise<unknown | null>;
  findMany(args: unknown): Promise<unknown[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
};

export type WorkspaceVisibilityProjectionModelDelegate = {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown | null>;
  findMany(args: unknown): Promise<unknown[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
};


export type WorkspacePersistenceRecord = {
  readonly workspaceId: string;
  readonly userId: string;
  readonly createdByUserId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly status: WorkspaceLifecycleStatus;
  readonly lifecycleVersion: number;
  readonly eventSequence: number;
  readonly ownerBootstrapState: string;
  readonly ownerBootstrapAttemptId: string | null;
  readonly ownerBootstrapAttemptVersion: number;
  readonly ownerBootstrapRequestedAt: string | null;
  readonly ownerBootstrapExpiresAt: string | null;
  readonly ownerMembershipEstablishedAt: string | null;
  readonly ownerBootstrapFailureCode: string | null;
  readonly ownerBootstrapFailureMessage: string | null;
  readonly requestedProfile: "standard" | "premium" | null;
  readonly resolvedProvisioningProfile: JsonValue | null;
  readonly provisioningProfileSource: string;
  readonly migrationOrigin: string;
  readonly runtimeVerificationState: string;
  readonly provider: string | null;
  readonly runtimeRef: string | null;
  readonly runtimeUrl: string | null;
  readonly provisioningRequestedAt: string | null;
  readonly provisionedAt: string | null;
  readonly deletionRequestedAt: string | null;
  readonly deletedAt: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateWorkspacePersistenceInput = Omit<
  WorkspacePersistenceRecord,
  | "lifecycleVersion"
  | "eventSequence"
  | "ownerBootstrapState"
  | "ownerBootstrapAttemptVersion"
  | "provisioningProfileSource"
  | "migrationOrigin"
  | "runtimeVerificationState"
> & {
  readonly lifecycleVersion?: number;
  readonly eventSequence?: number;
  readonly ownerBootstrapState?: string;
  readonly ownerBootstrapAttemptVersion?: number;
  readonly provisioningProfileSource?: string;
  readonly migrationOrigin?: string;
  readonly runtimeVerificationState?: string;
};

export type WorkspaceLifecyclePatch = Partial<
  Pick<
    WorkspacePersistenceRecord,
    | "runtimeVerificationState"
    | "provider"
    | "runtimeRef"
    | "runtimeUrl"
    | "provisioningRequestedAt"
    | "provisionedAt"
    | "deletionRequestedAt"
    | "deletedAt"
    | "failureCode"
    | "failureMessage"
    | "updatedAt"
  >
>;

export type WorkspaceOperationRecord = {
  readonly operationId: string;
  readonly workspaceId: string;
  readonly operationType: "provision" | "deprovision";
  readonly operationFamily: WorkspaceOperationFamily;
  readonly status: WorkspaceOperationStatus;
  readonly executionPhase: WorkspaceExecutionPhase;
  readonly requestFingerprint: string;
  readonly idempotencyKeyHash: string | null;
  readonly provider: string | null;
  readonly providerRequestKey: string;
  readonly runtimeRef: string | null;
  readonly runtimeFinalityProof: RuntimeFinalityProof;
  readonly dependsOnOperationId: string | null;
  readonly supersedesOperationId: string | null;
  readonly cancellationRequestedAt: string | null;
  readonly claimedByWorkerId: string | null;
  readonly leaseToken: string | null;
  readonly leaseExpiresAt: string | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorMessage: string | null;
  readonly unknownOutcomeAt: string | null;
  readonly reconciliationRequiredAt: string | null;
  readonly completedAt: string | null;
  readonly failedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
};

export type CreateWorkspaceOperationInput = Omit<
  WorkspaceOperationRecord,
  | "status"
  | "executionPhase"
  | "runtimeFinalityProof"
  | "attemptCount"
  | "maxAttempts"
  | "version"
> & {
  readonly status?: WorkspaceOperationStatus;
  readonly executionPhase?: WorkspaceExecutionPhase;
  readonly runtimeFinalityProof?: RuntimeFinalityProof;
  readonly attemptCount?: number;
  readonly maxAttempts?: number;
  readonly version?: number;
};

export type WorkspaceOperationCompletionPatch = Partial<
  Pick<
    WorkspaceOperationRecord,
    | "provider"
    | "runtimeRef"
    | "runtimeFinalityProof"
    | "unknownOutcomeAt"
    | "reconciliationRequiredAt"
    | "lastErrorCode"
    | "lastErrorMessage"
  >
>;

export type OutboxMessageRecord = {
  readonly outboxMessageId: string;
  readonly eventId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly eventSequence: number;
  readonly lifecycleVersion: number | null;
  readonly payload: JsonValue;
  readonly status: "pending" | "publishing" | "published" | "retry_scheduled" | "dead_lettered";
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly publishedAt: string | null;
  readonly deadLetteredAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorMessage: string | null;
  readonly leaseToken: string | null;
  readonly leaseExpiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
};

export type CreateOutboxMessageInput = Omit<
  OutboxMessageRecord,
  | "status"
  | "attemptCount"
  | "maxAttempts"
  | "publishedAt"
  | "deadLetteredAt"
  | "version"
> & {
  readonly status?: OutboxMessageRecord["status"];
  readonly attemptCount?: number;
  readonly maxAttempts?: number;
  readonly publishedAt?: string | null;
  readonly deadLetteredAt?: string | null;
  readonly version?: number;
};

export type WorkspaceCommandReceiptRecord = {
  readonly commandReceiptId: string;
  readonly actorUserId: string;
  readonly commandType: WorkspaceCommandType;
  readonly commandTarget: string;
  readonly workspaceId: string;
  readonly idempotencyKeyHash: string;
  readonly requestFingerprint: string;
  readonly responseStatusCode: number | null;
  readonly responseBody: JsonValue | null;
  readonly responseHeaders: JsonValue | null;
  readonly operationId: string | null;
  readonly status: "pending" | "completed";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly completedAt: string | null;
};

export type CreateWorkspaceCommandReceiptInput = Omit<
  WorkspaceCommandReceiptRecord,
  "responseStatusCode" | "responseBody" | "responseHeaders" | "operationId" | "status" | "completedAt"
> & {
  readonly responseStatusCode?: number | null;
  readonly responseBody?: JsonValue | null;
  readonly responseHeaders?: JsonValue | null;
  readonly operationId?: string | null;
  readonly status?: WorkspaceCommandReceiptRecord["status"];
  readonly completedAt?: string | null;
};

export type WorkspaceVisibilityProjectionRecord = {
  readonly projectionId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly canRead: boolean;
  readonly canDelete: boolean;
  readonly membershipVersion: number;
  readonly projectionUpdatedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WorkspaceProjectionCandidatePage = {
  readonly workspaceIds: readonly string[];
  readonly nextCursor: WorkspaceVisibilityCursor | null;
};


export type WorkspaceFailurePatch = {
  readonly lastErrorCode: string;
  readonly lastErrorMessage: string;
};

export function safeFailurePatch(failure: WorkspaceSafeFailure): WorkspaceFailurePatch {
  return {
    lastErrorCode: failure.code,
    lastErrorMessage: failure.message
  };
}
