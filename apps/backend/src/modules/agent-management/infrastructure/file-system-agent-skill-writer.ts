import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Agent } from "../domain/agent.ts";
import type { AgentSkillWriter } from "../application/agent-skill-writer.ts";

export class FileSystemAgentSkillWriter implements AgentSkillWriter {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async writeSkillConfiguration(agent: Agent, content: string): Promise<void> {
    const dir = join(this.baseDir, agent.workspaceId, agent.agentId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "skill.md"), content, "utf-8");
  }
}
