import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOMAIN_EVENTS,
  KNOWLEDGE_BASE_RAG_API_ROUTES,
  KNOWLEDGE_BASE_RAG_DTO_EXPORTS,
  KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS
} from "@vcp/shared";

const root = fileURLToPath(new URL("../../", import.meta.url));
const contractsDir = join(root, "packages/shared/src/contracts");
const source = readFileSync(join(contractsDir, "knowledge-base-rag.ts"), "utf8");
const eventsSource = readFileSync(join(contractsDir, "events.ts"), "utf8");
const publicExportsSource = readFileSync(join(contractsDir, "index.ts"), "utf8");
const schema = JSON.parse(readFileSync(join(contractsDir, "schema.json"), "utf8"));

const expectedDtoExports = [
  "KnowledgeDocumentDto",
  "KnowledgeDocumentChunkDto",
  "UploadCandidateFileDto",
  "UploadValidationRequest",
  "UploadValidationResponse",
  "PrepareUploadRequest",
  "PrepareUploadResponse",
  "IngestionJobDto",
  "KnowledgeDataSourceDto",
  "SyncScopeNodeDto",
  "SyncJobDto",
  "KnowledgeBaseApiError"
];

assert.deepEqual(KNOWLEDGE_BASE_RAG_DTO_EXPORTS, expectedDtoExports);
assert.deepEqual(schema.knowledgeBaseRag.dtoExports, expectedDtoExports);

for (const dtoName of expectedDtoExports) {
  assert.match(source, new RegExp(`export type ${dtoName}\\b`), `${dtoName} must be exported`);
}

assert.match(
  publicExportsSource,
  /export \* from "\.\/knowledge-base-rag\.ts";/,
  "KB/RAG contracts must be exported from the public @vcp/shared entry point"
);

const expectedRoutes = [
  ["GET", "/api/workspaces/:workspaceId/knowledge/documents"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/uploads/validate"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/uploads/prepare"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/ingestion-jobs"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/data-sources"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/sync-scope"],
  ["PUT", "/api/workspaces/:workspaceId/knowledge/sync-scope"],
  ["POST", "/api/workspaces/:workspaceId/knowledge/sync-jobs"],
  ["GET", "/api/workspaces/:workspaceId/knowledge/sync-jobs"]
];

assert.deepEqual(
  KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS.map(({ method, path }) => [method, path]),
  expectedRoutes
);
assert.deepEqual(
  schema.knowledgeBaseRag.routes.map(({ method, path }) => [method, path]),
  expectedRoutes
);

for (const [, routePath] of expectedRoutes) {
  assert.ok(
    routePath.startsWith("/api/workspaces/:workspaceId/knowledge/"),
    `${routePath} must keep the workspace tenant locator in the route`
  );
}

assert.equal(
  KNOWLEDGE_BASE_RAG_API_ROUTES.documents,
  "/api/workspaces/:workspaceId/knowledge/documents"
);

for (const requestDto of schema.knowledgeBaseRag.requestDtoExports) {
  const block = getTypeBlock(source, requestDto);
  assert.doesNotMatch(
    block,
    /\b(workspaceId|actorId|userId|documentId|jobId|status|createdAt|updatedAt|startedAt|finishedAt)\b/,
    `${requestDto} must not accept trusted server-owned fields`
  );
  assert.doesNotMatch(
    block,
    /\b(raw|credential|secret|token|refresh|private|storage|vector|embedding|queue)\b/i,
    `${requestDto} must not accept infrastructure or sensitive fields`
  );
}

const safePublicSamples = [
  {
    documentId: "doc-1",
    workspaceId: "workspace-1",
    name: "Handbook.pdf",
    source: "upload",
    mediaType: "application/pdf",
    sizeBytes: 1200,
    status: "ready",
    chunkCount: 4,
    indexedChunkCount: 4,
    createdAt: "2026-06-25T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z"
  },
  {
    chunkId: "chunk-1",
    documentId: "doc-1",
    workspaceId: "workspace-1",
    sequence: 1,
    textPreview: "Public excerpt",
    characterCount: 128,
    createdAt: "2026-06-25T00:00:00.000Z"
  },
  {
    sourceId: "source-1",
    workspaceId: "workspace-1",
    provider: "notion",
    displayName: "Company Wiki",
    status: "connected",
    selectedScopeNodeCount: 2,
    updatedAt: "2026-06-25T00:00:00.000Z"
  },
  {
    jobId: "job-1",
    workspaceId: "workspace-1",
    sourceId: "source-1",
    status: "completed",
    requestedAt: "2026-06-25T00:00:00.000Z",
    scannedItemCount: 3,
    changedItemCount: 1
  }
];

for (const sample of safePublicSamples) {
  assertSafePublicShape(sample);
}

const expectedEvents = schema.knowledgeBaseRag.domainEvents;

for (const eventName of expectedEvents) {
  assert.ok(DOMAIN_EVENTS.includes(eventName), `${eventName} must be exported as a domain event`);
  assert.ok(schema.events[eventName], `${eventName} must be documented in schema.json`);
  assert.ok(schema.events[eventName].includes("eventId"), `${eventName} must include eventId`);
  assert.ok(schema.events[eventName].includes("occurredAt"), `${eventName} must include occurredAt`);
  assert.ok(schema.events[eventName].includes("eventType"), `${eventName} must include eventType`);
  assert.ok(schema.events[eventName].includes("workspaceId"), `${eventName} must include workspaceId`);
  assert.match(eventsSource, new RegExp(`"${escapeRegExp(eventName)}"`));
}

for (const eventName of expectedEvents.filter((name) => name.endsWith("Failed"))) {
  assert.ok(schema.events[eventName].includes("errorCode"), `${eventName} must include errorCode`);
  assert.ok(schema.events[eventName].includes("errorMessage"), `${eventName} must include errorMessage`);
}

assertSafePublicShape({
  name: "knowledge.document.ingestionFailed",
  eventId: "event-1",
  occurredAt: "2026-06-25T00:00:00.000Z",
  payload: {
    eventType: "knowledge.document.ingestionFailed",
    workspaceId: "workspace-1",
    documentId: "doc-1",
    jobId: "job-1",
    status: "failed",
    errorCode: "parse_failed",
    errorMessage: "The document could not be parsed."
  }
});

assert.ok(
  DOMAIN_EVENTS.includes("knowledge.document_uploaded"),
  "legacy knowledge.document_uploaded event must remain exported for compatibility"
);
assert.ok(
  DOMAIN_EVENTS.includes("knowledge.index_ready"),
  "legacy knowledge.index_ready event must remain exported for compatibility"
);

assert.doesNotMatch(
  source,
  /apps\/backend|apps\/frontend|apps\/workers|@vcp\/database|@prisma|PrismaClient|agent-management|workflow-management|task-orchestration/,
  "KB/RAG shared contracts must not import private modules or infrastructure"
);

console.log("knowledge base rag contract checks passed");

function getTypeBlock(contractSource, typeName) {
  const match = contractSource.match(new RegExp(`export type ${typeName} = \\{[\\s\\S]*?\\n\\};`));
  assert.ok(match, `missing exported type block ${typeName}`);
  return match[0];
}

function assertSafePublicShape(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePublicShape(item, [...path, String(index)]));
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(
      key,
      /credential|secret|token|refresh|private|storage|vector|embedding|queue|raw/i,
      `public sample must not expose unsafe field ${[...path, key].join(".")}`
    );
    assertSafePublicShape(child, [...path, key]);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
