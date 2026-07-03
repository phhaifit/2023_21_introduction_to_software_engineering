import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowExecutionService, buildStepPrompt } from "../../apps/backend/src/modules/task-orchestration/application/workflow-execution-service.ts";
import { InMemoryWorkflowRepository } from "../../apps/backend/src/modules/workflow-management/infrastructure/in-memory-workflow-repository.ts";
import { createWorkflow, createWorkflowStep } from "../../apps/backend/src/modules/workflow-management/domain/workflow.ts";
import { FileSystemOpenClawWorkflowMaterializer } from "../../apps/backend/src/features/task-execution/adapters/openclaw-workflow-materializer.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("buildStepPrompt keeps only runtime input for container-backed agent calls", () => {
  assert.equal(buildStepPrompt({ prompt: "Summarize AI trends" }), "Summarize AI trends");
  assert.equal(buildStepPrompt({ previousOutput: "facts" }), "previousOutput: facts");
});

test("workflow execution sends one OpenClaw request per materialized agent step", async () => {
  const baseDir = await mkdtemp(join(tmpdir(), "workflow-container-exec-"));
  const workflowRepo = new InMemoryWorkflowRepository();
  const workflowId = "wf_test";
  const workspaceId = "ws-1";

  const workflow = createWorkflow(
    workflowId,
    workspaceId,
    "Container Workflow",
    null,
    "manual",
    null,
    [
      createWorkflowStep("wfs_1", workspaceId, workflowId, "agt-1", "agent", 1),
      createWorkflowStep("wfs_2", workspaceId, workflowId, "agt-2", "agent", 2)
    ]
  );
  workflow.status = "published";
  await workflowRepo.save(workflow);

  const workflowMaterializer = new FileSystemOpenClawWorkflowMaterializer(baseDir, () => "2026-01-01T00:00:00.000Z");
  let openClawCallCount = 0;
  const orchestrator = {
    adapter: {
      subscribe(taskId, callback) {
        queueMicrotask(() => {
          callback({
            type: "step-started",
            taskId,
            stepId: "wfs_1",
            stepName: "Step 1",
            timestamp: "2026-01-01T00:00:01Z"
          });
          callback({
            type: "step-completed",
            taskId,
            stepId: "wfs_1",
            result: "Research complete",
            timestamp: "2026-01-01T00:00:02Z"
          });
          callback({
            type: "step-started",
            taskId,
            stepId: "wfs_2",
            stepName: "Step 2",
            timestamp: "2026-01-01T00:00:03Z"
          });
          callback({
            type: "step-completed",
            taskId,
            stepId: "wfs_2",
            result: "Final article",
            timestamp: "2026-01-01T00:00:04Z"
          });
        });
      },
      unsubscribe(taskId, callback) {}
    },
    agentCatalog: {
      async validateAndGetAgent(_workspaceId, agentId) {
        return {
          agentId,
          workspaceId,
          providerAgentMapping: `openclaw/agent/${agentId}`,
          status: "active",
          openClawAgentId: agentId
        };
      }
    },
    async execute10StepStartFlow(_context, command) {
      openClawCallCount += 1;
      return { taskId: command.taskId, status: "pending", binding: {} };
    },
    async getExposedState(taskId) {
      return {
        status: "completed",
        events: [
          {
            type: "execution-completed",
            taskId,
            timestamp: "2026-01-01T00:00:01Z",
            finalOutput: "Final article"
          }
        ]
      };
    },
    async forwardCancellation() {}
  };

  const service = new WorkflowExecutionService(
    workflowRepo,
    orchestrator,
    { async publish() {} },
    workflowMaterializer
  );

  try {
    await service.handoffExecution({
      workflowId,
      workspaceId,
      executionId: "wfe_1",
      triggeredBy: "user-1",
      triggerType: "manual",
      inputData: { prompt: "Write about AI" }
    });

    assert.equal(openClawCallCount, 1);

    const materialized = await workflowMaterializer.getMaterializedWorkflow(workspaceId, workflowId);
    assert.ok(materialized);
    assert.equal(materialized.steps.length, 2);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("WorkflowExecutionService handleAutoRoutedWorkflowEvent tracks logs for auto-routed workflows", async () => {
  const baseDir = await mkdtemp(join(tmpdir(), "workflow-auto-exec-"));
  const workflowRepo = new InMemoryWorkflowRepository();
  const workflowId = "wf_auto_test";
  const workspaceId = "ws-2";

  const workflow = createWorkflow(
    workflowId,
    workspaceId,
    "Auto Routed Workflow",
    null,
    "manual",
    null,
    [
      createWorkflowStep("wfs_auto_1", workspaceId, workflowId, "agt-1", "agent", 1)
    ]
  );
  workflow.status = "published";
  await workflowRepo.save(workflow);

  const workflowMaterializer = new FileSystemOpenClawWorkflowMaterializer(baseDir, () => "2026-01-01T00:00:00.000Z");
  const orchestrator = {
    agentCatalog: {
      async validateAndGetAgent(_workspaceId, agentId) {
        return { agentId, workspaceId, providerAgentMapping: `openclaw/agent/${agentId}`, status: "active" };
      }
    }
  };

  const publishedEvents = [];
  const eventBus = {
    async publish(event) {
      publishedEvents.push(event);
    }
  };

  const service = new WorkflowExecutionService(
    workflowRepo,
    orchestrator,
    eventBus,
    workflowMaterializer
  );

  try {
    const taskId = "task_auto_1";
    const triggeredBy = "user-2";

    // 1. Send step-started event -> should trigger execution creation and step log creation
    await service.handleAutoRoutedWorkflowEvent(taskId, workspaceId, triggeredBy, {
      type: "step-started",
      taskId,
      stepId: "wfs_auto_1",
      stepName: "Step 1",
      timestamp: "2026-01-01T00:00:01Z"
    });

    const executions = await workflowRepo.listExecutions(workspaceId);
    assert.equal(executions.total, 1);
    assert.equal(executions.items[0].status, "Running");

    const logs = await workflowRepo.getExecutionLogs(workspaceId, executions.items[0].executionId);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, "Running");

    // 2. Send partial-output-received event
    await service.handleAutoRoutedWorkflowEvent(taskId, workspaceId, triggeredBy, {
      type: "partial-output-received",
      taskId,
      stepId: "wfs_auto_1",
      outputChunk: "Hello World",
      timestamp: "2026-01-01T00:00:02Z"
    });

    // 3. Send step-completed event
    await service.handleAutoRoutedWorkflowEvent(taskId, workspaceId, triggeredBy, {
      type: "step-completed",
      taskId,
      stepId: "wfs_auto_1",
      result: "Success",
      timestamp: "2026-01-01T00:00:03Z"
    });

    const updatedLogs = await workflowRepo.getExecutionLogs(workspaceId, executions.items[0].executionId);
    assert.equal(updatedLogs[0].status, "Success");
    assert.equal(updatedLogs[0].outputData?.text, "Hello World");

    // 4. Send execution-completed event
    await service.handleAutoRoutedWorkflowEvent(taskId, workspaceId, triggeredBy, {
      type: "execution-completed",
      taskId,
      timestamp: "2026-01-01T00:00:04Z",
      finalOutput: "All done"
    });

    const finalExecutions = await workflowRepo.listExecutions(workspaceId);
    assert.equal(finalExecutions.items[0].status, "Success");

    // Check published event names
    const eventNames = publishedEvents.map(e => e.name);
    assert.ok(eventNames.includes("workflow.execution_started"));
    assert.ok(eventNames.includes("workflow.step_started"));
    assert.ok(eventNames.includes("workflow.step_completed"));
    assert.ok(eventNames.includes("workflow.execution_completed"));

  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});
