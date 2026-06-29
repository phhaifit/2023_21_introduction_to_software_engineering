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
  it("provides all required agents", () => {
    const { agents } = createTaskRoutingOptions();

    expect(agents.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "AGT-CODE", name: "Code Agent" },
      { id: "AGT-REVIEW", name: "Review Agent" },
      { id: "AGT-RESEARCH", name: "Research Agent" },
      { id: "AGT-SYNTHESIS", name: "Synthesis Agent" }
    ]);
    expect(agents.every((agent) =>
      agent.description.length > 0 &&
      agent.capabilities.length > 0 &&
      agent.available
    )).toBe(true);
  });

  it("provides both required workflows and agent mappings", () => {
    const { workflows } = createTaskRoutingOptions();

    expect(workflows.map(({ id, agentIds }) => ({ id, agentIds }))).toEqual([
      {
        id: "WFL-CODE-REVIEW",
        agentIds: ["AGT-CODE", "AGT-REVIEW"]
      },
      {
        id: "WFL-RESEARCH-SYNTHESIS",
        agentIds: ["AGT-RESEARCH", "AGT-SYNTHESIS"]
      }
    ]);
    expect(workflows.every((workflow) =>
      workflow.name.length > 0 && workflow.description.length > 0
    )).toBe(true);
  });

  it("returns fresh arrays and nested arrays on every retrieval", () => {
    const first = createTaskRoutingOptions();
    first.agents.pop();
    first.agents[0].capabilities.push("consumer mutation");
    first.workflows[0].agentIds.push("AGT-SYNTHESIS");

    const restored = createTaskRoutingOptions();

    expect(restored.agents).toHaveLength(4);
    expect(restored.agents[0].capabilities).not.toContain("consumer mutation");
    expect(restored.workflows[0].agentIds).toEqual([
      "AGT-CODE",
      "AGT-REVIEW"
    ]);
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
