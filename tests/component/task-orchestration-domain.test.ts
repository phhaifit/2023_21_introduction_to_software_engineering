import { beforeEach, describe, expect, it } from "vitest";

import {
  createTaskIdentity,
  resetTaskIdentitySequence
} from "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import {
  PROCESSING_STEP_STATUSES,
  ROUTING_MODES,
  TASK_STATUSES
} from "@vcp/frontend/features/task-orchestration/model/task-types.ts";
import {
  createTaskRoutingOptions,
  DEFAULT_TASK_RUNTIME_TIMINGS,
  SUGGESTED_TASK_PROMPTS
} from "@vcp/frontend/features/task-orchestration/data/task-routing-options.ts";

beforeEach(() => {
  resetTaskIdentitySequence();
});

describe("Task & Orchestration domain values", () => {
  it.each([
    ["task statuses", TASK_STATUSES, [
      "pending",
      "in-progress",
      "completed",
      "failed",
      "canceled"
    ]],
    ["routing modes", ROUTING_MODES, [
      "auto",
      "specific-agent",
      "predefined-workflow"
    ]],
    ["processing step statuses", PROCESSING_STEP_STATUSES, [
      "waiting",
      "active",
      "completed",
      "failed",
      "canceled"
    ]]
  ])("defines the required %s", (_label, actual, expected) => {
    expect(actual).toEqual(expected);
  });
});

describe("task identity generation", () => {
  it("creates the first deterministic Task ID and Work ID", () => {
    expect(createTaskIdentity()).toEqual({
      taskId: "TASK-000001",
      workId: "WORK-000001"
    });
  });

  it("creates sequential unique identity pairs", () => {
    const first = createTaskIdentity();
    const second = createTaskIdentity();

    expect(second).toEqual({
      taskId: "TASK-000002",
      workId: "WORK-000002"
    });
    expect(second).not.toEqual(first);
  });

  it("restarts the sequence after reset", () => {
    createTaskIdentity();
    createTaskIdentity();

    resetTaskIdentitySequence();

    expect(createTaskIdentity()).toEqual({
      taskId: "TASK-000001",
      workId: "WORK-000001"
    });
  });
});

describe("task orchestration routing options", () => {
  it("starts without fixed agent options", () => {
    const { agents } = createTaskRoutingOptions();

    expect(agents).toEqual([]);
  });

  it("starts without fixed workflow options", () => {
    const { workflows } = createTaskRoutingOptions();

    expect(workflows).toEqual([]);
  });

  it("returns fresh arrays on every retrieval", () => {
    const first = createTaskRoutingOptions();
    first.agents.push({
      id: "AGT-TEST",
      name: "Test Agent",
      description: "Fixture",
      capabilities: [],
      available: true
    });

    const restored = createTaskRoutingOptions();

    expect(restored.agents).toEqual([]);
  });
});

describe("task orchestration local UI configuration", () => {
  it("provides suggested prompts without execution simulation triggers", () => {
    expect(Object.keys(SUGGESTED_TASK_PROMPTS)).toHaveLength(3);
    expect(Object.values(SUGGESTED_TASK_PROMPTS).every((prompt) => prompt.length > 0)).toBe(true);
    expect(Object.values(SUGGESTED_TASK_PROMPTS).join(" ")).not.toMatch(/FAIL_SIMULATION/);
  });

  it.each(Object.entries(DEFAULT_TASK_RUNTIME_TIMINGS))(
    "defines positive timing value %s",
    (_name, value) => {
      expect(value).toBeGreaterThan(0);
    }
  );
});
