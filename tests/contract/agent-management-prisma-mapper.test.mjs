import assert from "node:assert/strict";

import { toDomain, toPrismaCreate } from "@vcp/backend/modules/agent-management/infrastructure/prisma-agent-mapper.ts";

const prismaRecord = {
  agentId: "agent-1",
  workspaceId: "workspace-a",
  name: "Research Agent",
  role: "Researcher",
  model: "gpt-4.1-mini",
  instructions: "Collect and summarize market data.",
  runtimeConfig: null,
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
  runtimeConfiguration: {
    responsibilities: [],
    operatingContext: undefined,
    requestedTools: [],
    requestedKnowledge: [],
    constraints: [],
    escalationRules: [],
    exampleTasks: []
  },
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
assert.deepEqual(prismaInput, {
  ...prismaRecord,
  runtimeConfig: domainAgent.runtimeConfiguration
});
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

const richRecord = {
  ...prismaRecord,
  runtimeConfig: {
    responsibilities: ["Answer support questions"],
    operatingContext: "Use approved workspace context.",
    requestedTools: [{ name: "Slack", reason: "Notify owners" }],
    requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
    constraints: ["Do not expose account details"],
    escalationRules: ["Escalate billing issues"],
    exampleTasks: ["Draft a support reply"],
    provider: { rawProvider: "must be ignored" }
  }
};

const richAgent = toDomain(richRecord);
assert.deepEqual(richAgent.runtimeConfiguration, {
  responsibilities: ["Answer support questions"],
  operatingContext: "Use approved workspace context.",
  requestedTools: [{ name: "Slack", reason: "Notify owners" }],
  requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
  constraints: ["Do not expose account details"],
  escalationRules: ["Escalate billing issues"],
  exampleTasks: ["Draft a support reply"]
});
assert.deepEqual(toPrismaCreate(richAgent).runtimeConfig, richAgent.runtimeConfiguration);

console.log("prisma agent mapper checks passed");
