import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = join(root, "packages/database/prisma/schema.prisma");
const migrationPath = join(
  root,
  "packages/database/prisma/migrations/20260626090000_add_workspace_management_phase1_foundation/migration.sql"
);
const preflightPath = join(
  root,
  "packages/database/prisma/preflight/workspace_management_phase1_preflight.sql"
);
const databaseExportsPath = join(root, "packages/database/src/index.ts");
const workspaceSharedContractPath = join(
  root,
  "packages/shared/src/contracts/workspace-management.ts"
);
const sharedStatusesPath = join(root, "packages/shared/src/contracts/statuses.ts");
const sharedSchemaPath = join(root, "packages/shared/src/contracts/schema.json");
const sharedApiPath = join(root, "packages/shared/src/contracts/api.ts");
const workspaceHttpErrorsPath = join(
  root,
  "apps/backend/src/modules/workspace-management/interface/http/workspace-http-errors.ts"
);
const workspaceResponseMapperPath = join(
  root,
  "apps/backend/src/modules/workspace-management/interface/http/workspace-response-mapper.ts"
);
const workspaceBackendDir = join(root, "apps/backend/src/modules/workspace-management");
const workspaceFrontendDir = join(root, "apps/frontend/src/features/workspace-management");
const sharedContractsDir = join(root, "packages/shared/src/contracts");
const workspacePersistenceDir = join(
  root,
  "apps/backend/src/modules/workspace-management/infrastructure/persistence"
);
const workspaceEventFactoryPath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/services/workspace-event-factory.ts"
);
const createWorkspaceUseCasePath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/use-cases/create-workspace.ts"
);
const deleteWorkspaceUseCasePath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/use-cases/delete-workspace.ts"
);
const processWorkspaceOperationPath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/use-cases/process-workspace-operation.ts"
);
const listWorkspacesUseCasePath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/use-cases/list-workspaces.ts"
);
const getWorkspaceDetailUseCasePath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/use-cases/get-workspace-detail.ts"
);
const workspaceCommandReceiptRepositoryPath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/ports/workspace-command-receipt-repository.ts"
);
const prismaCommandReceiptRepositoryPath = join(
  root,
  "apps/backend/src/modules/workspace-management/infrastructure/persistence/prisma-workspace-command-receipt-repository.ts"
);
const workspacePersistenceErrorsPath = join(
  root,
  "apps/backend/src/modules/workspace-management/infrastructure/persistence/workspace-persistence-errors.ts"
);
const workspacePersistenceTypesPath = join(
  root,
  "apps/backend/src/modules/workspace-management/application/ports/workspace-persistence-types.ts"
);

assert.ok(existsSync(schemaPath), "Prisma schema must exist");
assert.ok(existsSync(migrationPath), "Workspace Management migration must exist");
assert.ok(existsSync(preflightPath), "Workspace Management preflight SQL must exist");

const schema = readFileSync(schemaPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const databaseExports = readFileSync(databaseExportsPath, "utf8");
const workspaceSharedContract = readFileSync(workspaceSharedContractPath, "utf8");
const sharedStatuses = readFileSync(sharedStatusesPath, "utf8");
const sharedSchema = JSON.parse(readFileSync(sharedSchemaPath, "utf8"));
const sharedApi = readFileSync(sharedApiPath, "utf8");
const workspaceHttpErrors = readFileSync(workspaceHttpErrorsPath, "utf8");
const workspaceResponseMapper = readFileSync(workspaceResponseMapperPath, "utf8");
const workspaceEventFactory = readFileSync(workspaceEventFactoryPath, "utf8");
const createWorkspaceUseCase = readFileSync(createWorkspaceUseCasePath, "utf8");
const deleteWorkspaceUseCase = readFileSync(deleteWorkspaceUseCasePath, "utf8");
const processWorkspaceOperation = readFileSync(processWorkspaceOperationPath, "utf8");
const listWorkspacesUseCase = readFileSync(listWorkspacesUseCasePath, "utf8");
const getWorkspaceDetailUseCase = readFileSync(getWorkspaceDetailUseCasePath, "utf8");
const workspaceCommandReceiptRepository = readFileSync(
  workspaceCommandReceiptRepositoryPath,
  "utf8"
);
const prismaCommandReceiptRepository = readFileSync(
  prismaCommandReceiptRepositoryPath,
  "utf8"
);
const workspacePersistenceErrors = readFileSync(workspacePersistenceErrorsPath, "utf8");
const workspacePersistenceTypes = readFileSync(workspacePersistenceTypesPath, "utf8");
const models = parseModels(schema);

const workspace = requireModel("Workspace");
const operation = requireModel("WorkspaceProvisioningOperation");
const outbox = requireModel("OutboxMessage");
const receipt = requireModel("WorkspaceCommandReceipt");
const projection = requireModel("WorkspaceVisibilityProjection");
const processedEvent = requireModel("ProcessedDomainEvent");

requireFields("Workspace", workspace, {
  workspaceId: "String",
  userId: "String",
  createdByUserId: "String",
  name: "String",
  normalizedName: "String",
  status: "String",
  lifecycleVersion: "Int",
  eventSequence: "Int",
  ownerBootstrapState: "String",
  ownerBootstrapAttemptId: "String?",
  ownerBootstrapAttemptVersion: "Int",
  ownerBootstrapRequestedAt: "String?",
  ownerBootstrapExpiresAt: "String?",
  ownerMembershipEstablishedAt: "String?",
  ownerBootstrapFailureCode: "String?",
  ownerBootstrapFailureMessage: "String?",
  requestedProfile: "String?",
  resolvedProvisioningProfile: "Json?",
  provisioningProfileSource: "String",
  migrationOrigin: "String",
  runtimeVerificationState: "String",
  provider: "String?",
  runtimeRef: "String?",
  runtimeUrl: "String?",
  provisioningRequestedAt: "String?",
  provisionedAt: "String?",
  deletionRequestedAt: "String?",
  deletedAt: "String?",
  failureCode: "String?",
  failureMessage: "String?"
});

assert.match(workspace.fields.get("status").line, /@default\("provisioning"\)/);
assert.match(workspace.fields.get("ownerBootstrapState").line, /@default\("not_applicable"\)/);
assert.match(workspace.fields.get("provisioningProfileSource").line, /@default\("legacy_unknown"\)/);
assert.match(workspace.fields.get("migrationOrigin").line, /@default\("legacy_import"\)/);
assert.match(workspace.fields.get("runtimeVerificationState").line, /@default\("unknown"\)/);
requireIndex("Workspace", workspace, ["status", "updatedAt", "workspaceId"]);
requireIndex("Workspace", workspace, [
  "createdByUserId",
  "ownerBootstrapState",
  "ownerBootstrapExpiresAt",
  "updatedAt",
  "workspaceId"
]);
assert.doesNotMatch(workspace.body, /createIdempotencyKey|createRequestFingerprint/);

requireFields("WorkspaceProvisioningOperation", operation, {
  operationId: "String",
  workspaceId: "String",
  operationType: "String",
  operationFamily: "String",
  status: "String",
  executionPhase: "String",
  requestFingerprint: "String",
  idempotencyKeyHash: "String?",
  providerRequestKey: "String",
  runtimeFinalityProof: "String",
  dependsOnOperationId: "String?",
  supersedesOperationId: "String?",
  leaseToken: "String?",
  attemptCount: "Int",
  maxAttempts: "Int",
  nextAttemptAt: "String?",
  unknownOutcomeAt: "String?",
  reconciliationRequiredAt: "String?",
  version: "Int"
});
requireUnique("WorkspaceProvisioningOperation", operation, ["providerRequestKey"]);
requireIndex("WorkspaceProvisioningOperation", operation, ["workspaceId", "operationFamily", "status"]);
requireIndex("WorkspaceProvisioningOperation", operation, ["status", "nextAttemptAt", "leaseExpiresAt"]);

requireFields("OutboxMessage", outbox, {
  outboxMessageId: "String",
  eventId: "String",
  aggregateType: "String",
  aggregateId: "String",
  eventType: "String",
  eventVersion: "Int",
  eventSequence: "Int",
  lifecycleVersion: "Int?",
  payload: "Json",
  status: "String",
  leaseToken: "String?",
  leaseExpiresAt: "String?",
  deadLetteredAt: "String?",
  version: "Int"
});
requireUnique("OutboxMessage", outbox, ["eventId"]);
requireUnique("OutboxMessage", outbox, ["aggregateType", "aggregateId", "eventSequence"]);

requireFields("WorkspaceCommandReceipt", receipt, {
  commandReceiptId: "String",
  actorUserId: "String",
  commandType: "String",
  commandTarget: "String",
  workspaceId: "String",
  idempotencyKeyHash: "String",
  requestFingerprint: "String",
  responseStatusCode: "Int?",
  responseBody: "Json?",
  responseHeaders: "Json?",
  operationId: "String?",
  status: "String",
  expiresAt: "String",
  completedAt: "String?"
});
requireUnique("WorkspaceCommandReceipt", receipt, [
  "actorUserId",
  "commandType",
  "commandTarget",
  "idempotencyKeyHash"
]);
requireIndex("WorkspaceCommandReceipt", receipt, ["operationId"]);
requireIndex("WorkspaceCommandReceipt", receipt, ["expiresAt"]);

requireFields("WorkspaceVisibilityProjection", projection, {
  projectionId: "String",
  userId: "String",
  workspaceId: "String",
  canRead: "Boolean",
  canDelete: "Boolean",
  membershipVersion: "Int",
  projectionUpdatedAt: "String",
  createdAt: "String",
  updatedAt: "String"
});
requireUnique("WorkspaceVisibilityProjection", projection, ["userId", "workspaceId"]);
requireIndex("WorkspaceVisibilityProjection", projection, [
  "userId",
  "canRead",
  "projectionUpdatedAt",
  "workspaceId"
]);

requireFields("ProcessedDomainEvent", processedEvent, {
  consumerName: "String",
  eventId: "String",
  eventType: "String",
  aggregateType: "String",
  aggregateId: "String",
  processedAt: "String",
  resultStatus: "String",
  createdAt: "String",
  updatedAt: "String"
});
requireId("ProcessedDomainEvent", processedEvent, ["consumerName", "eventId"]);

for (const exportedType of [
  "WorkspaceProvisioningOperation",
  "OutboxMessage",
  "WorkspaceCommandReceipt",
  "WorkspaceVisibilityProjection",
  "ProcessedDomainEvent"
]) {
  assert.match(
    databaseExports,
    new RegExp(`\\b${exportedType}\\b`),
    `${exportedType} must be exported from @vcp/database`
  );
}

assert.match(migration, /ALTER TABLE "workspaces" ADD COLUMN "createdByUserId" TEXT;/);
assert.match(migration, /ALTER TABLE "workspaces" ADD COLUMN "resolvedProvisioningProfile" JSONB;/);
assert.match(migration, /ALTER TABLE "workspaces" ALTER COLUMN "status" SET DEFAULT 'provisioning';/);
assert.match(migration, /"runtimeVerificationState" = CASE[\s\S]*WHEN "status" IN \('running', 'stopping'\) THEN 'manual_review_required'/);

const legacyStatusMappings = {
  pending: "provisioning",
  running: "provisioning",
  stopping: "deleting",
  failed: "failed",
  deleted: "deleted"
};

for (const [legacyStatus, targetStatus] of Object.entries(legacyStatusMappings)) {
  assert.match(
    migration,
    new RegExp(`WHEN '${legacyStatus}' THEN '${targetStatus}'`),
    `migration must map ${legacyStatus} to ${targetStatus}`
  );
}

assert.match(
  migration,
  /CREATE UNIQUE INDEX "workspace_provisioning_operations_active_family_key"[\s\S]*WHERE "status" IN \('queued', 'blocked', 'running', 'retry_scheduled'\);/,
  "migration must add exact manual partial unique index for active operation family"
);
assert.doesNotMatch(
  migration.match(
    /CREATE UNIQUE INDEX "workspace_provisioning_operations_active_family_key"[\s\S]*?;/
  )?.[0] ?? "",
  /'reconcile'/,
  "active operation family predicate must not treat reconcile as an active status"
);
assert.match(
  migration,
  /CREATE UNIQUE INDEX "wcr_operation_key"[\s\S]*WHERE "operationId" IS NOT NULL;/,
  "migration must add partial unique index for optional command receipt operation references"
);
assert.match(
  migration,
  /CREATE UNIQUE INDEX "wcr_idem_scope_key"/,
  "migration must enforce actor/command/target/idempotency receipt scope"
);
assert.match(
  migration,
  /CREATE TABLE "processed_domain_events"[\s\S]*PRIMARY KEY \("consumerName", "eventId"\)/,
  "migration must persist consumer inbox dedupe markers"
);

for (const forbiddenTable of [
  "workspace_members",
  "subscriptions",
  "agents",
  "workflows",
  "tasks",
  "documents"
]) {
  assert.doesNotMatch(
    migration,
    new RegExp(`CREATE TABLE "${forbiddenTable}"`),
    `Workspace Management migration must not create ${forbiddenTable}`
  );
}

assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|ON DELETE CASCADE/i);
assert.doesNotMatch(
  [
    workspace.body,
    operation.body,
    outbox.body,
    receipt.body,
    projection.body,
    processedEvent.body
  ].join("\n"),
  /providerSecret|credential|password|apiKey|accessToken|refreshToken/i,
  "Workspace schema must not persist provider credentials or tokens"
);

assert.match(preflight, /Unsupported legacy Workspace status/);
assert.match(preflight, /null required fields/);
assert.match(preflight, /blank required fields/);
assert.match(preflight, /malformed timestamp/);
assert.match(preflight, /legacy_running_or_stopping_requires_manual_runtime_review/);
assert.match(preflight, /legacy_normalized_name_collision_per_creator/);
assert.doesNotMatch(
  preflight,
  /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|CALL)\b/i,
  "preflight SQL must remain read-only"
);

const canonicalWorkspaceStatuses = [
  "provisioning",
  "active",
  "failed",
  "deleting",
  "delete_failed",
  "deleted"
];
assert.deepEqual(
  parseConstStringArray(workspaceSharedContract, "WORKSPACE_LIFECYCLE_STATUSES"),
  canonicalWorkspaceStatuses,
  "Workspace public lifecycle DTO statuses must be canonical"
);
assert.deepEqual(
  parseConstStringArray(sharedStatuses, "WORKSPACE_STATUSES"),
  canonicalWorkspaceStatuses,
  "Shared WorkspaceStatus inventory must be canonical"
);
assert.deepEqual(
  sharedSchema.statuses.workspace,
  canonicalWorkspaceStatuses,
  "machine-readable shared contract inventory must use canonical Workspace statuses"
);
for (const legacyStatus of ["pending", "running", "stopping"]) {
  assert.doesNotMatch(
    getTypeBlock(workspaceSharedContract, "WorkspaceLifecycleStatusDto"),
    new RegExp(`"${legacyStatus}"`),
    `Workspace lifecycle DTO must not expose legacy status ${legacyStatus}`
  );
}

const requiredWorkspaceApiErrorCodes = [
  "validation.invalid_input",
  "auth.unauthorized",
  "auth.forbidden",
  "workspace.not_found",
  "workspace.lifecycle_conflict",
  "workspace.idempotency_conflict",
  "workspace.entitlement_denied",
  "system.unavailable",
  "system.unexpected_error"
];
for (const code of requiredWorkspaceApiErrorCodes) {
  assert.match(sharedApi, new RegExp(`"${escapeRegExp(code)}"`), `${code} must exist`);
  assert.match(
    `${workspaceHttpErrors}\n${workspaceResponseMapper}`,
    new RegExp(`"${escapeRegExp(code)}"`),
    `${code} must be used by Workspace HTTP error mapping`
  );
}

const publicWorkspaceDtoSource = [
  getTypeBlock(workspaceSharedContract, "CreateWorkspaceRequest"),
  getTypeBlock(workspaceSharedContract, "WorkspaceSummaryDto"),
  getTypeBlock(workspaceSharedContract, "WorkspaceDetailDto"),
  getTypeBlock(workspaceSharedContract, "CreateWorkspaceAcceptedResponse"),
  getTypeBlock(workspaceSharedContract, "DeleteWorkspaceAcceptedResponse"),
  getTypeBlock(workspaceSharedContract, "WorkspaceCommandOperationDto")
].join("\n");
for (const forbiddenPublicKey of [
  "runtimeRef",
  "runtimeUrl",
  "providerRequestKey",
  "leaseToken",
  "version",
  "eventId",
  "outboxMessageId",
  "commandReceiptId",
  "requestFingerprint",
  "resolvedProvisioningProfile",
  "subscriptionId",
  "bootstrapAttemptId",
  "membershipId",
  "membershipVersion",
  "rawProviderData",
  "stack",
  "credential",
  "secret",
  "token",
  "password",
  "authorization",
  "cookie"
]) {
  assert.doesNotMatch(
    publicWorkspaceDtoSource,
    new RegExp(`\\b${escapeRegExp(forbiddenPublicKey)}\\??\\s*:`),
    `public Workspace DTOs must not expose ${forbiddenPublicKey}`
  );
}

const workspaceEventEnvelopeBlock = getTypeBlock(workspaceEventFactory, "WorkspaceDomainEvent");
for (const requiredEventField of [
  "eventId",
  "eventType",
  "eventVersion",
  "aggregateType",
  "aggregateId",
  "lifecycleVersion",
  "eventSequence",
  "occurredAt",
  "correlationId"
]) {
  assert.match(
    workspaceEventEnvelopeBlock,
    new RegExp(`\\b${requiredEventField}\\b`),
    `Workspace event envelope must include ${requiredEventField}`
  );
}
assert.match(workspaceEventEnvelopeBlock, /aggregateType:\s*"workspace"/);
assert.match(workspaceEventFactory, /eventSequence:\s*event\.eventSequence/);
assert.match(workspaceEventFactory, /workspace-membership\.owner-established\.v1/);
assert.match(
  workspaceEventFactory,
  /Workspace Management must not create Workspace Membership acknowledgement events\./
);
assert.doesNotMatch(
  workspaceEventFactory,
  /workspace-membership\.owner-established\.v1[\s\S]{0,200}aggregateType:\s*"workspace"/,
  "membership bootstrap acknowledgement events must never be declared as workspace aggregate events"
);
assert.doesNotMatch(
  workspaceEventFactory,
  /workspace-membership\.owner-establishment-failed\.v1[\s\S]{0,200}aggregateType:\s*"workspace"/,
  "membership bootstrap failure acknowledgement events must never be declared as workspace aggregate events"
);

assert.match(workspaceEventFactory, /destructiveCleanupAuthorized:\s*false/);
assert.match(workspaceEventFactory, /downstreamGuidance:\s*"non_destructive_quiesce_only"/);
assert.match(deleteWorkspaceUseCase, /eventType:\s*"workspace\.deletion_requested\.v1"/);
assert.doesNotMatch(
  deleteWorkspaceUseCase,
  /workspace\.deletion_requested\.v1[\s\S]{0,800}cleanupAuthorized:\s*true/,
  "deletion-requested event must not authorize destructive cleanup"
);
assert.match(processWorkspaceOperation, /"workspace\.deleted\.v1"/);
assert.match(processWorkspaceOperation, /cleanupAuthorized:\s*true/);

assertNoForbiddenImportSpecifiers(listSourceFiles(workspaceBackendDir), [
  {
    name: "private backend feature module",
    pattern:
      /(?:@vcp\/backend\/|apps\/backend\/src\/)modules\/(authentication|workspace-user-management|subscription-payment|agent-management|workflow-management|tools-integration|task-orchestration|knowledge-base-rag)(?:\/|$)/
  },
  { name: "frontend code", pattern: /@vcp\/frontend|apps\/frontend/ },
  { name: "worker code", pattern: /@vcp\/workers|apps\/workers/ }
]);
assertNoForbiddenImportSpecifiers(listSourceFiles(sharedContractsDir), [
  { name: "backend module", pattern: /@vcp\/backend|apps\/backend/ },
  { name: "database module", pattern: /@vcp\/database|packages\/database/ },
  { name: "Prisma", pattern: /@prisma\/client|PrismaClient/ },
  { name: "Docker runtime", pattern: /docker/i },
  { name: "OpenClaw runtime", pattern: /openclaw/i },
  { name: "worker module", pattern: /@vcp\/workers|apps\/workers/ },
  { name: "frontend feature", pattern: /@vcp\/frontend|apps\/frontend/ },
  { name: "Express", pattern: /^express$/ },
  { name: "React", pattern: /^react(?:\/|$)/ }
]);
assertNoForbiddenImportSpecifiers(listSourceFiles(workspacePersistenceDir), [
  { name: "direct Prisma client", pattern: /@prisma\/client/ },
  {
    name: "relative/generated Prisma internals",
    pattern: /packages\/database|generated\/client|prisma\/schema|prisma\/migrations/
  }
]);
assertNoForbiddenImportSpecifiers(listSourceFiles(workspaceFrontendDir), [
  { name: "backend module", pattern: /@vcp\/backend|apps\/backend/ },
  { name: "database module", pattern: /@vcp\/database|packages\/database/ },
  { name: "Prisma", pattern: /@prisma\/client|PrismaClient/ },
  { name: "worker module", pattern: /@vcp\/workers|apps\/workers/ },
  { name: "Docker/OpenClaw runtime adapter", pattern: /docker|openclaw|local-demo/i },
  { name: "runtime provider code", pattern: /runtime-provider|runtime-provisioning/i }
]);
assertNoForbiddenRuntimeCallPatterns(listSourceFiles(workspaceFrontendDir), [
  /\bWorkspaceRuntimeProvisioningPort\b/,
  /\bDockerCommandRunner\b/,
  /\bLocalDemoWorkspaceRuntimeAdapter\b/,
  /\b(provisionWorkspace|deprovisionWorkspace|getWorkspaceRuntimeStatus)\s*\(/
]);

assert.doesNotMatch(projection.body, /\b(role|invitationId|memberId)\b/);
assert.doesNotMatch(
  workspacePersistenceTypes,
  /WorkspaceVisibilityProjectionRecord[\s\S]*\b(role|invitationId|memberId)\b[\s\S]*};/,
  "visibility projection records must not persist membership role or invitation data"
);
for (const filePath of listSourceFiles(workspaceBackendDir).filter(
  (sourcePath) => !/\.test\.(ts|tsx)$/.test(sourcePath)
)) {
  const source = readFileSync(filePath, "utf8");
  assert.doesNotMatch(
    source,
    /\bworkspaceMember\b|\bWorkspaceMember\b|\bWorkspaceMemberRepository\b|\bInvitationRepository\b|\binvitationModel\b/i,
    `${relative(root, filePath)} must not use Membership or Invitation persistence as source of truth`
  );
}
assert.match(listWorkspacesUseCase, /listCandidateWorkspaceIds/);
assert.match(listWorkspacesUseCase, /filterAccessibleWorkspaceIds/);
assert.match(getWorkspaceDetailUseCase, /getWorkspaceAccess/);
assert.match(deleteWorkspaceUseCase, /getWorkspaceAccess/);

const receiptScopeBlock = getTypeBlock(
  workspaceCommandReceiptRepository,
  "WorkspaceCommandReceiptRepository"
);
for (const scopeField of [
  "actorUserId",
  "commandType",
  "commandTarget",
  "idempotencyKey"
]) {
  assert.match(
    receiptScopeBlock,
    new RegExp(`\\b${scopeField}:`),
    `command receipt scope must include ${scopeField}`
  );
}
assert.doesNotMatch(
  `${workspaceCommandReceiptRepository}\n${prismaCommandReceiptRepository}`,
  /\bmethod\b|\bpath\b/,
  "Workspace command receipts must not use obsolete userId + method + path + key identity logic"
);
for (const forbiddenReceiptKey of [
  "runtimeref",
  "providerrequestkey",
  "leasetoken",
  "password",
  "token",
  "authorization",
  "secret",
  "credential"
]) {
  assert.match(
    workspacePersistenceErrors,
    new RegExp(`"${forbiddenReceiptKey}"`),
    `receipt response snapshot guard must reject ${forbiddenReceiptKey}`
  );
}

function parseConstStringArray(source, constName) {
  const match = source.match(
    new RegExp(`export const ${escapeRegExp(constName)} = \\[([\\s\\S]*?)\\] as const;`)
  );
  assert.ok(match, `missing const string array ${constName}`);
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (value) => value[1]);
}

function getTypeBlock(source, typeName) {
  const typeStart = source.search(
    new RegExp(`export type ${escapeRegExp(typeName)}(?:<[^>]+>)?\\s*=`)
  );
  const interfaceStart = source.search(
    new RegExp(`export interface ${escapeRegExp(typeName)}\\s*\\{`)
  );
  const start = typeStart >= 0 ? typeStart : interfaceStart;
  assert.ok(start >= 0, `missing exported type/interface ${typeName}`);

  const rest = source.slice(start);
  const nextExport = rest.search(/\n\nexport (?:type|interface|class|function|const) /);
  return nextExport >= 0 ? rest.slice(0, nextExport) : rest;
}

function assertNoForbiddenImportSpecifiers(files, forbiddenRules) {
  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const specifiers = parseModuleSpecifiers(source);

    for (const specifier of specifiers) {
      for (const rule of forbiddenRules) {
        assert.doesNotMatch(
          specifier,
          rule.pattern,
          `${relative(root, filePath)} must not import ${rule.name}: ${specifier}`
        );
      }
    }
  }
}

function assertNoForbiddenRuntimeCallPatterns(files, forbiddenPatterns) {
  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(
        source,
        pattern,
        `${relative(root, filePath)} must not call runtime provider code directly`
      );
    }
  }
}

function parseModuleSpecifiers(source) {
  return Array.from(
    source.matchAll(/\b(?:import|export)\b(?:[\s\S]*?\bfrom\s*)?["']([^"']+)["']/g),
    (match) => match[1]
  );
}

function listSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files.sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseModels(source) {
  const parsedModels = new Map();
  const modelPattern = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;

  for (const match of source.matchAll(modelPattern)) {
    const [, modelName, body] = match;
    const fields = new Map();
    const indexes = [];
    const uniques = [];
    const ids = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();

      if (!line || line.startsWith("//")) {
        continue;
      }

      if (line.startsWith("@@index")) {
        indexes.push(parseFieldList(line));
        continue;
      }

      if (line.startsWith("@@unique")) {
        uniques.push(parseFieldList(line));
        continue;
      }

      if (line.startsWith("@@id")) {
        ids.push(parseFieldList(line));
        continue;
      }

      if (line.startsWith("@@")) {
        continue;
      }

      const [fieldName, fieldType] = line.split(/\s+/);
      fields.set(fieldName, { type: fieldType, line });
    }

    parsedModels.set(modelName, { body, fields, indexes, uniques, ids });
  }

  return parsedModels;
}

function parseFieldList(line) {
  const fieldMatch = line.match(/\[\s*([^\]]+)\s*\]/);
  assert.ok(fieldMatch, `could not parse field list from ${line}`);
  return fieldMatch[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireModel(modelName) {
  assert.ok(models.has(modelName), `missing Prisma model: ${modelName}`);
  return models.get(modelName);
}

function requireFields(modelName, model, expectedFields) {
  for (const [fieldName, fieldType] of Object.entries(expectedFields)) {
    assert.ok(model.fields.has(fieldName), `${modelName} missing field ${fieldName}`);
    assert.equal(
      model.fields.get(fieldName).type,
      fieldType,
      `${modelName}.${fieldName} should be ${fieldType}`
    );
  }
}

function requireIndex(modelName, model, expectedFields) {
  assert.ok(
    model.indexes.some((index) => index.join(",") === expectedFields.join(",")),
    `${modelName} missing index on ${expectedFields.join(", ")}`
  );
}

function requireUnique(modelName, model, expectedFields) {
  assert.ok(
    model.uniques.some((unique) => unique.join(",") === expectedFields.join(",")),
    `${modelName} missing unique constraint on ${expectedFields.join(", ")}`
  );
}

function requireId(modelName, model, expectedFields) {
  assert.ok(
    model.ids.some((id) => id.join(",") === expectedFields.join(",")),
    `${modelName} missing composite id on ${expectedFields.join(", ")}`
  );
}

console.log("workspace management database schema checks passed");
