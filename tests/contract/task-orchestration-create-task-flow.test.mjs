import assert from "node:assert/strict";
import test from "node:test";

import { CreateTaskService } from "@vcp/backend/modules/task-orchestration/application/create-task-service.ts";

const WORKSPACE_ID = "WS-001";
const USER_ID = "USER-001";
const CREATED_AT = "2026-06-24T12:00:00Z";

class Ids {
  constructor(order) {
    this.order = order;
    this.task = 0;
    this.work = 0;
  }

  nextTaskId() {
    this.order.push("task-id");
    return `TASK-${++this.task}`;
  }

  nextWorkId() {
    this.order.push("work-id");
    return `WORK-${++this.work}`;
  }
}

class EventIds {
  constructor(order) {
    this.order = order;
    this.event = 0;
  }

  nextEventId() {
    this.order.push("event-id");
    return `EVT-${++this.event}`;
  }
}

class Clock {
  constructor(order) {
    this.order = order;
    this.calls = 0;
  }

  now() {
    this.order.push("clock");
    this.calls += 1;
    return CREATED_AT;
  }
}

class AgentCatalog {
  constructor() {
    this.selectable = new Map();
    this.calls = [];
  }

  set(workspaceId, agentId, value) {
    this.selectable.set(`${workspaceId}:${agentId}`, value);
  }

  async isAgentSelectable(workspaceId, agentId) {
    this.calls.push({ workspaceId, agentId });
    return this.selectable.get(`${workspaceId}:${agentId}`) ?? false;
  }
}

class WorkflowCatalog {
  constructor() {
    this.executable = new Map();
    this.calls = [];
  }

  set(workspaceId, workflowId, value) {
    this.executable.set(`${workspaceId}:${workflowId}`, value);
  }

  async isWorkflowExecutable(workspaceId, workflowId) {
    this.calls.push({ workspaceId, workflowId });
    return this.executable.get(`${workspaceId}:${workflowId}`) ?? false;
  }
}

class TaskRepo {
  constructor(order) {
    this.order = order;
    this.saved = [];
    this.failure = null;
  }

  async save(workspaceId, task) {
    this.order.push("task-save");
    if (this.failure) {
      throw this.failure;
    }
    this.saved.push({ workspaceId, task });
    return task;
  }

  async findById() {
    return null;
  }
}

class WorkRepo {
  constructor(order) {
    this.order = order;
    this.saved = [];
    this.failure = null;
  }

  async save(workspaceId, work) {
    this.order.push("work-save");
    if (this.failure) {
      throw this.failure;
    }
    this.saved.push({ workspaceId, work });
    return work;
  }

  async findById() {
    return null;
  }

  async listByTaskId() {
    return [];
  }
}

class Publisher {
  constructor(order) {
    this.order = order;
    this.events = [];
    this.failure = null;
  }

  async publish(event) {
    this.order.push("publish");
    if (this.failure) {
      throw this.failure;
    }
    this.events.push(event);
  }
}

function setup() {
  const order = [];
  const ids = new Ids(order);
  const eventIds = new EventIds(order);
  const clock = new Clock(order);
  const agents = new AgentCatalog();
  const workflows = new WorkflowCatalog();
  const tasks = new TaskRepo(order);
  const works = new WorkRepo(order);
  const publisher = new Publisher(order);
  const service = new CreateTaskService(
    ids,
    clock,
    eventIds,
    agents,
    workflows,
    tasks,
    works,
    publisher
  );

  return { service, ids, eventIds, clock, agents, workflows, tasks, works, publisher, order };
}

function command(routing, prompt = "Create a short report") {
  return {
    workspaceId: WORKSPACE_ID,
    submittedByUserId: USER_ID,
    prompt,
    routing
  };
}

function assertNoCreationSideEffects(ctx) {
  assert.equal(ctx.ids.task, 0);
  assert.equal(ctx.ids.work, 0);
  assert.equal(ctx.eventIds.event, 0);
  assert.equal(ctx.clock.calls, 0);
  assert.equal(ctx.tasks.saved.length, 0);
  assert.equal(ctx.works.saved.length, 0);
  assert.equal(ctx.publisher.events.length, 0);
}

test("CreateTaskService creates an auto-routed queued task and work deterministically", async () => {
  const ctx = setup();
  const originalRandom = Math.random;
  const originalDateNow = Date.now;
  Math.random = () => {
    throw new Error("Math.random must not be used");
  };
  Date.now = () => {
    throw new Error("Date.now must not be used");
  };

  try {
    const response = await ctx.service.execute(command({ mode: "auto" }, "  Build summary  "));

    assert.deepEqual(Object.keys(response).sort(), ["createdAt", "status", "taskId", "workId"]);
    assert.deepEqual(response, {
      taskId: "TASK-1",
      workId: "WORK-1",
      status: "queued",
      createdAt: CREATED_AT
    });
    assert.deepEqual(ctx.agents.calls, []);
    assert.deepEqual(ctx.workflows.calls, []);
    assert.deepEqual(ctx.order, ["task-id", "work-id", "clock", "task-save", "work-save", "event-id", "publish"]);

    assert.equal(ctx.tasks.saved.length, 1);
    assert.equal(ctx.works.saved.length, 1);
    const task = ctx.tasks.saved[0].task;
    const work = ctx.works.saved[0].work;
    assert.equal(task.prompt, "Build summary");
    assert.equal(task.status, "queued");
    assert.deepEqual(task.requestedRouting, { mode: "auto" });
    assert.equal(task.createdAt, CREATED_AT);
    assert.equal(task.updatedAt, CREATED_AT);
    assert.equal(work.status, "queued");
    assert.equal(work.attemptNumber, 1);
    assert.equal(work.resolvedRouting, null);
    assert.equal(work.workspaceId, WORKSPACE_ID);
    assert.equal(work.taskId, response.taskId);
    assert.equal(work.queuedAt, CREATED_AT);
    assert.equal(work.createdAt, CREATED_AT);
    assert.equal(work.updatedAt, CREATED_AT);

    assert.deepEqual(ctx.publisher.events, [
      {
        eventId: "EVT-1",
        eventType: "task.submitted",
        occurredAt: CREATED_AT,
        workspaceId: WORKSPACE_ID,
        taskId: "TASK-1",
        workId: "WORK-1",
        attemptNumber: 1,
        status: "queued",
        requestedRouting: { mode: "auto" }
      }
    ]);
  } finally {
    Math.random = originalRandom;
    Date.now = originalDateNow;
  }
});

test("CreateTaskService validates specific-agent routing through the agent catalog once", async () => {
  const ctx = setup();
  ctx.agents.set(WORKSPACE_ID, "AGT-CODE", true);

  await ctx.service.execute(command({ mode: "specific-agent", agentId: "AGT-CODE" }));

  assert.deepEqual(ctx.agents.calls, [{ workspaceId: WORKSPACE_ID, agentId: "AGT-CODE" }]);
  assert.deepEqual(ctx.workflows.calls, []);
  assert.deepEqual(ctx.tasks.saved[0].task.requestedRouting, {
    mode: "specific-agent",
    agentId: "AGT-CODE"
  });
  assert.equal(ctx.publisher.events.length, 1);
});

test("CreateTaskService rejects unavailable specific-agent routing without creation side effects", async () => {
  const ctx = setup();
  ctx.agents.set(WORKSPACE_ID, "AGT-MISSING", false);

  await assert.rejects(
    ctx.service.execute(command({ mode: "specific-agent", agentId: "AGT-MISSING" })),
    (error) => {
      assert.equal(error.name, "CreateTaskError");
      assert.equal(error.errorType, "invalid-agent-target");
      assert.equal(error.workspaceId, WORKSPACE_ID);
      assert.equal(error.targetId, "AGT-MISSING");
      return true;
    }
  );

  assert.deepEqual(ctx.agents.calls, [{ workspaceId: WORKSPACE_ID, agentId: "AGT-MISSING" }]);
  assert.deepEqual(ctx.workflows.calls, []);
  assertNoCreationSideEffects(ctx);
});

test("CreateTaskService validates predefined-workflow routing through the workflow catalog once", async () => {
  const ctx = setup();
  ctx.workflows.set(WORKSPACE_ID, "WFL-CODE-REVIEW", true);

  await ctx.service.execute(
    command({ mode: "predefined-workflow", workflowId: "WFL-CODE-REVIEW" })
  );

  assert.deepEqual(ctx.agents.calls, []);
  assert.deepEqual(ctx.workflows.calls, [
    { workspaceId: WORKSPACE_ID, workflowId: "WFL-CODE-REVIEW" }
  ]);
  assert.deepEqual(ctx.tasks.saved[0].task.requestedRouting, {
    mode: "predefined-workflow",
    workflowId: "WFL-CODE-REVIEW"
  });
  assert.equal(ctx.publisher.events.length, 1);
});

test("CreateTaskService rejects unavailable predefined-workflow routing without creation side effects", async () => {
  const ctx = setup();
  ctx.workflows.set(WORKSPACE_ID, "WFL-MISSING", false);

  await assert.rejects(
    ctx.service.execute(command({ mode: "predefined-workflow", workflowId: "WFL-MISSING" })),
    (error) => {
      assert.equal(error.name, "CreateTaskError");
      assert.equal(error.errorType, "invalid-workflow-target");
      assert.equal(error.workspaceId, WORKSPACE_ID);
      assert.equal(error.targetId, "WFL-MISSING");
      return true;
    }
  );

  assert.deepEqual(ctx.agents.calls, []);
  assert.deepEqual(ctx.workflows.calls, [
    { workspaceId: WORKSPACE_ID, workflowId: "WFL-MISSING" }
  ]);
  assertNoCreationSideEffects(ctx);
});

test("CreateTaskService propagates domain validation errors before side effects", async () => {
  for (const [invalidCommand, errorName] of [
    [command({ mode: "auto" }, "   "), "TaskValidationError"],
    [command({ mode: "specific-agent" }), "TaskRoutingValidationError"],
    [command({ mode: "auto", agentId: "AGT-CODE" }), "TaskRoutingValidationError"]
  ]) {
    const ctx = setup();

    await assert.rejects(ctx.service.execute(invalidCommand), { name: errorName });
    assert.deepEqual(ctx.agents.calls, []);
    assert.deepEqual(ctx.workflows.calls, []);
    assertNoCreationSideEffects(ctx);
  }
});

test("CreateTaskService preserves persistence and event failure ordering", async () => {
  {
    const ctx = setup();
    ctx.tasks.failure = new Error("task save failed");
    await assert.rejects(ctx.service.execute(command({ mode: "auto" })), /task save failed/);
    assert.deepEqual(ctx.order, ["task-id", "work-id", "clock", "task-save"]);
    assert.equal(ctx.works.saved.length, 0);
    assert.equal(ctx.publisher.events.length, 0);
  }

  {
    const ctx = setup();
    ctx.works.failure = new Error("work save failed");
    await assert.rejects(ctx.service.execute(command({ mode: "auto" })), /work save failed/);
    assert.deepEqual(ctx.order, ["task-id", "work-id", "clock", "task-save", "work-save"]);
    assert.equal(ctx.publisher.events.length, 0);
  }

  {
    const ctx = setup();
    ctx.publisher.failure = new Error("publish failed");
    await assert.rejects(ctx.service.execute(command({ mode: "auto" })), /publish failed/);
    assert.deepEqual(ctx.order, ["task-id", "work-id", "clock", "task-save", "work-save", "event-id", "publish"]);
  }
});
