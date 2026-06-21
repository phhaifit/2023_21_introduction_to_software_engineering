import assert from "node:assert/strict";

import { generateAgentSkillConfiguration } from "@vcp/backend/modules/agent-management/application/agent-skill-configuration.ts";
import { createAgent } from "@vcp/backend/modules/agent-management/domain/agent.ts";

const agent = createAgent({
  agentId: "agent-skill",
  workspaceId: "workspace-a",
  name: "Research Agent",
  role: "Researcher",
  model: "gpt-4.1-mini",
  instructions: "Collect and summarize market data.",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
});

assert.equal(
  generateAgentSkillConfiguration(agent),
  [
    "# Research Agent",
    "",
    "Role: Researcher",
    "Model: gpt-4.1-mini",
    "",
    "## Instructions",
    "Collect and summarize market data.",
    ""
  ].join("\n")
);

const updatedAgent = {
  ...agent,
  role: "Analyst",
  model: "gpt-4.1",
  instructions: "Prepare weekly trend analysis."
};

assert.match(generateAgentSkillConfiguration(updatedAgent), /Role: Analyst/);
assert.match(generateAgentSkillConfiguration(updatedAgent), /Model: gpt-4\.1/);
assert.match(generateAgentSkillConfiguration(updatedAgent), /Prepare weekly trend analysis\./);

console.log("agent management skill configuration checks passed");
