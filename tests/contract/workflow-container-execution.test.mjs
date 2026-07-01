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
