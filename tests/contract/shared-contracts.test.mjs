import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = join(root, "shared/contracts/schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

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

for (const idKind of [
  "userId",
  "workspaceId",
  "memberId",
  "agentId",
  "toolId",
  "workflowId",
  "taskId",
  "documentId"
]) {
  assert.ok(schema.idKinds.includes(idKind), `missing id kind: ${idKind}`);
}

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

for (const capability of expectedCapabilities) {
  assert.ok(
    existsSync(join(root, "backend/src/modules", capability, "README.md")),
    `backend module boundary missing for ${capability}`
  );
  assert.ok(
    existsSync(join(root, "frontend/src/features", capability, "README.md")),
    `frontend feature boundary missing for ${capability}`
  );
}

console.log("shared contract checks passed");
