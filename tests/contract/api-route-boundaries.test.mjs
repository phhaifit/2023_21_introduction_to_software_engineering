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
  ["POST", "/api/auth/register", "implemented"],
  ["POST", "/api/auth/login", "implemented"],
  ["POST", "/api/auth/logout", "implemented"],
  ["GET", "/api/auth/me", "implemented"],
  ["GET", "/api/workspaces", "implemented"],
  ["POST", "/api/workspaces", "implemented"],
  ["GET", "/api/workspaces/:workspaceId", "implemented"],
  ["DELETE", "/api/workspaces/:workspaceId", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/members", "provisional-existing"],
  ["GET", "/api/workspaces/:workspaceId/events", "provisional-existing"],
  ["POST", "/api/workspaces/:workspaceId/invitations", "provisional-existing"],
  ["PATCH", "/api/workspaces/:workspaceId/members/:memberId", "provisional-existing"],
  ["DELETE", "/api/workspaces/:workspaceId/members/:memberId", "provisional-existing"],
  ["POST", "/api/workspaces/:workspaceId/members/:memberId/transfer-host", "provisional-existing"],
  ["POST", "/api/workspaces/:workspaceId/admin-requests", "provisional-existing"],
  ["POST", "/api/workspaces/:workspaceId/admin-requests/:requestId/approve", "provisional-existing"],
  ["POST", "/api/workspaces/:workspaceId/admin-requests/:requestId/reject", "provisional-existing"],
  ["POST", "/api/invitations/:code/accept", "provisional-existing"],
  ["GET", "/api/workspaces/:workspaceId/agents", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/agents/models", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/skill-preview", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/assistant/draft", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/assistant/import-skill", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/agents/:agentId/skill.md", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/agents/:agentId/configuration", "implemented"],
  ["PATCH", "/api/workspaces/:workspaceId/agents/:agentId", "implemented"],
  ["PATCH", "/api/workspaces/:workspaceId/agents/:agentId/name", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/:agentId/duplicate", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/:agentId/enable", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/agents/:agentId/disable", "implemented"],
  ["DELETE", "/api/workspaces/:workspaceId/agents/:agentId", "implemented"],
  ["GET", "/api/subscriptions/details", "provisional-existing"],
  ["POST", "/api/subscriptions/checkout", "provisional-existing"],
  ["POST", "/api/subscriptions/upgrade", "provisional-existing"],
  ["POST", "/api/subscriptions/mock-callback", "provisional-existing"],
  ["GET", "/api/subscriptions/usage", "implemented"],
  ["POST", "/api/subscriptions/toggle-auto-renewal", "implemented"],
  ["POST", "/api/subscriptions/payment-method", "implemented"],
  ["DELETE", "/api/subscriptions/payment-method/:id", "provisional-existing"],
  ["POST", "/api/subscriptions/validate-promo", "implemented"],
  ["GET", "/api/subscriptions/plans", "implemented"],
  ["POST", "/api/subscriptions/cancel", "implemented"],
  ["POST", "/api/subscriptions/vnpay/checkout", "provisional-existing"],
  ["GET", "/api/subscriptions/vnpay/vnpay-return", "provisional-existing"],
  ["GET", "/api/subscriptions/vnpay/vnpay-ipn", "provisional-existing"],
  ["POST", "/api/subscriptions/vnpay/charge-saved-method", "provisional-existing"],
  ["POST", "/api/subscriptions/vnpay/initiate-binding", "provisional-existing"],
  ["POST", "/api/subscriptions/stripe/setup-intent", "provisional-existing"],
  ["POST", "/api/subscriptions/stripe/confirm-binding", "provisional-existing"],
  ["POST", "/api/subscriptions/stripe/charge", "provisional-existing"],
  ["GET", "/api/workspaces/:workspaceId/tools/catalog", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tools/integrations", "planned"],
  ["PATCH", "/api/workspaces/:workspaceId/tools/integrations/:integrationId/credentials", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tools/assignments", "planned"],
  ["DELETE", "/api/workspaces/:workspaceId/tools/assignments/:assignmentId", "planned"],
  ["GET", "/api/workspaces/:workspaceId/workflows", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/workflows", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/workflows/executions", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/workflows/executions/:executionId/logs", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/workflows/:workflowId", "implemented"],
  ["PATCH", "/api/workspaces/:workspaceId/workflows/:workflowId", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/workflows/:workflowId/execute", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/workflows/:workflowId/execute/stream", "implemented"],
  ["DELETE", "/api/workspaces/:workspaceId/workflows/:workflowId", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/tasks", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/tasks/:taskId", "planned"],
  ["POST", "/api/workspaces/:workspaceId/tasks/:taskId/cancel", "planned"],
  ["GET", "/api/workspaces/:workspaceId/tasks/:taskId/runs", "planned"],
  ["GET", "/api/workspaces/:workspaceId/tasks/:taskId/logs", "planned"],
  ["POST", "/api/workspaces/:workspaceId/executions/start", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/executions/:taskId/cancel", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/executions/:taskId/state", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/executions/:taskId/stream", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/conversations", "implemented"],
  ["DELETE", "/api/workspaces/:workspaceId/conversations/:conversationId", "implemented"],
  ["DELETE", "/api/workspaces/:workspaceId/conversations/:conversationId/turns/:taskId", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/documents", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/uploads/validate", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/uploads/prepare", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/ingestion-jobs", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/data-sources", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/sync-scope", "implemented"],
  ["PUT", "/api/workspaces/:workspaceId/knowledge/sync-scope", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/sync-jobs", "implemented"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/sync-jobs", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/retrieval/search", "implemented"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/rag/answer", "implemented"]
];

for (const [method, path, status] of expectedRoutes) {
  const line = findRouteLine(matrix, method, path);
  assert.ok(line, `API matrix must include ${method} ${path}`);
  assert.ok(line.includes(`\`${status}\``), `${method} ${path} must be marked ${status}`);
}

assert.equal(
  expectedRoutes.filter(([, , status]) => status === "implemented").length,
  57,
  "Implemented routes should be marked implemented by this matrix"
);

assert.equal(
  expectedRoutes.filter(([, , status]) => status === "provisional-existing").length,
  23,
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
