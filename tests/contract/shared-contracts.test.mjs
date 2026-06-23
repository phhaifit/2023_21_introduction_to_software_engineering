import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = join(root, "packages/shared/src/contracts/schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const idsSource = readContractSource("ids.ts");
const statusesSource = readContractSource("statuses.ts");
const taskSource = readContractSource("task-orchestration.ts");
const publicExportsSource = readContractSource("index.ts");
const { TASK_ROUTING_MODES } = await import("@vcp/shared");

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
  taskSource,
  /selectedAgentId\?|selectedWorkflowId\?|workspaceId|submittedByUserId/,
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
    join(root, "packages/shared/src/contracts", fileName),
    "utf8"
  );
}
