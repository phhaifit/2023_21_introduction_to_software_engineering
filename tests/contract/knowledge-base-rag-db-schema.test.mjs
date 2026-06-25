import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS } from "@vcp/shared";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = join(root, "packages/database/prisma/schema.prisma");
const migrationPath = join(
  root,
  "packages/database/prisma/migrations/20260625130000_add_kb_rag_persistence_boundary/migration.sql"
);
const docsContextPath = join(root, "docs/knowledge-base-rag-context.md");
const designPath = join(root, "openspec/changes/implement-knowledge-base-rag/design.md");
const databaseExportsPath = join(root, "packages/database/src/index.ts");

assert.ok(existsSync(schemaPath), "Prisma schema must exist");
assert.ok(existsSync(migrationPath), "KB/RAG persistence migration must exist");

const schema = readFileSync(schemaPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const docsContext = readFileSync(docsContextPath, "utf8");
const design = readFileSync(designPath, "utf8");
const databaseExports = readFileSync(databaseExportsPath, "utf8");
const models = parseModels(schema);

const expectedModels = {
  Document: {
    table: "documents",
    fields: {
      documentId: "String",
      workspaceId: "String",
      uploadedByUserId: "String",
      displayName: "String",
      fileName: "String",
      mimeType: "String",
      fileType: "String",
      sizeBytes: "Int",
      sourceType: "String",
      sourceId: "String?",
      storageKey: "String?",
      contentHash: "String?",
      status: "String",
      ingestionStatus: "String",
      indexingStatus: "String",
      chunkCount: "Int",
      indexedChunkCount: "Int",
      deletedAt: "String?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [
      ["workspaceId"],
      ["uploadedByUserId"],
      ["sourceId"],
      ["workspaceId", "sourceType"],
      ["workspaceId", "status"],
      ["workspaceId", "ingestionStatus"],
      ["workspaceId", "indexingStatus"],
      ["workspaceId", "contentHash"]
    ]
  },
  KnowledgeIndex: {
    table: "knowledge_indexes",
    fields: {
      knowledgeIndexId: "String",
      workspaceId: "String",
      documentId: "String",
      status: "String",
      chunkCount: "Int",
      indexedChunkCount: "Int",
      lastIndexedAt: "String?",
      errorCode: "String?",
      errorMessage: "String?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [["workspaceId"], ["documentId"], ["workspaceId", "status"]]
  },
  KnowledgeDocumentChunk: {
    table: "knowledge_document_chunks",
    fields: {
      chunkId: "String",
      workspaceId: "String",
      documentId: "String",
      chunkIndex: "Int",
      contentText: "String",
      contentHash: "String?",
      tokenCount: "Int?",
      embeddingStatus: "String",
      vectorRef: "String?",
      sourceLocator: "String?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [
      ["workspaceId"],
      ["documentId"],
      ["workspaceId", "embeddingStatus"],
      ["workspaceId", "contentHash"]
    ],
    uniques: [["documentId", "chunkIndex"]]
  },
  KnowledgeIngestionJob: {
    table: "knowledge_ingestion_jobs",
    fields: {
      jobId: "String",
      workspaceId: "String",
      documentId: "String?",
      status: "String",
      progress: "Int",
      queuedAt: "String",
      startedAt: "String?",
      completedAt: "String?",
      failedAt: "String?",
      errorCode: "String?",
      errorMessage: "String?",
      requestedByUserId: "String?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [["workspaceId"], ["documentId"], ["requestedByUserId"], ["workspaceId", "status"]]
  },
  KnowledgeDataSource: {
    table: "knowledge_data_sources",
    fields: {
      sourceId: "String",
      workspaceId: "String",
      provider: "String",
      displayName: "String",
      connectionStatus: "String",
      lastSyncAt: "String?",
      connectedByUserId: "String?",
      safeMetadata: "Json?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [["workspaceId"], ["workspaceId", "provider"], ["workspaceId", "connectionStatus"], ["connectedByUserId"]]
  },
  KnowledgeSyncScopeNode: {
    table: "knowledge_sync_scope_nodes",
    fields: {
      scopeNodeId: "String",
      workspaceId: "String",
      sourceId: "String",
      parentScopeNodeId: "String?",
      externalId: "String",
      nodeType: "String",
      displayName: "String",
      selected: "Boolean",
      safeMetadata: "Json?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [["workspaceId"], ["sourceId"], ["parentScopeNodeId"], ["workspaceId", "selected"]],
    uniques: [["sourceId", "externalId"]]
  },
  KnowledgeSyncJob: {
    table: "knowledge_sync_jobs",
    fields: {
      jobId: "String",
      workspaceId: "String",
      sourceId: "String?",
      status: "String",
      requestedByUserId: "String?",
      queuedAt: "String",
      startedAt: "String?",
      completedAt: "String?",
      failedAt: "String?",
      totalItems: "Int?",
      syncedItems: "Int?",
      failedItems: "Int?",
      errorCode: "String?",
      errorMessage: "String?",
      createdAt: "String",
      updatedAt: "String"
    },
    indexes: [["workspaceId"], ["sourceId"], ["requestedByUserId"], ["workspaceId", "status"]]
  },
  KnowledgeSyncJobEvent: {
    table: "knowledge_sync_job_events",
    fields: {
      syncJobEventId: "String",
      workspaceId: "String",
      jobId: "String",
      eventType: "String",
      status: "String?",
      message: "String?",
      errorCode: "String?",
      occurredAt: "String",
      createdAt: "String"
    },
    indexes: [["workspaceId"], ["jobId"], ["eventType"]]
  }
};

const expectedRelations = [
  {
    model: "Document",
    field: "source",
    target: "KnowledgeDataSource?",
    fields: ["sourceId"],
    references: ["sourceId"]
  },
  {
    model: "KnowledgeIndex",
    field: "document",
    target: "Document",
    fields: ["documentId"],
    references: ["documentId"]
  },
  {
    model: "KnowledgeDocumentChunk",
    field: "document",
    target: "Document",
    fields: ["documentId"],
    references: ["documentId"]
  },
  {
    model: "KnowledgeIngestionJob",
    field: "document",
    target: "Document?",
    fields: ["documentId"],
    references: ["documentId"]
  },
  {
    model: "KnowledgeSyncScopeNode",
    field: "dataSource",
    target: "KnowledgeDataSource",
    fields: ["sourceId"],
    references: ["sourceId"]
  },
  {
    model: "KnowledgeSyncJob",
    field: "dataSource",
    target: "KnowledgeDataSource?",
    fields: ["sourceId"],
    references: ["sourceId"]
  },
  {
    model: "KnowledgeSyncJobEvent",
    field: "syncJob",
    target: "KnowledgeSyncJob",
    fields: ["jobId"],
    references: ["jobId"]
  },
  {
    model: "KnowledgeAccessGrant",
    field: "document",
    target: "Document",
    fields: ["documentId"],
    references: ["documentId"]
  }
];

const expectedForeignKeys = [
  {
    table: "documents",
    constraint: "documents_sourceId_fkey",
    column: "sourceId",
    referencedTable: "knowledge_data_sources",
    referencedColumn: "sourceId"
  },
  {
    table: "knowledge_indexes",
    constraint: "knowledge_indexes_documentId_fkey",
    column: "documentId",
    referencedTable: "documents",
    referencedColumn: "documentId"
  },
  {
    table: "knowledge_document_chunks",
    constraint: "knowledge_document_chunks_documentId_fkey",
    column: "documentId",
    referencedTable: "documents",
    referencedColumn: "documentId"
  },
  {
    table: "knowledge_ingestion_jobs",
    constraint: "knowledge_ingestion_jobs_documentId_fkey",
    column: "documentId",
    referencedTable: "documents",
    referencedColumn: "documentId"
  },
  {
    table: "knowledge_sync_scope_nodes",
    constraint: "knowledge_sync_scope_nodes_sourceId_fkey",
    column: "sourceId",
    referencedTable: "knowledge_data_sources",
    referencedColumn: "sourceId"
  },
  {
    table: "knowledge_sync_jobs",
    constraint: "knowledge_sync_jobs_sourceId_fkey",
    column: "sourceId",
    referencedTable: "knowledge_data_sources",
    referencedColumn: "sourceId"
  },
  {
    table: "knowledge_sync_job_events",
    constraint: "knowledge_sync_job_events_jobId_fkey",
    column: "jobId",
    referencedTable: "knowledge_sync_jobs",
    referencedColumn: "jobId"
  },
  {
    table: "knowledge_access_grants",
    constraint: "knowledge_access_grants_documentId_fkey",
    column: "documentId",
    referencedTable: "documents",
    referencedColumn: "documentId"
  }
];

for (const [modelName, expectation] of Object.entries(expectedModels)) {
  const model = requireModel(modelName);

  assert.match(model.body, new RegExp(`@@map\\("${expectation.table}"\\)`));
  assert.equal(model.fields.get(Object.keys(expectation.fields)[0]).id, true, `${modelName} must have an @id`);

  for (const [fieldName, expectedType] of Object.entries(expectation.fields)) {
    assert.ok(model.fields.has(fieldName), `${modelName} missing ${fieldName}`);
    assert.equal(model.fields.get(fieldName).type, expectedType, `${modelName}.${fieldName} type mismatch`);
  }

  assert.ok(model.fields.has("workspaceId"), `${modelName} must include workspaceId`);
  assert.ok(hasIndex(model, ["workspaceId"]), `${modelName} must index workspaceId`);

  for (const indexFields of expectation.indexes) {
    assert.ok(hasIndex(model, indexFields), `${modelName} missing index ${indexFields.join(",")}`);
  }

  for (const uniqueFields of expectation.uniques ?? []) {
    assert.ok(hasUnique(model, uniqueFields), `${modelName} missing unique ${uniqueFields.join(",")}`);
  }

  for (const [fieldName, field] of model.fields) {
    assertSafeFieldName(modelName, fieldName);

    if (["status", "ingestionStatus", "indexingStatus", "embeddingStatus", "connectionStatus"].includes(fieldName)) {
      if (!field.type.endsWith("?")) {
        assert.ok(field.line.includes("@default"), `${modelName}.${fieldName} must have a default`);
      }
    }
  }

  assert.match(databaseExports, new RegExp(`\\b${modelName}\\b`), `${modelName} must be exported from @vcp/database`);
}

for (const relation of expectedRelations) {
  const model = requireModel(relation.model);
  assertPrismaRelation(model, relation);
}

for (const tableName of Object.values(expectedModels).map((expectation) => expectation.table)) {
  assert.match(migration, new RegExp(`CREATE TABLE "${tableName}"|ALTER TABLE "${tableName}"`), `${tableName} must appear in migration`);
}

for (const foreignKey of expectedForeignKeys) {
  assertMigrationForeignKey(foreignKey);
}

const allowedKbReferencedTables = new Set([
  "documents",
  "knowledge_data_sources",
  "knowledge_sync_jobs"
]);

for (const [, referencedTable] of migration.matchAll(/REFERENCES "([^"]+)"/g)) {
  assert.ok(
    allowedKbReferencedTables.has(referencedTable),
    `KB/RAG migration must not add FK to non-KB/RAG-owned table ${referencedTable}`
  );
}

for (const forbiddenPattern of [
  /DROP TABLE/i,
  /DROP COLUMN/i,
  /ON DELETE CASCADE/i,
  /credential/i,
  /secret/i,
  /refreshToken/i,
  /password/i,
  /privateUrl/i,
  /publicUrl/i,
  /embeddingVector/i,
  /rawVector/i,
  /vectorConfig/i,
  /queuePayload/i
]) {
  assert.doesNotMatch(migration, forbiddenPattern, `migration contains forbidden pattern ${forbiddenPattern}`);
}

for (const nonKbTable of ["users", "agents", "workflows", "tasks", "subscriptions", "transactions"]) {
  assert.doesNotMatch(
    migration,
    new RegExp(`ALTER TABLE "${nonKbTable}"`, "i"),
    `migration must not alter non-KB/RAG table ${nonKbTable}`
  );
}

assert.ok(
  KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS.every(({ path }) => path.startsWith("/api/workspaces/:workspaceId/knowledge/")),
  "KB/RAG public API route contract must remain workspace-scoped"
);

assert.ok(docsContext.includes("KB/RAG-owned"), "KB/RAG context must document DB ownership");
assert.ok(design.includes("KB/RAG-owned"), "OpenSpec design must document DB ownership");

console.log("knowledge base rag db schema checks passed");

function parseModels(source) {
  const parsedModels = new Map();
  const modelPattern = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;

  for (const match of source.matchAll(modelPattern)) {
    const [, modelName, body] = match;
    const fields = new Map();
    const indexes = [];
    const uniques = [];

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

      if (line.startsWith("@@")) {
        continue;
      }

      const [fieldName, fieldType] = line.split(/\s+/);
      fields.set(fieldName, {
        type: fieldType,
        line,
        id: line.includes("@id")
      });
    }

    parsedModels.set(modelName, { body, fields, indexes, uniques });
  }

  return parsedModels;
}

function parseFieldList(line) {
  const fieldMatch = line.match(/\[\s*([^\]]+)\s*\]/);
  assert.ok(fieldMatch, `cannot parse field list from ${line}`);
  return fieldMatch[1].split(",").map((value) => value.trim()).filter(Boolean);
}

function requireModel(modelName) {
  assert.ok(models.has(modelName), `missing Prisma model ${modelName}`);
  return models.get(modelName);
}

function hasIndex(model, expectedFields) {
  return model.indexes.some((index) => index.join(",") === expectedFields.join(","));
}

function hasUnique(model, expectedFields) {
  return model.uniques.some((unique) => unique.join(",") === expectedFields.join(","));
}

function assertPrismaRelation(model, relation) {
  const fieldList = relation.fields.join(", ");
  const referenceList = relation.references.join(", ");
  const relationPattern = new RegExp(
    `\\b${relation.field}\\s+${escapeRegExp(relation.target)}\\s+@relation\\(fields:\\s*\\[${escapeRegExp(fieldList)}\\],\\s*references:\\s*\\[${escapeRegExp(referenceList)}\\],\\s*onDelete:\\s*Restrict,\\s*onUpdate:\\s*NoAction\\)`
  );

  assert.match(
    model.body,
    relationPattern,
    `${relation.model}.${relation.field} must define an internal KB/RAG relation`
  );
}

function assertMigrationForeignKey(foreignKey) {
  const foreignKeyPattern = new RegExp(
    `ALTER TABLE "${foreignKey.table}" ADD CONSTRAINT "${foreignKey.constraint}" FOREIGN KEY \\("${foreignKey.column}"\\) REFERENCES "${foreignKey.referencedTable}"\\("${foreignKey.referencedColumn}"\\) ON DELETE RESTRICT ON UPDATE NO ACTION;`
  );

  assert.match(
    migration,
    foreignKeyPattern,
    `${foreignKey.table}.${foreignKey.column} must have an internal KB/RAG FK`
  );
}

function assertSafeFieldName(modelName, fieldName) {
  assert.doesNotMatch(
    fieldName,
    /credential|secret|refreshToken|password|privateUrl|publicUrl|embeddingVector|rawVector|vectorConfig|queuePayload/i,
    `${modelName}.${fieldName} must not expose sensitive infrastructure or secret fields`
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
