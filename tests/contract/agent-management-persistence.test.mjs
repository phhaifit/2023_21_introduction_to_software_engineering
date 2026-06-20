/**
 * Integration tests for PrismaAgentRepository.
 *
 * Requires a running PostgreSQL database and DATABASE_URL env var.
 * Run migrations first: DATABASE_URL="..." npx prisma migrate deploy
 *
 * Skip gracefully if DATABASE_URL is not set.
 */
import assert from "node:assert/strict";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set — skipping PrismaAgentRepository integration tests");
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const pg = await import("pg");
const { PrismaAgentRepository } = await import(
  "../../backend/src/modules/agent-management/infrastructure/prisma-agent-repository.ts"
);
const { createAgent } = await import(
  "../../backend/src/modules/agent-management/domain/agent.ts"
);

const Pool = pg.default ? pg.default.Pool : pg.Pool;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const repository = new PrismaAgentRepository(prisma);

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";

function makeAgent(overrides = {}) {
  return createAgent({
    agentId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: workspaceA,
    name: "Test Agent",
    role: "Tester",
    model: "gpt-4.1-mini",
    instructions: "Run tests and report results.",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  });
}

try {
  // Clean up before tests
  await prisma.agent.deleteMany({});

  // --- Test save: insert new agent ---
  {
    const agent = makeAgent({ agentId: "persist-test-1" });
    const saved = await repository.save(agent);
    assert.equal(saved.agentId, agent.agentId);
    assert.equal(saved.workspaceId, agent.workspaceId);
    assert.equal(saved.name, agent.name);
    assert.equal(saved.role, agent.role);
    assert.equal(saved.model, agent.model);
    assert.equal(saved.instructions, agent.instructions);
    assert.equal(saved.status, "enabled");

    // Verify in DB
    const row = await prisma.agent.findUnique({ where: { agentId: "persist-test-1" } });
    assert.ok(row, "Agent should exist in database after save");
    assert.equal(row.name, agent.name);
    console.log("  ✓ save: insert new agent");
  }

  // --- Test save: update existing agent ---
  {
    const agent = makeAgent({ agentId: "persist-test-2", name: "Original Name" });
    await repository.save(agent);

    const updated = { ...agent, name: "Updated Name", updatedAt: "2026-06-20T01:00:00.000Z" };
    const result = await repository.save(updated);
    assert.equal(result.name, "Updated Name");
    assert.equal(result.updatedAt, "2026-06-20T01:00:00.000Z");

    // Verify only one record exists
    const count = await prisma.agent.count({ where: { agentId: "persist-test-2" } });
    assert.equal(count, 1, "Upsert should not create duplicate records");
    console.log("  ✓ save: update existing agent");
  }

  // --- Test findById: agent in correct workspace ---
  {
    const agent = makeAgent({ agentId: "persist-test-3" });
    await repository.save(agent);

    const found = await repository.findById(workspaceA, "persist-test-3");
    assert.ok(found);
    assert.equal(found.agentId, "persist-test-3");
    assert.equal(found.workspaceId, workspaceA);
    assert.equal(found.name, agent.name);
    console.log("  ✓ findById: agent in correct workspace");
  }

  // --- Test findById: agent not found or wrong workspace ---
  {
    const agent = makeAgent({ agentId: "persist-test-4" });
    await repository.save(agent);

    const notExist = await repository.findById(workspaceA, "nonexistent-id");
    assert.equal(notExist, null);

    const wrongWorkspace = await repository.findById(workspaceB, "persist-test-4");
    assert.equal(wrongWorkspace, null);
    console.log("  ✓ findById: not found or wrong workspace returns null");
  }

  // --- Test listByWorkspace: correct workspace, ordered by createdAt ---
  {
    await prisma.agent.deleteMany({});

    const agent1 = makeAgent({
      agentId: "persist-test-5a",
      name: "Agent First",
      createdAt: "2026-06-20T01:00:00.000Z"
    });
    const agent2 = makeAgent({
      agentId: "persist-test-5b",
      name: "Agent Second",
      createdAt: "2026-06-20T02:00:00.000Z"
    });
    const agentOther = makeAgent({
      agentId: "persist-test-5c",
      name: "Other Workspace Agent",
      workspaceId: workspaceB,
      createdAt: "2026-06-20T00:30:00.000Z"
    });
    await repository.save(agent1);
    await repository.save(agent2);
    await repository.save(agentOther);

    const list = await repository.listByWorkspace(workspaceA);
    assert.equal(list.length, 2);
    assert.equal(list[0].agentId, "persist-test-5a");
    assert.equal(list[1].agentId, "persist-test-5b");
    console.log("  ✓ listByWorkspace: correct workspace, ordered by createdAt asc");
  }

  // --- Test listByWorkspace: filter by statuses ---
  {
    await prisma.agent.deleteMany({});

    const enabledAgent = makeAgent({ agentId: "persist-test-6a", status: "enabled" });
    const disabledAgent = makeAgent({ agentId: "persist-test-6b", status: "disabled" });
    const deletedAgent = makeAgent({ agentId: "persist-test-6c", status: "deleted" });
    await repository.save(enabledAgent);
    await repository.save(disabledAgent);
    await repository.save(deletedAgent);

    const enabledOnly = await repository.listByWorkspace(workspaceA, { statuses: ["enabled"] });
    assert.equal(enabledOnly.length, 1);
    assert.equal(enabledOnly[0].agentId, "persist-test-6a");

    const activeOnly = await repository.listByWorkspace(workspaceA, {
      statuses: ["enabled", "disabled"]
    });
    assert.equal(activeOnly.length, 2);
    assert.deepEqual(
      activeOnly.map((a) => a.agentId),
      ["persist-test-6a", "persist-test-6b"]
    );
    console.log("  ✓ listByWorkspace: filter by statuses");
  }

  // --- Test listByWorkspace: deleted agents excluded with active filter ---
  {
    await prisma.agent.deleteMany({});

    const active = makeAgent({ agentId: "persist-test-7a", status: "enabled" });
    const deleted = makeAgent({ agentId: "persist-test-7b", status: "deleted" });
    await repository.save(active);
    await repository.save(deleted);

    const result = await repository.listByWorkspace(workspaceA, {
      statuses: ["enabled", "disabled"]
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].agentId, "persist-test-7a");
    console.log("  ✓ listByWorkspace: deleted agents excluded with active filter");
  }

  // --- Test existsByName: exact, case-insensitive, not found, cross-workspace ---
  {
    await prisma.agent.deleteMany({});

    const agent = makeAgent({ agentId: "persist-test-8", name: "Research Agent" });
    await repository.save(agent);

    // Exact match
    assert.equal(await repository.existsByName(workspaceA, "Research Agent"), true);

    // Case-insensitive match
    assert.equal(await repository.existsByName(workspaceA, "research agent"), true);
    assert.equal(await repository.existsByName(workspaceA, "RESEARCH AGENT"), true);

    // Trimmed match
    assert.equal(await repository.existsByName(workspaceA, "  Research Agent  "), true);

    // Name not found
    assert.equal(await repository.existsByName(workspaceA, "Nonexistent Agent"), false);

    // Same name in different workspace
    assert.equal(await repository.existsByName(workspaceB, "Research Agent"), false);

    console.log("  ✓ existsByName: exact, case-insensitive, trim, not-found, cross-workspace");
  }

  console.log("prisma agent repository integration tests passed");
} finally {
  await prisma.$disconnect();
}
