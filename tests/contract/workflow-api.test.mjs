import assert from "node:assert/strict";
import express from "express";
import { createWorkflowManagementRouter } from "@vcp/backend/modules/workflow-management/api/workflow-router.ts";
import { WorkflowUseCases } from "@vcp/backend/modules/workflow-management/application/workflow-use-cases.ts";
import { createWorkflow, createWorkflowStep, toWorkflowSummary, toWorkflowStepDto } from "@vcp/backend/modules/workflow-management/domain/workflow.ts";
import { WorkflowValidationError } from "@vcp/backend/modules/workflow-management/domain/workflow-validation.ts";

// Mock Repository
class MockWorkflowRepository {
  workflows = new Map();

  async save(workflow) {
    this.workflows.set(workflow.workflowId, workflow);
  }

  async findById(workspaceId, workflowId) {
    const w = this.workflows.get(workflowId);
    if (w && w.workspaceId === workspaceId) return w;
    return null;
  }

  async listByWorkspace(workspaceId, options) {
    const items = Array.from(this.workflows.values()).filter(w => w.workspaceId === workspaceId);
    return { total: items.length, items };
  }
}

const mockAgentProvider = async (workspaceId, agentIds) => {
  return agentIds.map(agentId => {
    if (agentId === "valid-agent") {
      return { agentId, workspaceId, name: "Valid", role: "asssistant", status: "enabled" };
    }
    if (agentId === "disabled-agent") {
      return { agentId, workspaceId, name: "Disabled", role: "asssistant", status: "disabled" };
    }
    return null;
  }).filter(Boolean);
};

const repository = new MockWorkflowRepository();
const useCases = new WorkflowUseCases(repository, mockAgentProvider);

const app = express();
app.use(express.json());

// Mock Auth Middleware
app.use((req, res, next) => {
  if (req.header("Authorization") === "Bearer VALID") {
    req.context = {
      user: { userId: "user-1" },
      workspace: { workspaceId: "ws-1", role: "admin" }
    };
  } else if (req.header("Authorization") === "Bearer VIEWER") {
    req.context = {
      user: { userId: "user-2" },
      workspace: { workspaceId: "ws-1", role: "viewer" }
    };
  } else {
    req.context = {};
  }
  next();
});

app.use("/api/workspaces/:workspaceId/workflows", createWorkflowManagementRouter({ useCases }));

async function runTests() {
  console.log("Starting Workflow API Tests...");

  // Test 1: Unauthorized
  const res1 = await fetch("http://localhost:3333/api/workspaces/ws-1/workflows");
  assert.equal(res1.status, 401);
  console.log("Passed: 401 Unauthorized");

  // Test 2: Create Workflow (Happy Path)
  const res2 = await fetch("http://localhost:3333/api/workspaces/ws-1/workflows", {
    method: "POST",
    headers: { "Authorization": "Bearer VALID", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test API Workflow",
      steps: [{ agentId: "valid-agent", stepOrder: 1 }]
    })
  });
  if (res2.status !== 200) {
    console.error("Create failed:", await res2.text());
  }
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.ok(body2.ok);
  assert.equal(body2.data.workflow.name, "Test API Workflow");
  assert.equal(body2.data.steps.length, 1);
  const workflowId = body2.data.workflow.workflowId;
  console.log("Passed: Create workflow");

  // Test 3: Create Workflow (Validation Error - Missing Agent)
  const res3 = await fetch("http://localhost:3333/api/workspaces/ws-1/workflows", {
    method: "POST",
    headers: { "Authorization": "Bearer VALID", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bad Workflow",
      steps: [{ agentId: "missing-agent", stepOrder: 1 }]
    })
  });
  assert.equal(res3.status, 400);
  const body3 = await res3.json();
  assert.equal(body3.error.code, "validation.invalid_input");
  console.log("Passed: Create workflow validation error (missing agent)");

  // Test 4: Get Workflow
  const res4 = await fetch(`http://localhost:3333/api/workspaces/ws-1/workflows/${workflowId}`, {
    headers: { "Authorization": "Bearer VALID" }
  });
  assert.equal(res4.status, 200);
  const body4 = await res4.json();
  assert.equal(body4.data.workflow.workflowId, workflowId);
  console.log("Passed: Get workflow");

  // Test 5: List Workflows
  const res5 = await fetch(`http://localhost:3333/api/workspaces/ws-1/workflows`, {
    headers: { "Authorization": "Bearer VIEWER" }
  });
  assert.equal(res5.status, 200);
  const body5 = await res5.json();
  assert.equal(body5.data.length, 1);
  assert.equal(body5.pagination.total, 1);
  console.log("Passed: List workflows");

  // Test 6: Update Workflow (Forbidden for viewer)
  const res6 = await fetch(`http://localhost:3333/api/workspaces/ws-1/workflows/${workflowId}`, {
    method: "PATCH",
    headers: { "Authorization": "Bearer VIEWER", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacked" })
  });
  assert.equal(res6.status, 403);
  console.log("Passed: Update workflow forbidden");

  // Test 7: Update Workflow (Success)
  const res7 = await fetch(`http://localhost:3333/api/workspaces/ws-1/workflows/${workflowId}`, {
    method: "PATCH",
    headers: { "Authorization": "Bearer VALID", "Content-Type": "application/json" },
    body: JSON.stringify({ status: "published" })
  });
  assert.equal(res7.status, 200);
  const body7 = await res7.json();
  assert.strictEqual(body7.data.workflow.status, "published");
  console.log("Passed: Update workflow success");

  console.log("All API tests passed!");
}

const server = app.listen(3333, () => {
  runTests()
    .then(() => server.close())
    .catch((err) => {
      console.error(err);
      server.close();
      process.exit(1);
    });
});
