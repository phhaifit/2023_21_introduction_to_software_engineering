import assert from "node:assert/strict";

import { GoogleDriveAutoSyncScheduler } from "@vcp/backend/modules/knowledge-base-rag/application/google-drive-auto-sync-scheduler.ts";
import { normalizeGoogleDriveItemId } from "@vcp/backend/modules/knowledge-base-rag/application/google-drive-id.ts";
import { KnowledgeSyncUseCases } from "@vcp/backend/modules/knowledge-base-rag/application/knowledge-sync-use-cases.ts";
import { toKnowledgeDataSourceDto } from "@vcp/backend/modules/knowledge-base-rag/application/dto-mappers.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

assert.equal(normalizeGoogleDriveItemId("raw_ID-123"), "raw_ID-123");
assert.equal(
  normalizeGoogleDriveItemId(
    "https://docs.google.com/document/d/182d96jUaHozp6IrL8Ne55-YmSQSePagGfy85y3t2W6g/edit?tab=t.0"
  ),
  "182d96jUaHozp6IrL8Ne55-YmSQSePagGfy85y3t2W6g"
);
assert.equal(
  normalizeGoogleDriveItemId("https://drive.google.com/file/d/1FILE123/view"),
  "1FILE123"
);
assert.equal(
  normalizeGoogleDriveItemId(
    "https://drive.google.com/drive/folders/1ABCDEF123?usp=sharing"
  ),
  "1ABCDEF123"
);
assert.equal(
  normalizeGoogleDriveItemId(
    "182d96jUaHozp6IrL8Ne55-YmSQSePagGfy85y3t2W6g/edit?tab=t.0"
  ),
  "182d96jUaHozp6IrL8Ne55-YmSQSePagGfy85y3t2W6g"
);
assert.throws(() => normalizeGoogleDriveItemId(""), /valid Google Drive/);
assert.throws(() => normalizeGoogleDriveItemId("https://example.test/not-drive"), /valid Google Drive/);

const now = "2026-07-05T00:00:00.000Z";
const dataSourceRepository = new InMemoryKnowledgeDataSourceRepository();
const syncScopeRepository = new InMemoryKnowledgeSyncScopeRepository();
const syncJobRepository = new InMemoryKnowledgeSyncJobRepository();
await dataSourceRepository.saveDataSource({
  sourceId: "source-drive",
  workspaceId: "workspace-a",
  provider: "google_drive",
  displayName: "Google Drive",
  connectionStatus: "connected",
  selectedScopeNodeCount: 1,
  connectedByUserId: "user-a",
  safeMetadata: {},
  createdAt: now,
  updatedAt: now
});
await syncScopeRepository.saveSyncScopeNodes("workspace-a", [
  {
    scopeNodeId: "scope-file",
    workspaceId: "workspace-a",
    sourceId: "source-drive",
    externalId: "file-a",
    nodeType: "file",
    displayName: "File file-a",
    selected: true,
    selectable: true,
    createdAt: now,
    updatedAt: now
  }
]);
const queued = [];
let jobSequence = 0;
const syncUseCases = new KnowledgeSyncUseCases({
  dataSourceRepository,
  syncScopeRepository,
  syncJobRepository,
  now: () => now,
  generateJobId: () => `auto-job-${++jobSequence}`,
  enqueueSyncJob: async (input) => queued.push(input)
});

const defaultSource = await dataSourceRepository.getDataSourceById(
  "workspace-a",
  "source-drive"
);
assert.equal(toKnowledgeDataSourceDto(defaultSource).autoSyncEnabled, false);
const configured = await syncUseCases.configureGoogleDriveAutoSync(
  "workspace-a",
  "source-drive",
  { autoSyncEnabled: true, autoSyncFrequency: "hourly" }
);
assert.equal(configured.autoSyncEnabled, true);
assert.equal(configured.autoSyncFrequency, "hourly");
assert.equal(configured.nextAutoSyncAt, "2026-07-05T01:00:00.000Z");

const source = await dataSourceRepository.getDataSourceById(
  "workspace-a",
  "source-drive"
);
await dataSourceRepository.saveDataSource({
  ...source,
  safeMetadata: { ...source.safeMetadata, nextAutoSyncAt: "2026-07-04T23:00:00.000Z" }
});
const scheduler = new GoogleDriveAutoSyncScheduler({
  dataSourceRepository,
  syncUseCases,
  now: () => now,
  pollIntervalMs: 60_000
});
assert.equal(await scheduler.tick(), 1);
assert.equal(queued.length, 1);
const scheduledJob = (
  await syncJobRepository.listSyncJobs("workspace-a", {
    sourceId: "source-drive"
  })
).items[0];
assert.equal(scheduledJob.safeSummary.syncMode, "scheduled");
assert.equal(await scheduler.tick(), 0, "overlapping scheduled job is not created");

await dataSourceRepository.saveDataSource({
  sourceId: "source-empty",
  workspaceId: "workspace-a",
  provider: "google_drive",
  displayName: "Empty Drive",
  connectionStatus: "connected",
  selectedScopeNodeCount: 0,
  connectedByUserId: "user-a",
  safeMetadata: {},
  createdAt: now,
  updatedAt: now
});
await assert.rejects(
  () =>
    syncUseCases.configureGoogleDriveAutoSync(
      "workspace-a",
      "source-empty",
      { autoSyncEnabled: true, autoSyncFrequency: "daily" }
    ),
  /Add a Google Drive file or folder scope/
);
assert.equal(JSON.stringify(configured).match(/token|secret|credential/i), null);

console.log("knowledge-base-rag Google Drive automatic sync checks passed");
