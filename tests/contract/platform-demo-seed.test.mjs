import assert from "node:assert/strict";

import {
  PLATFORM_DEMO_USERS,
  PLATFORM_DEMO_WORKSPACES,
  seedPlatformDemoData
} from "@vcp/backend/platform-demo-seed.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

const modelNames = [
  "user",
  "workspace",
  "workspaceMember",
  "invitation",
  "agent",
  "subscription",
  "transaction",
  "paymentMethod",
  "promoCode",
  "tool",
  "toolConnection",
  "agentToolAssignment",
  "knowledgeDataSource",
  "knowledgeSyncScopeNode",
  "document",
  "knowledgeDocumentChunk",
  "knowledgeIndex",
  "knowledgeIngestionJob",
  "knowledgeAccessGrant",
  "knowledgeSyncJob",
  "knowledgeSyncJobEvent",
  "knowledgeRuntimeJob",
  "workflow",
  "workflowStep",
  "workflowExecution",
  "workflowStepLog",
  "task",
  "taskRun",
  "job",
  "conversation",
  "chatMessage"
];

const prisma = createFakePrisma(modelNames);

await seedPlatformDemoData(prisma, { now: "2026-07-08T00:00:00.000Z" });
const countsAfterFirstRun = snapshotCounts(prisma, modelNames);
await seedPlatformDemoData(prisma, { now: "2026-07-08T00:00:00.000Z" });
const countsAfterSecondRun = snapshotCounts(prisma, modelNames);

assert.deepEqual(countsAfterSecondRun, countsAfterFirstRun);
assert.equal(prisma.user.records.size, PLATFORM_DEMO_USERS.length);
assert.equal(prisma.workspace.records.size, PLATFORM_DEMO_WORKSPACES.length);
assert.equal(prisma.agent.records.size, 3);
assert.equal(prisma.workflow.records.size, 1);
assert.equal(prisma.task.records.size, 2);
assert.equal(prisma.document.records.size, 2);

const demoWorkspace = Array.from(prisma.workspace.records.values()).find(
  (record) => record.workspaceId === DEMO_WORKSPACE_ID
);
assert.equal(demoWorkspace.name, "Product Demo");

const managerMembership = Array.from(prisma.workspaceMember.records.values()).find(
  (record) => record.workspaceId === DEMO_WORKSPACE_ID && record.userId === "local-dev-user"
);
assert.equal(managerMembership.role, "host");

const researchGrant = Array.from(prisma.knowledgeAccessGrant.records.values()).find(
  (record) => record.agentId === "agent-research" && record.documentId === "document-policy"
);
assert.equal(researchGrant.status, "active");

console.log("platform demo seed idempotency checks passed");

function createFakePrisma(names) {
  return Object.fromEntries(names.map((name) => [name, createDelegate()]));
}

function createDelegate() {
  const records = new Map();

  return {
    records,
    async upsert(input) {
      const key = JSON.stringify(input.where);
      const existing = records.get(key);
      const next = existing
        ? { ...existing, ...input.update }
        : { ...input.create };
      records.set(key, next);
      return next;
    }
  };
}

function snapshotCounts(prisma, names) {
  return Object.fromEntries(names.map((name) => [name, prisma[name].records.size]));
}
