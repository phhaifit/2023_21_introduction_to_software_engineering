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
    "## Role",
    "Researcher",
    "",
    "## Model",
    "gpt-4.1-mini",
    "",
    "## Responsibilities",
    "_Not specified._",
    "",
    "## Operating Context",
    "_Not specified._",
    "",
    "## Instructions",
    "Collect and summarize market data.",
    "",
    "## Requested Tools",
    "_Not specified._",
    "",
    "## Requested Knowledge",
    "_Not specified._",
    "",
    "## Constraints",
    "_Not specified._",
    "",
    "## Escalation Rules",
    "_Not specified._",
    "",
    "## Example Tasks",
    "_Not specified._",
    ""
  ].join("\n")
);

const updatedAgent = {
  ...agent,
  role: "Analyst",
  model: "gpt-4.1",
  instructions: "Prepare weekly trend analysis."
};

assert.match(generateAgentSkillConfiguration(updatedAgent), /## Role\nAnalyst/);
assert.match(generateAgentSkillConfiguration(updatedAgent), /## Model\ngpt-4\.1/);
assert.match(generateAgentSkillConfiguration(updatedAgent), /Prepare weekly trend analysis\./);

const draftMarkdown = generateAgentSkillConfiguration({
  name: "HR Agent",
  role: "HR Assistant",
  model: "gemini-2.5-flash",
  responsibilities: ["Answer policy questions", "Escalate sensitive cases"],
  operatingContext: "Use company policy documents only.",
  instructions: "Provide concise HR guidance.",
  requestedTools: [{ name: "Slack", reason: "Answer employee questions" }],
  requestedKnowledge: [{ title: "Employee Handbook", reason: "Policy source" }],
  constraints: ["Do not provide legal advice"],
  escalationRules: ["Escalate harassment reports to HR manager"],
  exampleTasks: ["Explain annual leave policy"]
});

for (const heading of [
  "## Responsibilities",
  "## Operating Context",
  "## Requested Tools",
  "## Requested Knowledge",
  "## Constraints",
  "## Escalation Rules",
  "## Example Tasks"
]) {
  assert.match(draftMarkdown, new RegExp(heading));
}

assert.match(draftMarkdown, /- Answer policy questions/);
assert.match(draftMarkdown, /- Slack: Answer employee questions/);
assert.match(draftMarkdown, /- Employee Handbook: Policy source/);

console.log("agent management skill configuration checks passed");
