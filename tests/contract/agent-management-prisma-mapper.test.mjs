import assert from "node:assert/strict";

import { toDomain, toPrismaCreate } from "@vcp/backend/modules/agent-management/infrastructure/prisma-agent-mapper.ts";

const prismaRecord = {
  agentId: "agent-1",
  workspaceId: "workspace-a",
  name: "Research Agent",
  role: "Researcher",
  model: "gpt-4.1-mini",
  instructions: "Collect and summarize market data.",
  status: "enabled",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T01:00:00.000Z"
};

const domainAgent = {
  agentId: "agent-1",
  workspaceId: "workspace-a",
  name: "Research Agent",
  role: "Researcher",
  model: "gpt-4.1-mini",
  instructions: "Collect and summarize market data.",
  status: "enabled",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T01:00:00.000Z"
};

// toDomain converts Prisma record to domain Agent
const converted = toDomain(prismaRecord);
assert.deepEqual(converted, domainAgent);
assert.equal(converted.agentId, "agent-1");
assert.equal(converted.workspaceId, "workspace-a");
assert.equal(converted.status, "enabled");

// toPrismaCreate converts domain Agent to Prisma input
const prismaInput = toPrismaCreate(domainAgent);
assert.deepEqual(prismaInput, prismaRecord);
assert.equal(prismaInput.agentId, "agent-1");
assert.equal(prismaInput.workspaceId, "workspace-a");

// Round-trip: toDomain(toPrismaCreate(agent)) === agent
const roundTrip = toDomain(toPrismaCreate(domainAgent));
assert.deepEqual(roundTrip, domainAgent);

// Status values are preserved
for (const status of ["enabled", "disabled", "deleted"]) {
  const record = { ...prismaRecord, status };
  const agent = toDomain(record);
  assert.equal(agent.status, status);

  const back = toPrismaCreate(agent);
  assert.equal(back.status, status);
}

console.log("prisma agent mapper checks passed");
