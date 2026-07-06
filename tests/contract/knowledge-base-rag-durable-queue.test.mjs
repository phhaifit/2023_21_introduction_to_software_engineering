import assert from "node:assert/strict";

import {
  PermanentKnowledgeRuntimeError,
  PrismaKnowledgeRuntimeQueue
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/prisma-knowledge-runtime-queue.ts";

const state = new Map();
const prisma = createFakePrisma(state);
let currentTime = new Date("2026-07-06T00:00:00.000Z");
const now = () => new Date(currentTime);
const handled = [];

const workerA = createQueue("worker-a");
const workerB = createQueue("worker-b");

await workerA.enqueue({
  kind: "google-drive-sync",
  workspaceId: "workspace-a",
  jobId: "sync-job-a"
});
assert.equal(state.size, 1, "durable enqueue must be idempotently persisted");
await workerB.enqueue({
  kind: "google-drive-sync",
  workspaceId: "workspace-a",
  jobId: "sync-job-a"
});
assert.equal(state.size, 1, "the same target job must not be duplicated");

const firstClaim = await workerA.claimNext();
assert.equal(firstClaim?.leaseOwner, "worker-a");
assert.equal(firstClaim?.attemptCount, 1);
assert.equal(await workerB.claimNext(), null, "an active lease must block another worker");

currentTime = new Date("2026-07-06T00:00:06.000Z");
const reclaimed = await workerB.claimNext();
assert.equal(reclaimed?.jobId, "sync-job-a");
assert.equal(reclaimed?.attemptCount, 2, "an expired lease must be reclaimable");
await workerB.complete(reclaimed.runtimeJobId);
assert.equal(state.get(reclaimed.runtimeJobId).status, "completed");
assert.equal(await workerA.claimNext(), null, "completed work must not be reclaimed");

await workerA.enqueue({
  kind: "document-ingestion",
  workspaceId: "workspace-a",
  jobId: "ingestion-job-a"
});
const retryClaim = await workerA.claimNext();
await workerA.fail(
  retryClaim,
  new Error("sensitive provider response that must not be persisted")
);
const retryRecord = state.get(retryClaim.runtimeJobId);
assert.equal(retryRecord.status, "retryable");
assert.equal(
  JSON.stringify(retryRecord).includes("sensitive provider response"),
  false,
  "failure persistence must not leak raw errors"
);

currentTime = new Date("2026-07-06T00:00:08.000Z");
const finalClaim = await workerB.claimNext();
assert.equal(finalClaim.attemptCount, 2);
await workerB.fail(finalClaim, new Error("second transient failure"));
assert.equal(state.get(finalClaim.runtimeJobId).status, "failed");
assert.equal(
  state.get(finalClaim.runtimeJobId).failureCode,
  "knowledge.runtime_attempts_exhausted"
);

await workerA.enqueue({
  kind: "document-ingestion",
  workspaceId: "workspace-a",
  jobId: "ingestion-job-permanent"
});
const permanentClaim = await workerA.claimNext();
await workerA.fail(
  permanentClaim,
  new PermanentKnowledgeRuntimeError(
    "knowledge.unsupported_document",
    "This document type is not supported."
  )
);
const permanentRecord = state.get(permanentClaim.runtimeJobId);
assert.equal(permanentRecord.status, "failed");
assert.equal(permanentRecord.failureCode, "knowledge.unsupported_document");
assert.equal(permanentRecord.attemptCount, 1);

assert.deepEqual(handled, []);
console.log("knowledge-base-rag durable queue checks passed");

function createQueue(leaseOwner) {
  return new PrismaKnowledgeRuntimeQueue({
    prisma,
    leaseOwner,
    leaseMs: 5_000,
    maxAttempts: 2,
    pollIntervalMs: 5_000,
    now,
    handlers: {
      googleDriveSync: async (job) => handled.push(job),
      documentIngestion: async (job) => handled.push(job)
    }
  });
}

function createFakePrisma(records) {
  return {
    async $executeRawUnsafe(sql, ...parameters) {
      if (sql.includes("INSERT INTO")) {
        const [runtimeJobId, workspaceId, targetJobId, kind, timestamp] = parameters;
        const duplicate = [...records.values()].some(
          (record) => record.kind === kind && record.targetJobId === targetJobId
        );
        if (!duplicate) {
          records.set(runtimeJobId, {
            runtimeJobId,
            workspaceId,
            targetJobId,
            kind,
            status: "pending",
            attemptCount: 0,
            leaseOwner: null,
            leaseExpiresAt: null,
            nextAttemptAt: timestamp,
            failureCode: null,
            failureMessage: null,
            queuedAt: timestamp,
            startedAt: null,
            completedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
        return duplicate ? 0 : 1;
      }
      if (sql.includes('"status" = \'completed\'')) {
        const [timestamp, runtimeJobId, leaseOwner] = parameters;
        const record = records.get(runtimeJobId);
        if (record?.status === "leased" && record.leaseOwner === leaseOwner) {
          Object.assign(record, {
            status: "completed",
            completedAt: timestamp,
            leaseOwner: null,
            leaseExpiresAt: null,
            failureCode: null,
            failureMessage: null,
            updatedAt: timestamp
          });
          return 1;
        }
        return 0;
      }
      const [
        status,
        nextAttemptAt,
        failureCode,
        failureMessage,
        timestamp,
        runtimeJobId,
        leaseOwner
      ] = parameters;
      const record = records.get(runtimeJobId);
      if (record?.status === "leased" && record.leaseOwner === leaseOwner) {
        Object.assign(record, {
          status,
          nextAttemptAt,
          failureCode,
          failureMessage,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: timestamp
        });
        return 1;
      }
      return 0;
    },
    async $queryRawUnsafe(_sql, nowIso, leaseOwner, leaseExpiresAt) {
      const candidate = [...records.values()]
        .filter(
          (record) =>
            ((record.status === "pending" || record.status === "retryable") &&
              record.nextAttemptAt <= nowIso) ||
            (record.status === "leased" && record.leaseExpiresAt < nowIso)
        )
        .sort(
          (left, right) =>
            left.nextAttemptAt.localeCompare(right.nextAttemptAt) ||
            left.queuedAt.localeCompare(right.queuedAt) ||
            left.runtimeJobId.localeCompare(right.runtimeJobId)
        )[0];
      if (!candidate) return [];
      Object.assign(candidate, {
        status: "leased",
        leaseOwner,
        leaseExpiresAt,
        attemptCount: candidate.attemptCount + 1,
        startedAt: candidate.startedAt ?? nowIso,
        updatedAt: nowIso
      });
      return [{ ...candidate }];
    }
  };
}
