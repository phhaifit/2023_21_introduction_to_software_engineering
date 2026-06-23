import { useId, type ChangeEvent } from "react";

import {
  ROUTING_MODES,
  type MockAgent,
  type MockWorkflow,
  type RoutingMode
} from "../model/task-types";

import "./routing-selector.css";

const ROUTING_MODE_PRESENTATION = [
  {
    label: "Auto-routing",
    description: "Let the workspace choose an agent or workflow later."
  },
  {
    label: "Specific agent",
    description: "Send the task to one available mock agent."
  },
  {
    label: "Predefined workflow",
    description: "Use one deterministic multi-agent workflow."
  }
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
  const agentDescriptionId = `${agentSelectId}-description`;
  const workflowSelectId = `${groupName}-workflow`;
  const workflowDescriptionId = `${workflowSelectId}-description`;
  const availableAgents = agents.filter((agent) => agent.available);

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
    <fieldset className="routing-selector" disabled={isDisabled}>
      <legend>Routing mode</legend>

      <div className="routing-selector__modes">
        {ROUTING_MODES.map((routingMode, index) => {
          const presentation = ROUTING_MODE_PRESENTATION[index];

          return (
            <label className="routing-selector__mode" key={routingMode}>
              <input
                type="radio"
                name={groupName}
                value={routingMode}
                checked={mode === routingMode}
                onChange={() => handleModeChange(routingMode)}
              />
              <span>
                <strong>{presentation.label}</strong>
                <small>{presentation.description}</small>
              </span>
            </label>
          );
        })}
      </div>

      {mode === ROUTING_MODES[1] ? (
        <div className="routing-selector__target">
          <label htmlFor={agentSelectId}>Agent</label>
          <select
            id={agentSelectId}
            value={selectedAgentId ?? ""}
            onChange={handleAgentChange}
            aria-describedby={agentDescriptionId}
            required
          >
            <option value="">Select an available agent</option>
            {availableAgents.map((agent) => (
              <option value={agent.id} key={agent.id}>
                {agent.name} ({agent.id}) — {agent.description}
              </option>
            ))}
          </select>
          <small id={agentDescriptionId}>
            An available agent is required for this routing mode.
          </small>
        </div>
      ) : null}

      {mode === ROUTING_MODES[2] ? (
        <div className="routing-selector__target">
          <label htmlFor={workflowSelectId}>Workflow</label>
          <select
            id={workflowSelectId}
            value={selectedWorkflowId ?? ""}
            onChange={handleWorkflowChange}
            aria-describedby={workflowDescriptionId}
            required
          >
            <option value="">Select a predefined workflow</option>
            {workflows.map((workflow) => (
              <option value={workflow.id} key={workflow.id}>
                {workflow.name} ({workflow.id}) — {workflow.description}
              </option>
            ))}
          </select>
          <small id={workflowDescriptionId}>
            A workflow is required for this routing mode.
          </small>
        </div>
      ) : null}
    </fieldset>
  );
}
