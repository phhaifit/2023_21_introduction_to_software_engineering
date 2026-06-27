import { test, describe } from "node:test";
import assert from "node:assert";
import { WorkflowUseCases } from "../../apps/backend/src/modules/workflow-management/application/workflow-use-cases.ts";
import { InMemoryWorkflowRepository } from "../../apps/backend/src/modules/workflow-management/infrastructure/in-memory-workflow-repository.ts";
import { InMemoryAgentRepository } from "../../apps/backend/src/modules/agent-management/infrastructure/in-memory-agent-repository.ts";
import { createAgent } from "../../apps/backend/src/modules/agent-management/domain/agent.ts";

describe("Workflow Execution Handoff", () => {
  test("successfully hands off workflow execution request", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const agentRepo = new InMemoryAgentRepository();
    
    let handedOffRequest = null;
    const mockHandoff = {
      async handoffExecution(request) {
        handedOffRequest = request;
      }
    };

    const agentProvider = async (workspaceId, agentIds) => {
      const result = await agentRepo.listByWorkspace(workspaceId, { limit: 100, offset: 0 });
      return result.agents.filter(a => agentIds.includes(a.agentId));
    };

    const useCases = new WorkflowUseCases(workflowRepo, agentProvider, mockHandoff);

    // Setup an agent
    const activeAgent = createAgent({
      agentId: "agt-1",
      workspaceId: "ws-1",
      name: "Test Agent",
      role: "tester",
      model: "gpt-4",
      status: "enabled",
      instructions: "test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await agentRepo.save(activeAgent);

    // Create a workflow with steps
    const createResult = await useCases.createWorkflow({
      workspaceId: "ws-1",
      name: "Test Execution Handoff",
      steps: [{ agentId: "agt-1", stepOrder: 1 }]
    });

    // Make workflow published
    await useCases.updateWorkflow({
      workspaceId: "ws-1",
      workflowId: createResult.workflow.workflowId,
      status: "published"
    });

    // Execute
    await useCases.executeWorkflow({
      workspaceId: "ws-1",
      workflowId: createResult.workflow.workflowId,
      triggeredBy: "user-1",
      inputData: { someInput: "data" }
    });

    // Verify
    assert.ok(handedOffRequest);
    assert.strictEqual(handedOffRequest.workflowId, createResult.workflow.workflowId);
    assert.strictEqual(handedOffRequest.workspaceId, "ws-1");
    assert.strictEqual(handedOffRequest.triggeredBy, "user-1");
    assert.deepStrictEqual(handedOffRequest.inputData, { someInput: "data" });
  });

  test("fails to execute inactive workflow", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const agentRepo = new InMemoryAgentRepository();
    
    const mockHandoff = {
      async handoffExecution() {
        assert.fail("Should not reach here");
      }
    };

    const agentProvider = async (workspaceId, agentIds) => {
      const result = await agentRepo.listByWorkspace(workspaceId, { limit: 100, offset: 0 });
      return result.agents.filter(a => agentIds.includes(a.agentId));
    };

    const useCases = new WorkflowUseCases(workflowRepo, agentProvider, mockHandoff);

    const activeAgent = createAgent({
      agentId: "agt-1",
      workspaceId: "ws-1",
      name: "Test Agent",
      role: "tester",
      model: "gpt-4",
      status: "enabled",
      instructions: "test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await agentRepo.save(activeAgent);

    const createResult = await useCases.createWorkflow({
      workspaceId: "ws-1",
      name: "Draft Workflow",
      steps: [{ agentId: "agt-1", stepOrder: 1 }]
    });

    // Try executing without activating (status is Draft by default)
    try {
      await useCases.executeWorkflow({
        workspaceId: "ws-1",
        workflowId: createResult.workflow.workflowId,
        triggeredBy: "user-1"
      });
      assert.fail("Expected error was not thrown");
    } catch (err) {
      assert.strictEqual(err.message, "Cannot execute inactive workflow");
    }
  });

  test("fails to execute workflow with no steps", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const agentRepo = new InMemoryAgentRepository();
    
    const mockHandoff = {
      async handoffExecution() {
        assert.fail("Should not reach here");
      }
    };

    const agentProvider = async (workspaceId, agentIds) => {
      const result = await agentRepo.listByWorkspace(workspaceId, { limit: 100, offset: 0 });
      return result.agents.filter(a => agentIds.includes(a.agentId));
    };

    const useCases = new WorkflowUseCases(workflowRepo, agentProvider, mockHandoff);

    const createResult = await useCases.createWorkflow({
      workspaceId: "ws-1",
      name: "Empty Workflow",
      steps: []
    });

    // Make published
    await useCases.updateWorkflow({
      workspaceId: "ws-1",
      workflowId: createResult.workflow.workflowId,
      status: "published"
    });

    try {
      await useCases.executeWorkflow({
        workspaceId: "ws-1",
        workflowId: createResult.workflow.workflowId,
        triggeredBy: "user-1"
      });
      assert.fail("Expected error was not thrown");
    } catch (err) {
      assert.strictEqual(err.message, "Cannot execute workflow with no steps");
    }
  });
});
