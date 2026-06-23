import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RoutingSelector,
  type RoutingSelectorProps
} from "@vcp/frontend/features/task-orchestration/components/routing-selector.tsx";
import { createTaskOrchestrationSeedData } from
  "@vcp/frontend/features/task-orchestration/mocks/task-orchestration-mocks.ts";
import { ROUTING_MODES } from
  "@vcp/frontend/features/task-orchestration/model/task-types.ts";

afterEach(cleanup);

const seedData = createTaskOrchestrationSeedData();

function renderSelector(overrides: Partial<RoutingSelectorProps> = {}) {
  const props: RoutingSelectorProps = {
    mode: ROUTING_MODES[0],
    agents: seedData.agents,
    workflows: seedData.workflows,
    onModeChange: vi.fn(),
    onAgentChange: vi.fn(),
    onWorkflowChange: vi.fn(),
    ...overrides
  };
  const view = render(<RoutingSelector {...props} />);

  return { ...view, props };
}

describe("RoutingSelector", () => {
  it("renders one accessible controlled choice from all routing modes", () => {
    renderSelector({ mode: ROUTING_MODES[1] });

    expect(screen.getByRole("group", { name: "Routing mode" })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Auto-routing/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Specific agent/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Predefined workflow/ }))
      .not.toBeChecked();
  });

  it.each([
    [ROUTING_MODES[0], /Auto-routing/, 1, 1],
    [ROUTING_MODES[1], /Specific agent/, 0, 1],
    [ROUTING_MODES[2], /Predefined workflow/, 1, 0]
  ] as const)(
    "emits %s and clears incompatible targets",
    async (nextMode, label, agentClears, workflowClears) => {
      const user = userEvent.setup();
      const { props } = renderSelector({
        mode: nextMode === ROUTING_MODES[0] ? ROUTING_MODES[1] : ROUTING_MODES[0]
      });

      await user.click(screen.getByRole("radio", { name: label }));

      expect(props.onModeChange).toHaveBeenCalledWith(nextMode);
      expect(props.onAgentChange).toHaveBeenCalledTimes(agentClears);
      expect(props.onWorkflowChange).toHaveBeenCalledTimes(workflowClears);
    }
  );

  it("shows Auto-routing without a target selector", () => {
    renderSelector();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders required agent data and emits agent changes", async () => {
    const user = userEvent.setup();
    const { props } = renderSelector({ mode: ROUTING_MODES[1] });
    const select = screen.getByRole("combobox", { name: "Agent" });

    expect(select).toBeRequired();
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("value")))
      .toEqual(["", ...seedData.agents.map((agent) => agent.id)]);
    expect(screen.getByRole("option", { name: /Code Agent \(AGT-CODE\)/ }))
      .toBeVisible();

    await user.selectOptions(select, "AGT-REVIEW");
    expect(props.onAgentChange).toHaveBeenCalledWith("AGT-REVIEW");
    expect(screen.queryByRole("combobox", { name: "Workflow" }))
      .not.toBeInTheDocument();
  });

  it("renders required workflow data and emits workflow changes", async () => {
    const user = userEvent.setup();
    const { props } = renderSelector({ mode: ROUTING_MODES[2] });
    const select = screen.getByRole("combobox", { name: "Workflow" });

    expect(select).toBeRequired();
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("value")))
      .toEqual(["", ...seedData.workflows.map((workflow) => workflow.id)]);
    expect(screen.getByRole("option", {
      name: /Research \+ Synthesis \(WFL-RESEARCH-SYNTHESIS\)/
    })).toBeVisible();

    await user.selectOptions(select, "WFL-RESEARCH-SYNTHESIS");
    expect(props.onWorkflowChange).toHaveBeenCalledWith("WFL-RESEARCH-SYNTHESIS");
    expect(screen.queryByRole("combobox", { name: "Agent" }))
      .not.toBeInTheDocument();
  });

  it("hides irrelevant target controls after a controlled mode switch", () => {
    const { rerender, props } = renderSelector({
      mode: ROUTING_MODES[1],
      selectedAgentId: "AGT-CODE"
    });
    expect(screen.getByRole("combobox", { name: "Agent" })).toBeVisible();

    rerender(
      <RoutingSelector
        {...props}
        mode={ROUTING_MODES[2]}
        selectedWorkflowId="WFL-CODE-REVIEW"
      />
    );

    expect(screen.queryByRole("combobox", { name: "Agent" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Workflow" })).toBeVisible();
  });

  it("prevents disabled changes while preserving selected state", async () => {
    const user = userEvent.setup();
    const { props } = renderSelector({
      mode: ROUTING_MODES[1],
      selectedAgentId: "AGT-CODE",
      isDisabled: true
    });
    const agentSelect = screen.getByRole("combobox", { name: "Agent" });

    expect(screen.getByRole("radio", { name: /Specific agent/ })).toBeChecked();
    expect(agentSelect).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Auto-routing/ }));
    await user.selectOptions(agentSelect, "AGT-REVIEW");

    expect(props.onModeChange).not.toHaveBeenCalled();
    expect(props.onAgentChange).not.toHaveBeenCalled();
    expect(props.onWorkflowChange).not.toHaveBeenCalled();
  });

  it("supports keyboard mode selection", async () => {
    const user = userEvent.setup();
    const { props } = renderSelector();
    const workflowMode = screen.getByRole("radio", { name: /Predefined workflow/ });

    workflowMode.focus();
    await user.keyboard(" ");
    expect(props.onModeChange).toHaveBeenCalledWith(ROUTING_MODES[2]);
  });

  it("does not mutate option arrays or objects", () => {
    const agentsBefore = structuredClone(seedData.agents);
    const workflowsBefore = structuredClone(seedData.workflows);

    renderSelector({ mode: ROUTING_MODES[1] });

    expect(seedData.agents).toEqual(agentsBefore);
    expect(seedData.workflows).toEqual(workflowsBefore);
  });
});
