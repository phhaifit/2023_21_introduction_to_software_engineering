import assert from "node:assert/strict";
import { validateWorkflowAgents, WorkflowValidationError } from "@vcp/backend/modules/workflow-management/domain/workflow-validation.ts";

const workspaceId = "ws-1";

const mockProvider = async (ws, ids) => {
  return ids.map(id => {
    if (id === "agt-missing") return null;
    return {
      agentId: id,
      workspaceId: ws,
      name: "Mock Agent",
      role: "Role",
      model: "Model",
      status: id.startsWith("agt-disabled") ? "disabled" : id.startsWith("agt-deleted") ? "deleted" : "enabled",
      updatedAt: ""
    };
  }).filter(Boolean);
};

// Test 1: All referenced agents are enabled
const happySteps = [
  { workflowStepId: "step-1", workspaceId, workflowId: "wf-1", agentId: "agt-ok-1", stepOrder: 1 },
  { workflowStepId: "step-2", workspaceId, workflowId: "wf-1", agentId: "agt-ok-2", stepOrder: 2 }
];
await validateWorkflowAgents(workspaceId, happySteps, mockProvider);
console.log("Passed: All referenced agents are enabled");

// Test 2: An agent is missing
const missingSteps = [
  { workflowStepId: "step-1", workspaceId, workflowId: "wf-1", agentId: "agt-ok-1", stepOrder: 1 },
  { workflowStepId: "step-2", workspaceId, workflowId: "wf-1", agentId: "agt-missing", stepOrder: 2 }
];
try {
  await validateWorkflowAgents(workspaceId, missingSteps, mockProvider);
  assert.fail("Should have thrown error");
} catch (error) {
  assert.ok(error instanceof WorkflowValidationError);
  assert.deepEqual(error.missingAgents, ["agt-missing"]);
  assert.deepEqual(error.disabledAgents, []);
}
console.log("Passed: Throws error for missing agents");

// Test 3: An agent is disabled
const disabledSteps = [
  { workflowStepId: "step-1", workspaceId, workflowId: "wf-1", agentId: "agt-disabled-1", stepOrder: 1 }
];
try {
  await validateWorkflowAgents(workspaceId, disabledSteps, mockProvider);
  assert.fail("Should have thrown error");
} catch (error) {
  assert.ok(error instanceof WorkflowValidationError);
  assert.deepEqual(error.disabledAgents, ["agt-disabled-1"]);
  assert.deepEqual(error.missingAgents, []);
}
console.log("Passed: Throws error for disabled agents");

// Test 4: Empty steps
const emptySteps = [];
await validateWorkflowAgents(workspaceId, emptySteps, async () => { assert.fail("Provider should not be called"); });
console.log("Passed: Handles empty steps gracefully");

console.log("workflow validation checks passed");
