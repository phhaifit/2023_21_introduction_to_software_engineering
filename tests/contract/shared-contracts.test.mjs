import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = join(root, "packages/shared/src/contracts/schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const contractsDir = join(root, "packages/shared/src/contracts");
const frontendFeaturesDir = join(root, "apps/frontend/src/features");
const idsSource = readContractSource("ids.ts");
const apiSource = readContractSource("api.ts");
const agentSource = readContractSource("agent-management.ts");
const statusesSource = readContractSource("statuses.ts");
const subscriptionSource = readContractSource("subscription-payment.ts");
const taskSource = readContractSource("task-orchestration.ts");
const publicExportsSource = readContractSource("index.ts");
const {
  AUTHENTICATION_ERROR_CODES,
  AUTHORIZATION_ERROR_CODES,
  TASK_ROUTING_MODES
} = await import("@vcp/shared");

const expectedCapabilities = [
  "authentication",
  "subscription-payment",
  "workspace-management",
  "workspace-user-management",
  "agent-management",
  "tools-integration",
  "workflow-management",
  "task-orchestration",
  "knowledge-base-rag"
];

assert.deepEqual(schema.capabilities, expectedCapabilities);
assert.deepEqual(schema.roles, ["admin", "editor", "viewer"]);
assert.deepEqual(Object.keys(schema.plans).sort(), ["premium", "standard"]);

assert.deepEqual(schema.idKinds, [
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
  "jobId"
]);

assert.match(
  idsSource,
  /export type EntityId<K extends EntityIdKind = EntityIdKind> = string &/,
  "EntityId must remain the canonical branded string identity"
);

for (const [group, statuses] of Object.entries(schema.statuses)) {
  assert.ok(Array.isArray(statuses), `${group} statuses must be an array`);
  assert.equal(new Set(statuses).size, statuses.length, `${group} statuses must be unique`);
}

for (const [eventName, payloadFields] of Object.entries(schema.events)) {
  assert.ok(eventName.includes("."), `event must be namespaced: ${eventName}`);
  assert.ok(payloadFields.includes("eventId"), `${eventName} must include eventId`);
  assert.ok(payloadFields.includes("occurredAt"), `${eventName} must include occurredAt`);
}

assert.equal(
  new Set(schema.api.errorCodes).size,
  schema.api.errorCodes.length,
  "API error codes must be unique"
);
assert.deepEqual(schema.api.successShape, ["ok", "data", "meta"]);
assert.deepEqual(schema.api.errorShape, ["ok", "error", "meta"]);
assert.deepEqual(schema.api.metaShape, ["requestId", "timestamp"]);
assert.deepEqual(schema.api.paginationShape, [
  "page",
  "pageSize",
  "totalItems",
  "totalPages",
  "hasNextPage",
  "hasPreviousPage"
]);
assert.deepEqual(schema.api.validationIssueShape, ["path", "message", "code"]);
assert.ok(
  schema.api.errorCodes.includes("auth.unauthorized"),
  "API error codes must distinguish unauthenticated requests"
);
assert.deepEqual(
  AUTHENTICATION_ERROR_CODES,
  ["auth.unauthorized", "auth.invalid_credentials", "auth.session_expired"],
  "authentication error codes must be exported from @vcp/shared"
);
assert.deepEqual(
  AUTHORIZATION_ERROR_CODES,
  ["auth.forbidden"],
  "authorization error codes must be exported from @vcp/shared"
);

assert.match(apiSource, /export type ApiPaginationMeta = {[\s\S]*page: number;[\s\S]*pageSize: number;[\s\S]*totalItems: number;[\s\S]*totalPages: number;[\s\S]*hasNextPage: boolean;[\s\S]*hasPreviousPage: boolean;[\s\S]*};/);
assert.match(apiSource, /export type ApiValidationIssue = {[\s\S]*path: string;[\s\S]*message: string;[\s\S]*code\?: string;[\s\S]*};/);
assert.match(apiSource, /pagination\?: ApiPaginationMeta;/);
assert.match(apiSource, /issues\?: ApiValidationIssue\[\];/);
assert.match(apiSource, /export type ApiPaginatedSuccess<T> = ApiSuccess<T\[\]> &/);

assert.deepEqual(
  schema.statuses.task,
  ["queued", "running", "requires_action", "succeeded", "failed", "cancelled"],
  "task contracts must reuse the canonical production statuses"
);
assert.match(
  statusesSource,
  /export type TaskStatus = \(typeof TASK_STATUSES\)\[number\]/,
  "TaskStatus must remain derived from TASK_STATUSES"
);

assert.deepEqual(
  schema.taskOrchestration.routingModes,
  ["auto", "specific-agent", "predefined-workflow"]
);
assert.deepEqual(
  TASK_ROUTING_MODES,
  ["auto", "specific-agent", "predefined-workflow"],
  "routing modes must be available from the public @vcp/shared boundary"
);
assert.deepEqual(
  schema.taskOrchestration.createTaskRequestFields,
  ["prompt", "routing"]
);
assert.deepEqual(
  schema.taskOrchestration.createTaskResponseFields,
  ["taskId", "workId", "status", "createdAt"]
);

assert.match(
  taskSource,
  /mode:\s*"auto";[\s\S]*agentId\?:\s*never;[\s\S]*workflowId\?:\s*never;/,
  "auto routing must exclude agent and workflow targets"
);
assert.match(
  taskSource,
  /mode:\s*"specific-agent";[\s\S]*agentId:\s*EntityId<"agentId">;[\s\S]*workflowId\?:\s*never;/,
  "specific-agent routing must require agentId and exclude workflowId"
);
assert.match(
  taskSource,
  /mode:\s*"predefined-workflow";[\s\S]*workflowId:\s*EntityId<"workflowId">;[\s\S]*agentId\?:\s*never;/,
  "workflow routing must require workflowId and exclude agentId"
);
assert.doesNotMatch(
  getTypeBlock(taskSource, "CreateTaskRequest"),
  /selectedAgentId\?|selectedWorkflowId\?|workspaceId|submittedByUserId|taskId|workId|status|createdAt|updatedAt/,
  "public request contracts must not expose draft routing or authenticated identity fields"
);
assert.match(
  taskSource,
  /export type CreateTaskRequest = {\s*prompt: string;\s*routing: TaskRoutingSelection;\s*};/s
);
assert.match(taskSource, /taskId: EntityId<"taskId">;/);
assert.match(taskSource, /workId: EntityId<"workId">;/);
assert.match(taskSource, /status: TaskStatus;/);
assert.match(taskSource, /createdAt: string;/);
assert.doesNotMatch(
  taskSource,
  /@prisma|PrismaClient|apps\/frontend|apps\/backend/,
  "shared task contracts must not expose Prisma or private feature modules"
);
assert.match(
  publicExportsSource,
  /export \* from "\.\/task-orchestration\.ts";/,
  "task contracts must be exported from the public @vcp/shared entry point"
);

assert.deepEqual(schema.agentManagement.skillMarkdownSections, [
  "Role",
  "Model",
  "Responsibilities",
  "Operating Context",
  "Instructions",
  "Requested Tools",
  "Requested Knowledge",
  "Constraints",
  "Escalation Rules",
  "Example Tasks"
]);
for (const dtoName of schema.agentManagement.dtoExports) {
  assert.match(
    agentSource,
    new RegExp(`export type ${dtoName}\\b|export const ${dtoName}\\b`),
    `agent management shared contract must export ${dtoName}`
  );
}
for (const requestDtoName of schema.agentManagement.requestDtoExports) {
  const typeBlock = getTypeOrAliasBlock(agentSource, requestDtoName);
  assert.doesNotMatch(
    typeBlock,
    /workspaceId|submittedByUserId|userId|createdAt|updatedAt|status|agentId/,
    `${requestDtoName} must not accept trusted context or server-owned fields`
  );
}
const runtimeProfileBlock = getTypeBlock(agentSource, "AgentRuntimeProfile");
assert.match(runtimeProfileBlock, /agentId: EntityId<"agentId">;/);
assert.match(runtimeProfileBlock, /workspaceId: EntityId<"workspaceId">;/);
assert.match(runtimeProfileBlock, /status: "enabled";/);
assert.match(runtimeProfileBlock, /runnable: true;/);
assert.match(runtimeProfileBlock, /skillMarkdown: string;/);
assert.match(runtimeProfileBlock, /runtimeConfiguration: AgentRuntimeConfiguration;/);
assert.match(runtimeProfileBlock, /materializationHints: AgentRuntimeMaterializationHints;/);
assert.doesNotMatch(
  runtimeProfileBlock,
  /credential|secret|token|apiKey|rawProvider|providerError|runtimeUrl|containerId|terminalCommand|taskManifest|assignment|grant/i,
  "runtime profile must not expose credentials, raw providers, runtime internals, assignments, grants, or manifests"
);
assert.match(
  getTypeBlock(agentSource, "AgentRuntimeConfiguration"),
  /requestedTools: AgentSkillToolReference\[\];[\s\S]*requestedKnowledge: AgentSkillKnowledgeReference\[\];/,
  "runtime configuration must expose non-authoritative requested tool and knowledge intent"
);
assert.doesNotMatch(
  agentSource,
  /apiKey|credential|secret|token|password|privateKey|rawProvider|providerError/i,
  "agent management shared DTOs must not expose provider secrets or raw provider errors"
);
assert.match(
  publicExportsSource,
  /export \* from "\.\/agent-management\.ts";/,
  "agent management contracts must be exported from the public @vcp/shared entry point"
);

assert.match(
  subscriptionSource,
  /subscriptionId: EntityId<"subscriptionId">;/,
  "Subscription public summaries must use branded subscription IDs"
);
assert.match(
  subscriptionSource,
  /userId: EntityId<"userId">;/,
  "Subscription public summaries must use branded user IDs"
);
assert.match(
  subscriptionSource,
  /workspaceId: EntityId<"workspaceId"> \| null;/,
  "Subscription public summaries must use branded workspace IDs when present"
);
assert.match(
  subscriptionSource,
  /transactionId: EntityId<"transactionId">;/,
  "Transaction public summaries must use branded transaction IDs"
);

assert.ok(schema.contractConventions, "contract convention inventory must exist");
assert.ok(
  schema.contractConventions.sharedContractScope.includes("crossModuleRequests"),
  "contract convention inventory must include shared request scope"
);
assert.deepEqual(
  schema.contractConventions.requestBodyForbiddenFields,
  [
    "workspaceId",
    "submittedByUserId",
    "userId",
    "createdAt",
    "updatedAt",
    "status",
    "taskId",
    "workId"
  ]
);

for (const filePath of listSourceFiles(contractsDir)) {
  const source = readFileSync(filePath, "utf8");
  for (const forbiddenImport of schema.contractConventions.forbiddenSharedContractImports) {
    assert.doesNotMatch(
      source,
      new RegExp(escapeRegExp(forbiddenImport)),
      `shared contract file must not import private/infrastructure dependency ${forbiddenImport}: ${filePath}`
    );
  }
}

for (const filePath of listSourceFiles(frontendFeaturesDir)) {
  const source = readFileSync(filePath, "utf8");
  for (const forbiddenImport of schema.contractConventions.forbiddenFrontendCrossModuleImports) {
    assert.doesNotMatch(
      source,
      new RegExp(escapeRegExp(forbiddenImport)),
      `frontend feature must not import backend/database/worker dependency ${forbiddenImport}: ${filePath}`
    );
  }
}

for (const filePath of listSourceFiles(contractsDir)) {
  const source = readFileSync(filePath, "utf8");
  for (const fragment of schema.contractConventions.secretFieldNameFragments) {
    assert.doesNotMatch(
      source,
      new RegExp(`\\b[A-Za-z0-9_]*${escapeRegExp(fragment)}[A-Za-z0-9_]*\\??\\s*:`, "i"),
      `shared public DTOs must not expose sensitive field fragment '${fragment}' in ${filePath}`
    );
  }
}

for (const capability of expectedCapabilities) {
  assert.ok(
    existsSync(join(root, "apps/backend/src/modules", capability, "README.md")),
    `backend module boundary missing for ${capability}`
  );
  assert.ok(
    existsSync(join(root, "apps/frontend/src/features", capability, "README.md")),
    `frontend feature boundary missing for ${capability}`
  );
}

console.log("shared contract checks passed");

function readContractSource(fileName) {
  return readFileSync(
    join(contractsDir, fileName),
    "utf8"
  );
}

function getTypeBlock(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName} = \\{[\\s\\S]*?\\};`));
  assert.ok(match, `missing exported type ${typeName}`);
  return match[0];
}

function getTypeOrAliasBlock(source, typeName) {
  const objectMatch = source.match(new RegExp(`export type ${typeName} = \\{[\\s\\S]*?\\};`));
  if (objectMatch) {
    return objectMatch[0];
  }

  const aliasMatch = source.match(new RegExp(`export type ${typeName} = [^;]+;`));
  assert.ok(aliasMatch, `missing exported type ${typeName}`);
  return aliasMatch[0];
}

function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
