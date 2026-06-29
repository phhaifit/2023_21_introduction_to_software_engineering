import { useId, type ChangeEvent } from "react";

import {
  ROUTING_MODES,
  type MockAgent,
  type MockWorkflow,
  type RoutingMode
} from "../model/task-types";

import "./routing-selector.css";

const ROUTING_MODE_LABELS = ["Auto", "Agent", "Workflow"] as const;

const ROUTING_MODE_ARIA_LABELS = [
  "Auto-routing",
  "Specific agent",
  "Predefined workflow"
] as const;

export interface RoutingSelectorProps {
  mode: RoutingMode;
  selectedAgentId?: string;
  selectedWorkflowId?: string;
  agents: readonly MockAgent[];
  workflows: readonly MockWorkflow[];
  isDisabled?: boolean;
  onModeChange: (mode: RoutingMode) => void;
  onAgentChange: (agentId: string | undefined) => void;
  onWorkflowChange: (workflowId: string | undefined) => void;
}

export function RoutingSelector({
  mode,
  selectedAgentId,
  selectedWorkflowId,
  agents,
  workflows,
  isDisabled = false,
  onModeChange,
  onAgentChange,
  onWorkflowChange
}: RoutingSelectorProps) {
  const groupName = useId();
  const agentSelectId = `${groupName}-agent`;
  const workflowSelectId = `${groupName}-workflow`;
  const availableAgents = agents.filter((agent) => agent.available);
  const selectedAgent = availableAgents.find((agent) => agent.id === selectedAgentId);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId);

  function handleModeChange(nextMode: RoutingMode) {
    if (isDisabled) {
      return;
    }

    if (nextMode === ROUTING_MODES[0]) {
      onAgentChange(undefined);
      onWorkflowChange(undefined);
    } else if (nextMode === ROUTING_MODES[1]) {
      onWorkflowChange(undefined);
    } else {
      onAgentChange(undefined);
    }

    onModeChange(nextMode);
  }

  function handleAgentChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!isDisabled) {
      onAgentChange(event.target.value || undefined);
    }
  }

  function handleWorkflowChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!isDisabled) {
      onWorkflowChange(event.target.value || undefined);
    }
  }

  return (
    <div className={`routing-selector${isDisabled ? " routing-selector--disabled" : ""}`}>
      <div
        className="routing-selector__segmented"
        role="radiogroup"
        aria-label="Routing mode"
      >
        {ROUTING_MODES.map((routingMode, index) => (
          <button
            key={routingMode}
            type="button"
            role="radio"
            name={groupName}
            aria-checked={mode === routingMode}
            aria-label={ROUTING_MODE_ARIA_LABELS[index]}
            className={`routing-selector__segment${
              mode === routingMode ? " routing-selector__segment--active" : ""
            }`}
            disabled={isDisabled}
            onClick={() => handleModeChange(routingMode)}
          >
            {ROUTING_MODE_LABELS[index]}
          </button>
        ))}
      </div>

      {mode === ROUTING_MODES[1] ? (
        <div className="routing-selector__target">
          <label className="sr-only" htmlFor={agentSelectId}>
            Agent
          </label>
          <select
            id={agentSelectId}
            className="routing-selector__select"
            value={selectedAgentId ?? ""}
            onChange={handleAgentChange}
            disabled={isDisabled}
            required
            aria-label="Agent"
          >
            <option value="">Select agent</option>
            {availableAgents.map((agent) => (
              <option value={agent.id} key={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          {selectedAgent ? (
            <span className="routing-selector__chip" aria-label={`Selected agent ${selectedAgent.name}`}>
              {selectedAgent.name}
            </span>
          ) : null}
        </div>
      ) : null}

      {mode === ROUTING_MODES[2] ? (
        <div className="routing-selector__target">
          <label className="sr-only" htmlFor={workflowSelectId}>
            Workflow
          </label>
          <select
            id={workflowSelectId}
            className="routing-selector__select"
            value={selectedWorkflowId ?? ""}
            onChange={handleWorkflowChange}
            disabled={isDisabled}
            required
            aria-label="Workflow"
          >
            <option value="">Select workflow</option>
            {workflows.map((workflow) => (
              <option value={workflow.id} key={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
          {selectedWorkflow ? (
            <span
              className="routing-selector__chip"
              aria-label={`Selected workflow ${selectedWorkflow.name}`}
            >
              {selectedWorkflow.name}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
