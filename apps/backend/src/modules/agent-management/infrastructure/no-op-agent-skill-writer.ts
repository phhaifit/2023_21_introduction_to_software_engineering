import type { AgentSkillWriter } from "../application/agent-skill-writer.ts";

export class NoOpAgentSkillWriter implements AgentSkillWriter {
  async writeSkillConfiguration(): Promise<void> {}
}
