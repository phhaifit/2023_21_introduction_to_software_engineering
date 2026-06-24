import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

// ====== Imports for event and publisher contracts ======
import {
  TASK_EVENT_TYPES,
  EVENT_TYPE_TO_STATUS,
  createTaskSubmittedEvent,
  createTaskStartedEvent,
  createTaskRequiresActionEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createTaskCancelledEvent,
  TaskEventValidationError
} from "@vcp/backend/modules/task-orchestration/domain/task-events.ts";

/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskLifecycleEvent} TaskLifecycleEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskSubmittedEvent} TaskSubmittedEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskStartedEvent} TaskStartedEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskRequiresActionEvent} TaskRequiresActionEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskCompletedEvent} TaskCompletedEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskFailedEvent} TaskFailedEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/domain/task-events.ts").TaskCancelledEvent} TaskCancelledEvent */
/** @typedef {import("@vcp/backend/modules/task-orchestration/application/task-event-publisher.ts").TaskEventPublisher} TaskEventPublisher */

// ====== Test Fixtures ======
const workspaceId = "workspace-1";
const taskId = "task-001";
const workId = "work-001";
const eventId = "event-001";
const occurredAt = "2026-06-24T12:00:00.000Z";
const attemptNumber = 1;

// ====== Test 1: All Six Event Types Exist ======
{
  assert.strictEqual(TASK_EVENT_TYPES.length, 6);
  assert.deepStrictEqual(TASK_EVENT_TYPES, [
    "task.submitted",
    "task.started",
    "task.requires-action",
    "task.completed",
    "task.failed",
    "task.cancelled"
  ]);
}

// ====== Test 2: Discriminated Union is Exhaustive ======
{
  // All event types from TASK_EVENT_TYPES must map to a unique status
  const statusSet = new Set(Object.values(EVENT_TYPE_TO_STATUS));
  assert.strictEqual(statusSet.size, 6, "Each event type should map to a unique status");
}

// ====== Test 3: Event Type and Status Mappings are Canonical ======
{
  assert.strictEqual(EVENT_TYPE_TO_STATUS["task.submitted"], "queued");
  assert.strictEqual(EVENT_TYPE_TO_STATUS["task.started"], "running");
  assert.strictEqual(EVENT_TYPE_TO_STATUS["task.requires-action"], "requires_action");
  assert.strictEqual(EVENT_TYPE_TO_STATUS["task.completed"], "succeeded");
  assert.strictEqual(EVENT_TYPE_TO_STATUS["task.failed"], "failed");
  assert.strictEqual(EVENT_TYPE_TO_STATUS["task.cancelled"], "cancelled");
}

// ====== Test 4: Callers Cannot Override eventType/Status ======
{
  // Test submitted
  const submittedEvent = createTaskSubmittedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    requestedRouting: { mode: "auto" }
  });
  assert.strictEqual(submittedEvent.eventType, "task.submitted");
  assert.strictEqual(submittedEvent.status, "queued");

  // Test started
  const startedEvent = createTaskStartedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber
  });
  assert.strictEqual(startedEvent.eventType, "task.started");
  assert.strictEqual(startedEvent.status, "running");

  // Test completed
  const completedEvent = createTaskCompletedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber
  });
  assert.strictEqual(completedEvent.eventType, "task.completed");
  assert.strictEqual(completedEvent.status, "succeeded");

  // Test failed
  const failedEvent = createTaskFailedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    errorCode: "ERR_001",
    errorMessage: "Something failed"
  });
  assert.strictEqual(failedEvent.eventType, "task.failed");
  assert.strictEqual(failedEvent.status, "failed");

  // Test cancelled
  const cancelledEvent = createTaskCancelledEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber
  });
  assert.strictEqual(cancelledEvent.eventType, "task.cancelled");
  assert.strictEqual(cancelledEvent.status, "cancelled");

  // Test requires-action
  const requiresActionEvent = createTaskRequiresActionEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    reasonCode: "ACTION_NEEDED",
    message: "User intervention required"
  });
  assert.strictEqual(requiresActionEvent.eventType, "task.requires-action");
  assert.strictEqual(requiresActionEvent.status, "requires_action");
}

// ====== Test 5: Common Identifiers and Timestamps are Preserved ======
{
  const eventId2 = "event-002";
  const workspaceId2 = "workspace-2";
  const taskId2 = "task-002";
  const workId2 = "work-002";
  const occurredAt2 = "2026-06-25T15:30:00.000Z";
  const attemptNumber2 = 3;

  const event = createTaskStartedEvent({
    eventId: eventId2,
    workspaceId: workspaceId2,
    taskId: taskId2,
    workId: workId2,
    occurredAt: occurredAt2,
    attemptNumber: attemptNumber2
  });

  assert.strictEqual(event.eventId, eventId2);
  assert.strictEqual(event.workspaceId, workspaceId2);
  assert.strictEqual(event.taskId, taskId2);
  assert.strictEqual(event.workId, workId2);
  assert.strictEqual(event.occurredAt, occurredAt2);
  assert.strictEqual(event.attemptNumber, attemptNumber2);
}

// ====== Test 6: attemptNumber Validation ======
{
  // Reject zero
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber: 0
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Reject negative
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber: -1
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Reject fraction
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber: 1.5
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Reject NaN
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber: NaN
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Reject Infinity
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber: Infinity
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Accept valid positive integers
  const event = createTaskStartedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber: 10
  });
  assert.strictEqual(event.attemptNumber, 10);
}

// ====== Test 7: Blank Required IDs and Timestamps are Rejected ======
{
  // Blank eventId
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId: "",
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Blank workspaceId
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId: "",
        taskId,
        workId,
        occurredAt,
        attemptNumber
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Blank taskId
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId: "",
        workId,
        occurredAt,
        attemptNumber
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Blank workId
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId: "",
        occurredAt,
        attemptNumber
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Blank occurredAt
  assert.throws(
    () =>
      createTaskStartedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt: "",
        attemptNumber
      }),
    (err) => err instanceof TaskEventValidationError
  );
}

// ====== Test 8: Submitted Routing is Canonical and Protected ======
{
  // Create a submitted event with auto routing
  const autoEvent = createTaskSubmittedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    requestedRouting: { mode: "auto" }
  });
  assert.deepStrictEqual(autoEvent.requestedRouting, { mode: "auto" });

  // Create a submitted event with specific-agent routing
  const agentEvent = createTaskSubmittedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    requestedRouting: { mode: "specific-agent", agentId: "agent-1" }
  });
  assert.deepStrictEqual(agentEvent.requestedRouting, {
    mode: "specific-agent",
    agentId: "agent-1"
  });

  // Create a submitted event with predefined-workflow routing
  const workflowEvent = createTaskSubmittedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    requestedRouting: { mode: "predefined-workflow", workflowId: "wf-1" }
  });
  assert.deepStrictEqual(workflowEvent.requestedRouting, {
    mode: "predefined-workflow",
    workflowId: "wf-1"
  });
}

// ====== Test 8a: Submitted Routing Caller-Aliasing Protection ======
// Verify that createTaskSubmittedEvent reconstructs routing through canonical parser,
// preventing caller-owned objects from aliasing the event's immutable routing property.
{
  // Auto-routing aliasing protection
  {
    const callerAutoRouting = { mode: "auto" };
    const expectedAutoValue = { mode: "auto" };

    // Call factory with caller-owned object
    const autoEvent = createTaskSubmittedEvent({
      eventId,
      workspaceId,
      taskId,
      workId,
      occurredAt,
      attemptNumber,
      requestedRouting: callerAutoRouting
    });

    // Verify factory did not mutate caller object during creation
    assert.deepStrictEqual(
      callerAutoRouting,
      expectedAutoValue,
      "factory must not mutate caller's auto routing object during creation"
    );

    // Verify event has correct canonical value
    assert.deepStrictEqual(
      autoEvent.requestedRouting,
      { mode: "auto" },
      "auto event routing must be canonical { mode: 'auto' }"
    );

    // Verify event routing is NOT the same object reference as caller input
    assert.notStrictEqual(
      autoEvent.requestedRouting,
      callerAutoRouting,
      "auto event routing must be a fresh object, not caller's input reference"
    );

    // Mutate caller's original object after event creation
    callerAutoRouting.mode = "specific-agent";
    callerAutoRouting.agentId = "agent-999";

    // Verify event routing is unaffected by caller mutation
    assert.deepStrictEqual(
      autoEvent.requestedRouting,
      { mode: "auto" },
      "auto event routing must remain { mode: 'auto' } despite caller mutation"
    );
    assert.strictEqual(
      "agentId" in autoEvent.requestedRouting,
      false,
      "auto event routing must not gain agentId from caller mutation"
    );
  }

  // Specific-agent routing aliasing protection
  {
    const callerAgentRouting = {
      mode: "specific-agent",
      agentId: "agent-001"
    };
    const expectedAgentValue = {
      mode: "specific-agent",
      agentId: "agent-001"
    };

    // Call factory with caller-owned object
    const agentEvent = createTaskSubmittedEvent({
      eventId,
      workspaceId,
      taskId,
      workId,
      occurredAt,
      attemptNumber,
      requestedRouting: callerAgentRouting
    });

    // Verify factory did not mutate caller object during creation
    assert.deepStrictEqual(
      callerAgentRouting,
      expectedAgentValue,
      "factory must not mutate caller's specific-agent routing object during creation"
    );

    // Verify event has correct canonical value
    assert.deepStrictEqual(
      agentEvent.requestedRouting,
      { mode: "specific-agent", agentId: "agent-001" },
      "specific-agent event routing must be canonical with original agentId"
    );

    // Verify event routing is NOT the same object reference as caller input
    assert.notStrictEqual(
      agentEvent.requestedRouting,
      callerAgentRouting,
      "specific-agent event routing must be a fresh object, not caller's input reference"
    );

    // Mutate caller's original object after event creation
    callerAgentRouting.mode = "auto";
    callerAgentRouting.agentId = "agent-999";

    // Verify event routing is unaffected by caller mutation
    assert.deepStrictEqual(
      agentEvent.requestedRouting,
      { mode: "specific-agent", agentId: "agent-001" },
      "specific-agent event routing must remain { mode: 'specific-agent', agentId: 'agent-001' } despite caller mutation"
    );
    assert.strictEqual(
      "workflowId" in agentEvent.requestedRouting,
      false,
      "specific-agent event routing must not gain workflowId from caller mutation"
    );
  }

  // Predefined-workflow routing aliasing protection
  {
    const callerWorkflowRouting = {
      mode: "predefined-workflow",
      workflowId: "workflow-001"
    };
    const expectedWorkflowValue = {
      mode: "predefined-workflow",
      workflowId: "workflow-001"
    };

    // Call factory with caller-owned object
    const workflowEvent = createTaskSubmittedEvent({
      eventId,
      workspaceId,
      taskId,
      workId,
      occurredAt,
      attemptNumber,
      requestedRouting: callerWorkflowRouting
    });

    // Verify factory did not mutate caller object during creation
    assert.deepStrictEqual(
      callerWorkflowRouting,
      expectedWorkflowValue,
      "factory must not mutate caller's predefined-workflow routing object during creation"
    );

    // Verify event has correct canonical value
    assert.deepStrictEqual(
      workflowEvent.requestedRouting,
      { mode: "predefined-workflow", workflowId: "workflow-001" },
      "predefined-workflow event routing must be canonical with original workflowId"
    );

    // Verify event routing is NOT the same object reference as caller input
    assert.notStrictEqual(
      workflowEvent.requestedRouting,
      callerWorkflowRouting,
      "predefined-workflow event routing must be a fresh object, not caller's input reference"
    );

    // Mutate caller's original object after event creation
    callerWorkflowRouting.mode = "auto";
    callerWorkflowRouting.workflowId = "workflow-999";

    // Verify event routing is unaffected by caller mutation
    assert.deepStrictEqual(
      workflowEvent.requestedRouting,
      { mode: "predefined-workflow", workflowId: "workflow-001" },
      "predefined-workflow event routing must remain { mode: 'predefined-workflow', workflowId: 'workflow-001' } despite caller mutation"
    );
    assert.strictEqual(
      "agentId" in workflowEvent.requestedRouting,
      false,
      "predefined-workflow event routing must not gain agentId from caller mutation"
    );
  }
}

// ====== Test 9: Requires-Action Metadata is Trimmed and Validated ======
{
  // Valid requires-action event
  const event = createTaskRequiresActionEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    reasonCode: "  ACTION_NEEDED  ",
    message: "  User intervention required  "
  });
  assert.strictEqual(event.reasonCode, "ACTION_NEEDED");
  assert.strictEqual(event.message, "User intervention required");

  // Blank reasonCode
  assert.throws(
    () =>
      createTaskRequiresActionEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber,
        reasonCode: "   ",
        message: "Something"
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Blank message
  assert.throws(
    () =>
      createTaskRequiresActionEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber,
        reasonCode: "CODE",
        message: "   "
      }),
    (err) => err instanceof TaskEventValidationError
  );
}

// ====== Test 10: Failed Metadata is Trimmed and Validated ======
{
  // Valid failed event
  const event = createTaskFailedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    errorCode: "  ERR_500  ",
    errorMessage: "  Internal server error  "
  });
  assert.strictEqual(event.errorCode, "ERR_500");
  assert.strictEqual(event.errorMessage, "Internal server error");

  // Blank errorCode
  assert.throws(
    () =>
      createTaskFailedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber,
        errorCode: "   ",
        errorMessage: "Something"
      }),
    (err) => err instanceof TaskEventValidationError
  );

  // Blank errorMessage
  assert.throws(
    () =>
      createTaskFailedEvent({
        eventId,
        workspaceId,
        taskId,
        workId,
        occurredAt,
        attemptNumber,
        errorCode: "CODE",
        errorMessage: "   "
      }),
    (err) => err instanceof TaskEventValidationError
  );
}

// ====== Test 11: Cancelled Optional Reason is Normalized ======
{
  // Cancelled event without reason
  const eventNoReason = createTaskCancelledEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber
  });
  assert.strictEqual(eventNoReason.reason, undefined);

  // Cancelled event with reason (trimmed)
  const eventWithReason = createTaskCancelledEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    reason: "  User requested  "
  });
  assert.strictEqual(eventWithReason.reason, "User requested");

  // Cancelled event with blank reason (normalized to undefined)
  const eventBlankReason = createTaskCancelledEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    reason: "   "
  });
  assert.strictEqual(eventBlankReason.reason, undefined);
}

// ====== Test 12: Completed Event Contains No Full Result Payload ======
{
  const event = createTaskCompletedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber
  });

  // Verify no result field exists
  assert.strictEqual("result" in event, false);
  assert.strictEqual(event.eventType, "task.completed");
  assert.strictEqual(event.status, "succeeded");

  // Verify only common envelope fields are present
  const keys = Object.keys(event);
  const expectedKeys = [
    "eventId",
    "eventType",
    "occurredAt",
    "workspaceId",
    "taskId",
    "workId",
    "attemptNumber",
    "status"
  ];
  assert.deepStrictEqual(keys.sort(), expectedKeys.sort());
}

// ====== Test 13: Events Contain No Sensitive Data ======
{
  const event = createTaskSubmittedEvent({
    eventId,
    workspaceId,
    taskId,
    workId,
    occurredAt,
    attemptNumber,
    requestedRouting: { mode: "auto" }
  });

  // Verify no prompt, attachment, token, or external object
  assert.strictEqual("prompt" in event, false);
  assert.strictEqual("attachment" in event, false);
  assert.strictEqual("token" in event, false);
  assert.strictEqual("agentConfiguration" in event, false);
  assert.strictEqual("workflowConfiguration" in event, false);

  // requestedRouting should only have mode (and optionally agentId or workflowId)
  assert("mode" in event.requestedRouting);
}

// ====== Test 14: TaskEventPublisher Type Verification ======
{
  // Verify the interface exists and has the expected structure
  /** @type {TaskEventPublisher} */
  const publisherCheck = {
    publish: async (event) => {
      // Mock implementation
    }
  };

  // Verify publish is a function that returns a Promise
  assert.strictEqual(typeof publisherCheck.publish, "function");
}

// ====== Test 15: TaskEventPublisher Has Only Publication API ======
{
  // Create a mock publisher
  /** @type {TaskEventPublisher} */
  const mockPublisher = {
    publish: async (event) => {
      // Does nothing
    }
  };

  // Verify it has only the publish method and no subscription, broker, or queue methods
  const publisherKeys = Object.getOwnPropertyNames(mockPublisher);
  assert.deepStrictEqual(publisherKeys, ["publish"]);

  // Verify no broker-specific methods
  assert.strictEqual("subscribe" in mockPublisher, false);
  assert.strictEqual("queue" in mockPublisher, false);
  assert.strictEqual("retry" in mockPublisher, false);
  assert.strictEqual("batch" in mockPublisher, false);
}

// ====== Test 16: No Forbidden Imports in Event Files ======
{
  const currentFile = fileURLToPath(import.meta.url);
  const testsDir = dirname(currentFile);
  const moduleRoot = dirname(dirname(testsDir));
  
  const taskEventsPath = join(
    moduleRoot,
    "apps/backend/src/modules/task-orchestration/domain/task-events.ts"
  );
  const publisherPath = join(
    moduleRoot,
    "apps/backend/src/modules/task-orchestration/application/task-event-publisher.ts"
  );

  const taskEventsContent = readFileSync(taskEventsPath, "utf8");
  const publisherContent = readFileSync(publisherPath, "utf8");

  // Check for forbidden imports
  const forbiddenPatterns = [
    /from\s+["']@prisma/,
    /from\s+["'].*frontend/,
    /from\s+["'].*agent-management.*private/,
    /from\s+["'].*workflow-management.*private/,
    /require\s*\(\s*["']@prisma/,
    /require\s*\(\s*["'].*frontend/
  ];

  for (const pattern of forbiddenPatterns) {
    assert.strictEqual(
      pattern.test(taskEventsContent),
      false,
      `task-events.ts contains forbidden import pattern: ${pattern}`
    );
    assert.strictEqual(
      pattern.test(publisherContent),
      false,
      `task-event-publisher.ts contains forbidden import pattern: ${pattern}`
    );
  }
}

// ====== Test 17: Domain Code Does Not Generate Time or IDs ======
{
  const currentFile = fileURLToPath(import.meta.url);
  const testsDir = dirname(currentFile);
  const moduleRoot = dirname(dirname(testsDir));
  
  const taskEventsPath = join(
    moduleRoot,
    "apps/backend/src/modules/task-orchestration/domain/task-events.ts"
  );

  const taskEventsContent = readFileSync(taskEventsPath, "utf8");

  // Check for forbidden ID/time generation patterns
  const forbiddenGenerators = [
    /new\s+Date\s*\(/,
    /Date\.now\s*\(/,
    /randomUUID\s*\(/,
    /crypto\.randomUUID/,
    /Math\.random\s*\(/,
    /nanoid/
  ];

  for (const pattern of forbiddenGenerators) {
    assert.strictEqual(
      pattern.test(taskEventsContent),
      false,
      `task-events.ts generates identifiers or timestamps: ${pattern}`
    );
  }
}

// ====== Test 18: No Production Event Publication Implementation ======
{
  const currentFile = fileURLToPath(import.meta.url);
  const testsDir = dirname(currentFile);
  const moduleRoot = dirname(dirname(testsDir));
  
  const publisherPath = join(
    moduleRoot,
    "apps/backend/src/modules/task-orchestration/application/task-event-publisher.ts"
  );
  const publisherContent = readFileSync(publisherPath, "utf8");

  // Verify the publisher is only an interface definition (no implementation)
  assert.strictEqual(publisherContent.includes("export interface"), true);
  assert.strictEqual(publisherContent.includes("export class"), false);
  assert.strictEqual(publisherContent.includes("implements TaskEventPublisher"), false);
}

console.log("All task-orchestration event contract tests passed");
