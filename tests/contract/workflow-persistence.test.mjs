import assert from "node:assert/strict";
import { createWorkflow, createWorkflowStep } from "@vcp/backend/modules/workflow-management/domain/workflow.ts";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set — skipping WorkflowRepository integration tests");
  process.exit(0);
}

const { PrismaClient, PrismaPg } = await import("@vcp/database");
const pg = await import("pg");
const { PrismaWorkflowRepository } = await import(
  "@vcp/backend/modules/workflow-management/infrastructure/prisma-workflow-repository.ts"
);

const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTests() {
  const repository = new PrismaWorkflowRepository(prisma);
  const workspaceId = `test-ws-${Date.now()}`;
  
  // Create workspace for foreign key
  await prisma.workspace.create({
    data: {
      workspaceId,
      userId: "test-user-1",
      name: "Test Workspace",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  });

  try {
    const workflowId = `wf-${Date.now()}`;
    const workflow = createWorkflow(workflowId, workspaceId, "My test workflow");
    
    workflow.steps.push(createWorkflowStep(
      `step-1-${Date.now()}`,
      workspaceId,
      workflowId,
      "agt-1",
      "agent",
      1
    ));

    workflow.steps.push(createWorkflowStep(
      `step-2-${Date.now()}`,
      workspaceId,
      workflowId,
      "agt-2",
      "agent",
      2
    ));

    // Test Save
    await repository.save(workflow);
    console.log("Passed: Save workflow");

    // Test findById
    const fetched = await repository.findById(workspaceId, workflowId);
    assert.ok(fetched !== null);
    assert.equal(fetched.name, "My test workflow");
    assert.equal(fetched.steps.length, 2);
    assert.equal(fetched.steps[0].agentId, "agt-1");
    assert.equal(fetched.steps[1].agentId, "agt-2");
    console.log("Passed: findById workflow");

    // Test findById wrong workspace
    const notFound = await repository.findById("wrong-ws", workflowId);
    assert.equal(notFound, null);
    console.log("Passed: findById wrong workspace returns null");

    // Test Update (remove a step)
    workflow.name = "Updated name";
    workflow.steps.pop(); // remove second step
    await repository.save(workflow);
    
    const fetchedUpdated = await repository.findById(workspaceId, workflowId);
    assert.ok(fetchedUpdated !== null);
    assert.equal(fetchedUpdated.name, "Updated name");
    assert.equal(fetchedUpdated.steps.length, 1);
    console.log("Passed: Update workflow (delete steps)");

    // Test listByWorkspace
    const listResult = await repository.listByWorkspace(workspaceId);
    assert.equal(listResult.total, 1);
    assert.equal(listResult.items.length, 1);
    assert.equal(listResult.items[0].name, "Updated name");
    console.log("Passed: listByWorkspace");

  } finally {
    // Cleanup
    await prisma.workflowStep.deleteMany({ where: { workspaceId } });
    await prisma.workflow.deleteMany({ where: { workspaceId } });
    await prisma.workspace.delete({ where: { workspaceId } });
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed", err);
  process.exit(1);
});
