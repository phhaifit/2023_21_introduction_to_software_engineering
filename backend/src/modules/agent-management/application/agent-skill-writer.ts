import type { Agent } from "../domain/agent.ts";

export type AgentSkillWriter = {
  writeSkillConfiguration(agent: Agent, content: string): Promise<void>;
};
