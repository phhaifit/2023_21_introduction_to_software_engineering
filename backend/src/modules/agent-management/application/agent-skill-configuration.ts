import type { Agent } from "../domain/agent.ts";

export function generateAgentSkillConfiguration(agent: Agent): string {
  return [
    `# ${agent.name}`,
    "",
    `Role: ${agent.role}`,
    `Model: ${agent.model}`,
    "",
    "## Instructions",
    agent.instructions,
    ""
  ].join("\n");
}
