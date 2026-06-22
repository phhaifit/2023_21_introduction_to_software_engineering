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
  createTaskOrchestrationSeedData,
  DEMO_PROMPTS,
  DEMO_TIMINGS,
  MOCK_RESULTS
} from "@vcp/frontend/features/task-orchestration/mocks/task-orchestration-mocks.ts";

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

describe("deterministic task orchestration seed data", () => {
  it("provides all required agents", () => {
    const { agents } = createTaskOrchestrationSeedData();

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
    const { workflows } = createTaskOrchestrationSeedData();

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
    const first = createTaskOrchestrationSeedData();
    first.agents.pop();
    first.agents[0].capabilities.push("consumer mutation");
    first.workflows[0].agentIds.push("AGT-SYNTHESIS");

    const restored = createTaskOrchestrationSeedData();

    expect(restored.agents).toHaveLength(4);
    expect(restored.agents[0].capabilities).not.toContain("consumer mutation");
    expect(restored.workflows[0].agentIds).toEqual([
      "AGT-CODE",
      "AGT-REVIEW"
    ]);
  });
});

describe("deterministic demo configuration", () => {
  it("uses the required failure prompt prefix", () => {
    expect(DEMO_PROMPTS.failureSimulation).toMatch(/^FAIL_SIMULATION:/);
    expect(Object.keys(DEMO_PROMPTS)).toHaveLength(5);
  });

  it.each(Object.entries(DEMO_TIMINGS))(
    "defines positive timing value %s",
    (_name, value) => {
      expect(value).toBeGreaterThan(0);
    }
  );

  it("provides the required mock result keys", () => {
    expect(Object.keys(MOCK_RESULTS)).toEqual([
      "weeklyProgressReport",
      "productDescription",
      "researchSummary"
    ]);
    expect(Object.values(MOCK_RESULTS).every((result) => result.length > 0)).toBe(true);
  });
});
