import assert from "node:assert/strict";
import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";
import { createAgent } from "@vcp/backend/modules/agent-management/domain/agent.ts";

const repository = new InMemoryAgentRepository();
const workspaceA = "workspace-a";

function makeAgent(overrides = {}) {
  return createAgent({
    agentId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: workspaceA,
    name: "Test Agent",
    role: "Tester",
    model: "gpt-4.1-mini",
    instructions: "Run tests.",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  });
}

async function runTests() {
  // Setup 5 agents for pagination, sort, search
  const agents = [
    makeAgent({ agentId: "a1", name: "Apple", role: "Developer", createdAt: "2026-06-20T01:00:00.000Z", updatedAt: "2026-06-20T05:00:00.000Z", status: "enabled" }),
    makeAgent({ agentId: "a2", name: "Banana", role: "Developer", createdAt: "2026-06-20T02:00:00.000Z", updatedAt: "2026-06-20T04:00:00.000Z", status: "disabled" }),
    makeAgent({ agentId: "a3", name: "Cherry", role: "Designer", createdAt: "2026-06-20T03:00:00.000Z", updatedAt: "2026-06-20T03:00:00.000Z", status: "enabled" }),
    makeAgent({ agentId: "a4", name: "Date", role: "Manager", createdAt: "2026-06-20T04:00:00.000Z", updatedAt: "2026-06-20T02:00:00.000Z", status: "deleted" }),
    makeAgent({ agentId: "a5", name: "Elderberry", role: "Designer", createdAt: "2026-06-20T05:00:00.000Z", updatedAt: "2026-06-20T01:00:00.000Z", status: "enabled" })
  ];

  for (const a of agents) {
    await repository.save(a);
  }

  // countByWorkspace
  const totalCount = await repository.countByWorkspace(workspaceA);
  assert.equal(totalCount, 5, "Should count 5 agents total");
  
  const enabledCount = await repository.countByWorkspace(workspaceA, { statuses: ["enabled"] });
  assert.equal(enabledCount, 3, "Should count 3 enabled agents");

  // Pagination defaults
  const list1 = await repository.listByWorkspace(workspaceA);
  assert.equal(list1.total, 5);
  assert.equal(list1.agents.length, 5);
  assert.equal(list1.agents[0].agentId, "a1", "Default sort is createdAt asc");

  // Custom page/pageSize
  const list2 = await repository.listByWorkspace(workspaceA, { page: 2, pageSize: 2 });
  assert.equal(list2.total, 5);
  assert.equal(list2.agents.length, 2);
  assert.equal(list2.agents[0].agentId, "a3");
  assert.equal(list2.agents[1].agentId, "a4");

  // Search
  const searchList = await repository.listByWorkspace(workspaceA, { search: "sign" }); // "Designer"
  assert.equal(searchList.total, 2);
  assert.equal(searchList.agents.length, 2);
  assert.equal(searchList.agents[0].agentId, "a3");
  assert.equal(searchList.agents[1].agentId, "a5");

  // Sort
  const sortListDesc = await repository.listByWorkspace(workspaceA, { sortBy: "name", sortOrder: "desc" });
  assert.equal(sortListDesc.agents[0].agentId, "a5");
  assert.equal(sortListDesc.agents[4].agentId, "a1");

  console.log("InMemoryAgentRepository query tests passed");
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
