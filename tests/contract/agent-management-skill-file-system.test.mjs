import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileSystemAgentSkillWriter } from "../../backend/src/modules/agent-management/infrastructure/file-system-agent-skill-writer.ts";
import { generateAgentSkillConfiguration } from "../../backend/src/modules/agent-management/application/agent-skill-configuration.ts";
import { createAgent } from "../../backend/src/modules/agent-management/domain/agent.ts";

const tempBase = await mkdtemp(join(tmpdir(), "agent-skills-test-"));
const writer = new FileSystemAgentSkillWriter(tempBase);

const agent = createAgent({
  agentId: "agent-123",
  workspaceId: "ws-456",
  name: "FS Agent",
  role: "Tester",
  model: "gpt-4",
  instructions: "Test fs.",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
});

const content = generateAgentSkillConfiguration(agent);

// 6.2 Test: write skill file → read back → content matches
await writer.writeSkillConfiguration(agent, content);
const filePath = join(tempBase, agent.workspaceId, agent.agentId, "skill.md");
const readContent = await readFile(filePath, "utf-8");
assert.equal(readContent, content);

// 6.3 Test: overwrite existing skill file → content is updated
const updatedAgent = { ...agent, instructions: "Test fs updated." };
const updatedContent = generateAgentSkillConfiguration(updatedAgent);
await writer.writeSkillConfiguration(updatedAgent, updatedContent);
const readUpdatedContent = await readFile(filePath, "utf-8");
assert.equal(readUpdatedContent, updatedContent);

// 6.4 Test: target directory does not exist → directory is created automatically
// (This is implicitly tested by 6.2 since tempBase was empty)

// 6.5 Cleanup
await rm(tempBase, { recursive: true, force: true });

console.log("agent management skill file system tests passed");
