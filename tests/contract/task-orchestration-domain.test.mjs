import assert from "node:assert/strict";

import {
  createTask,
  TaskValidationError
} from "@vcp/backend/modules/task-orchestration/domain/task.ts";
import {
  createInitialTaskWork,
  TaskWorkValidationError
} from "@vcp/backend/modules/task-orchestration/domain/task-work.ts";
import {
  parseTaskRoutingSelection,
  TaskRoutingValidationError
} from "@vcp/backend/modules/task-orchestration/domain/routing-validation.ts";

const workspaceId = "workspace-a";
const userId = "user-123";
const taskId = "task-001";
const workId = "work-001";
const timestamp = "2026-06-23T12:00:00.000Z";

// ==== Task Creation Tests ====

// Valid task creation
{
  const task = createTask({
    taskId,
    workspaceId,
    submittedByUserId: userId,
    prompt: "Analyze this data",
    routing: { mode: "auto" },
    createdAt: timestamp,
    updatedAt: timestamp
  });

  assert.equal(task.taskId, taskId);
  assert.equal(task.workspaceId, workspaceId);
  assert.equal(task.submittedByUserId, userId);
  assert.equal(task.prompt, "Analyze this data");
  assert.equal(task.status, "queued");
  assert.equal(task.createdAt, timestamp);
  assert.equal(task.updatedAt, timestamp);
  assert.deepEqual(task.requestedRouting, { mode: "auto" });
}

// Prompt trimmed, identities and routing preserved
{
  const workspace2 = "workspace-b";
  const user2 = "user-456";
  const agentId = "agent-001";
  const task = createTask({
    taskId: "task-002",
    workspaceId: workspace2,
    submittedByUserId: user2,
    prompt: "   Analyze this data   ",
    routing: { mode: "specific-agent", agentId },
    createdAt: timestamp,
    updatedAt: timestamp
  });

  assert.equal(task.prompt, "Analyze this data");
  assert.equal(task.workspaceId, workspace2);
  assert.equal(task.submittedByUserId, user2);
  assert.equal(task.status, "queued");
  assert.deepEqual(task.requestedRouting, { mode: "specific-agent", agentId });
}

// Workflow routing and timestamp preservation
{
  const workflowId = "workflow-001";
  const createdAt2 = "2026-06-20T10:00:00.000Z";
  const updatedAt2 = "2026-06-20T10:00:00.000Z";
  const task = createTask({
    taskId: "task-003",
    workspaceId,
    submittedByUserId: userId,
    prompt: "Use workflow",
    routing: { mode: "predefined-workflow", workflowId },
    createdAt: createdAt2,
    updatedAt: updatedAt2
  });

  assert.equal(task.createdAt, createdAt2);
  assert.equal(task.updatedAt, updatedAt2);
  assert.deepEqual(task.requestedRouting, { mode: "predefined-workflow", workflowId });
}

// Prompt validation: empty, whitespace-only, and missing identities rejected
{
  assert.throws(
    () =>
      createTask({
        taskId,
        workspaceId,
        submittedByUserId: userId,
        prompt: "",
        routing: { mode: "auto" },
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskValidationError
  );

  assert.throws(
    () =>
      createTask({
        taskId,
        workspaceId,
        submittedByUserId: userId,
        prompt: "   \t  \n   ",
        routing: { mode: "auto" },
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskValidationError
  );

  // Missing identities
  assert.throws(
    () =>
      createTask({
        taskId: "",
        workspaceId,
        submittedByUserId: userId,
        prompt: "Valid",
        routing: { mode: "auto" },
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskValidationError
  );

  assert.throws(
    () =>
      createTask({
        taskId,
        workspaceId: "",
        submittedByUserId: userId,
        prompt: "Valid",
        routing: { mode: "auto" },
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskValidationError
  );

  assert.throws(
    () =>
      createTask({
        taskId,
        workspaceId,
        submittedByUserId: "",
        prompt: "Valid",
        routing: { mode: "auto" },
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskValidationError
  );
}

// Routing parsing: valid modes, canonical objects, and rejection
{
  // Valid modes return canonical fresh objects
  const autoRoute = parseTaskRoutingSelection({ mode: "auto" });
  assert.deepEqual(autoRoute, { mode: "auto" });

  const agentRoute = parseTaskRoutingSelection({ mode: "specific-agent", agentId: "agent-001" });
  assert.deepEqual(agentRoute, { mode: "specific-agent", agentId: "agent-001" });

  const workflowRoute = parseTaskRoutingSelection({ mode: "predefined-workflow", workflowId: "workflow-001" });
  assert.deepEqual(workflowRoute, { mode: "predefined-workflow", workflowId: "workflow-001" });

  // Invalid modes and missing targets
  assert.throws(() => parseTaskRoutingSelection({ mode: "unknown" }), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection({ mode: "specific-agent" }), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection({ mode: "predefined-workflow" }), TaskRoutingValidationError);

  // Auto cannot have targets; others cannot have incompatible targets
  assert.throws(() => parseTaskRoutingSelection({ mode: "auto", agentId: "agent-001" }), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection({ mode: "auto", workflowId: "workflow-001" }), TaskRoutingValidationError);
  assert.throws(
    () => parseTaskRoutingSelection({ mode: "specific-agent", agentId: "agent-001", workflowId: "workflow-001" }),
    TaskRoutingValidationError
  );
  assert.throws(
    () => parseTaskRoutingSelection({ mode: "predefined-workflow", workflowId: "workflow-001", agentId: "agent-001" }),
    TaskRoutingValidationError
  );

  // Invalid value types
  assert.throws(() => parseTaskRoutingSelection(null), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection(undefined), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection([]), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection("auto"), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection(42), TaskRoutingValidationError);

  // Empty-string IDs rejected
  assert.throws(() => parseTaskRoutingSelection({ mode: "specific-agent", agentId: "" }), TaskRoutingValidationError);
  assert.throws(() => parseTaskRoutingSelection({ mode: "predefined-workflow", workflowId: "" }), TaskRoutingValidationError);
}

// Routing normalization: caller aliasing prevented
{
  const callerRouting = { mode: "auto", extraProp: "should not remain" };
  const parsed = parseTaskRoutingSelection(callerRouting);
  assert.deepEqual(parsed, { mode: "auto" });
  assert.equal("extraProp" in parsed, false);

  // Mutating caller routing after parsing does not mutate task
  const mutableRouting = { mode: "specific-agent", agentId: "agent-001" };
  const task = createTask({
    taskId,
    workspaceId,
    submittedByUserId: userId,
    prompt: "Test aliasing",
    routing: mutableRouting,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  mutableRouting.agentId = "agent-999";
  assert.equal(task.requestedRouting.agentId, "agent-001", "Task routing should not be affected by caller mutation");
}

// ==== TaskWork Creation Tests ====

// Valid initial TaskWork with all requirements
{
  const taskWork = createInitialTaskWork({
    workId,
    taskId,
    workspaceId,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  assert.equal(taskWork.workId, workId);
  assert.equal(taskWork.taskId, taskId);
  assert.equal(taskWork.workspaceId, workspaceId);
  assert.equal(taskWork.attemptNumber, 1);
  assert.equal(taskWork.status, "queued");
  assert.equal(taskWork.queuedAt, timestamp);
  assert.equal(taskWork.createdAt, timestamp);
  assert.equal(taskWork.updatedAt, timestamp);
  assert.equal(taskWork.resolvedRouting, null);
}

// IDs and workspace preserved, timestamps used
{
  const work2 = "work-002";
  const task2 = "task-002";
  const workspace2 = "workspace-b";
  const createdAt2 = "2026-06-20T10:00:00.000Z";
  const updatedAt2 = "2026-06-20T11:00:00.000Z";
  const taskWork = createInitialTaskWork({
    workId: work2,
    taskId: task2,
    workspaceId: workspace2,
    createdAt: createdAt2,
    updatedAt: updatedAt2
  });

  assert.equal(taskWork.workId, work2);
  assert.equal(taskWork.taskId, task2);
  assert.equal(taskWork.workspaceId, workspace2);
  assert.equal(taskWork.createdAt, createdAt2);
  assert.equal(taskWork.updatedAt, updatedAt2);
  assert.equal(taskWork.queuedAt, createdAt2);
  assert.equal(taskWork.resolvedRouting, null);
}

// Missing identities rejected
{
  assert.throws(
    () =>
      createInitialTaskWork({
        workId: "",
        taskId,
        workspaceId,
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskWorkValidationError
  );

  assert.throws(
    () =>
      createInitialTaskWork({
        workId,
        taskId: "",
        workspaceId,
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskWorkValidationError
  );

  assert.throws(
    () =>
      createInitialTaskWork({
        workId,
        taskId,
        workspaceId: "",
        createdAt: timestamp,
        updatedAt: timestamp
      }),
    TaskWorkValidationError
  );
}

console.log("task orchestration domain checks passed");
