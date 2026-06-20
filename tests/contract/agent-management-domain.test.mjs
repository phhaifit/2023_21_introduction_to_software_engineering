import assert from "node:assert/strict";

import {
  AGENT_PUBLIC_SUMMARY_FIELDS,
  SELECTABLE_AGENT_STATUSES
} from "../../shared/contracts/agent-management.ts";
import {
  createAgent,
  isAgentSelectable,
  toAgentPublicSummary
} from "../../backend/src/modules/agent-management/domain/agent.ts";
import { InMemoryAgentRepository } from "../../backend/src/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";

function makeAgent(overrides = {}) {
  return createAgent({
    agentId: "agent-1",
    workspaceId: workspaceA,
    name: "Research Agent",
    role: "Researcher",
    model: "gpt-4.1-mini",
    instructions: "Collect and summarize market data.",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  });
}

assert.deepEqual(AGENT_PUBLIC_SUMMARY_FIELDS, [
  "agentId",
  "workspaceId",
  "name",
  "role",
  "model",
  "status",
  "updatedAt"
]);
assert.deepEqual(SELECTABLE_AGENT_STATUSES, ["enabled"]);

const enabledAgent = makeAgent();
const disabledAgent = makeAgent({ agentId: "agent-2", status: "disabled" });
const deletedAgent = makeAgent({ agentId: "agent-3", status: "deleted" });

assert.equal(enabledAgent.status, "enabled");
assert.equal(isAgentSelectable(enabledAgent), true);
assert.equal(isAgentSelectable(disabledAgent), false);
assert.equal(isAgentSelectable(deletedAgent), false);

const summary = toAgentPublicSummary(enabledAgent);
assert.deepEqual(Object.keys(summary), [...AGENT_PUBLIC_SUMMARY_FIELDS]);
assert.equal(summary.agentId, enabledAgent.agentId);
assert.equal(summary.workspaceId, enabledAgent.workspaceId);
assert.equal(summary.name, enabledAgent.name);
assert.equal(summary.role, enabledAgent.role);
assert.equal(summary.model, enabledAgent.model);
assert.equal(summary.status, enabledAgent.status);
assert.equal(summary.updatedAt, enabledAgent.updatedAt);
assert.equal("instructions" in summary, false);
assert.equal("createdAt" in summary, false);

const repository = new InMemoryAgentRepository();
await repository.save(enabledAgent);
await repository.save(disabledAgent);
await repository.save(makeAgent({ agentId: "agent-4", workspaceId: workspaceB }));

assert.equal(await repository.existsByName(workspaceA, " research agent "), true);
assert.equal(await repository.existsByName(workspaceB, "research agent"), true);
assert.equal(await repository.existsByName("workspace-c", "research agent"), false);

const found = await repository.findById(workspaceA, enabledAgent.agentId);
assert.deepEqual(found, enabledAgent);

const wrongWorkspace = await repository.findById(workspaceB, enabledAgent.agentId);
assert.equal(wrongWorkspace, null);

const workspaceAgents = await repository.listByWorkspace(workspaceA);
assert.deepEqual(
  workspaceAgents.map((agent) => agent.agentId),
  ["agent-1", "agent-2"]
);

const enabledWorkspaceAgents = await repository.listByWorkspace(workspaceA, {
  statuses: ["enabled"]
});
assert.deepEqual(
  enabledWorkspaceAgents.map((agent) => agent.agentId),
  ["agent-1"]
);

found.name = "Mutated name";
const foundAgain = await repository.findById(workspaceA, enabledAgent.agentId);
assert.equal(foundAgain.name, enabledAgent.name);

console.log("agent management domain checks passed");
