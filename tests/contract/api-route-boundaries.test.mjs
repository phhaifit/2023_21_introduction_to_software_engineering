import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const matrixPath = join(root, "docs/api/module-api-contracts.md");
const ownershipPath = join(root, "docs/module-ownership.md");

assert.ok(existsSync(matrixPath), "API route matrix document must exist");

const matrix = readFileSync(matrixPath, "utf8");
const ownership = readFileSync(ownershipPath, "utf8");

const capabilities = parseOwnershipCapabilities(ownership);

for (const capability of capabilities) {
  assert.match(
    matrix,
    new RegExp(`^## ${escapeRegExp(capability)}$`, "m"),
    `API matrix must include a section for ${capability}`
  );
}

for (const requiredText of [
  "Every public backend HTTP route must start with `/api`.",
  "Workspace-owned resources must use `/api/workspaces/:workspaceId/...`",
  "ApiResponse",
  "ApiSuccess",
  "ApiFailure",
  "ApiPaginatedSuccess",
  "validation.invalid_input",
  "auth.unauthorized",
  "auth.forbidden",
  "Documentation-based verification does not require planned routes to have live HTTP handlers."
]) {
  assert.ok(matrix.includes(requiredText), `API matrix must document common rule: ${requiredText}`);
}

const expectedRoutes = [
  ["POST", "/api/auth/register", "planned"],
  ["POST", "/api/auth/login", "planned"],
  ["POST", "/api/auth/logout", "planned"],
  ["GET", "/api/auth/me", "planned"],
  ["GET", "/api/workspaces", "planned"],
  ["POST", "/api/workspaces", "planned"],
  ["GET", "/api/workspaces/:workspaceId", "planned"],
  ["DELETE", "/api/workspaces/:workspaceId", "planned"],
  ["GET", "/api/workspaces/:workspaceId/members", "planned"],
  ["POST", "/api/workspaces/:workspaceId/invitations", "planned"],
  ["PATCH", "/api/workspaces/:workspaceId/members/:memberId", "planned"],
  ["DELETE", "/api/workspaces/:workspaceId/members/:memberId", "planned"],
  ["GET", "/api/workspaces/:workspaceId/agents", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/agents/models", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/skill-preview", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/assistant/draft", "planned"],
  ["POST", "/api/workspaces/:workspaceId/agents/assistant/import-skill", "provisional-existing"],
  ["GET", "/api/workspaces/:workspaceId/agents/:agentId/skill.md", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/agents/:agentId/configuration", "implemented"],
  ["PATCH", "/api/workspaces/:workspaceId/agents/:agentId", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/:agentId/enable", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/:agentId/disable", "implemented"],
  ["DELETE", "/api/workspaces/:workspaceId/agents/:agentId", "implemented"],
  ["GET", "/api/subscriptions/details", "provisional-existing"],
  ["POST", "/api/subscriptions/checkout", "provisional-existing"],
  ["POST", "/api/subscriptions/upgrade", "provisional-existing"],
  ["POST", "/api/subscriptions/mock-callback", "provisional-existing"],
  ["GET", "/api/workspaces/:workspaceId/tools/catalog", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tools/integrations", "planned"],
  ["PATCH", "/api/workspaces/:workspaceId/tools/integrations/:integrationId/credentials", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tools/assignments", "planned"],
  ["DELETE", "/api/workspaces/:workspaceId/tools/assignments/:assignmentId", "planned"],
  ["GET", "/api/workspaces/:workspaceId/workflows", "planned"],
  ["POST", "/api/workspaces/:workspaceId/workflows", "planned"],
  ["GET", "/api/workspaces/:workspaceId/workflows/:workflowId", "planned"],
  ["PATCH", "/api/workspaces/:workspaceId/workflows/:workflowId", "planned"],
  ["POST", "/api/workspaces/:workspaceId/workflows/:workflowId/publish", "planned"],
  ["POST", "/api/workspaces/:workspaceId/workflows/:workflowId/archive", "planned"],
  ["POST", "/api/workspaces/:workspaceId/workflows/:workflowId/execution-requests", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tasks", "planned"],
  ["GET", "/api/workspaces/:workspaceId/tasks/:taskId", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tasks/:taskId/cancel", "planned"],
  ["GET", "/api/workspaces/:workspaceId/tasks/:taskId/runs", "planned"],
  ["GET", "/api/workspaces/:workspaceId/tasks/:taskId/logs", "planned"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/documents", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/uploads/validate", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/uploads/prepare", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/ingestion-jobs", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/data-sources", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/sync-scope", "implemented"],
  ["PUT", "/api/workspaces/:workspaceId/knowledge/sync-scope", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/sync-jobs", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/sync-jobs", "implemented"]
];

for (const [method, path, status] of expectedRoutes) {
  const line = findRouteLine(matrix, method, path);
  assert.ok(line, `API matrix must include ${method} ${path}`);
  assert.ok(line.includes(`\`${status}\``), `${method} ${path} must be marked ${status}`);
}

assert.equal(
  expectedRoutes.filter(([, , status]) => status === "implemented").length,
  20,
  "Implemented Agent Management and Knowledge Base / RAG routes should be marked implemented by this matrix"
);

assert.equal(
  expectedRoutes.filter(([, , status]) => status === "provisional-existing").length,
  5,
  "Existing provisional routes should remain documented until full contract alignment"
);

function findRouteLine(source, method, path) {
  return source
    .split("\n")
    .find((line) => line.includes(`| \`${method}\` | \`${path}\` |`));
}

function parseOwnershipCapabilities(source) {
  return source
    .split("\n")
    .filter((line) => line.startsWith("| Member "))
    .map((line) => line.split("|").map((cell) => cell.trim())[2])
    .filter((capability) => capability && capability !== "Capability");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
