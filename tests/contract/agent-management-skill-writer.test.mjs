import assert from "node:assert/strict";

import { AgentLifecycleUseCases } from "@vcp/backend/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { generateAgentSkillConfiguration } from "@vcp/backend/modules/agent-management/application/agent-skill-configuration.ts";
import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

let generatedIdCounter = 1;
const generateAgentId = () => `agent-${generatedIdCounter++}`;
const now = () => "2026-06-20T00:00:00.000Z";

const calls = [];
const mockWriter = {
  async writeSkillConfiguration(agent, content) {
    calls.push({ agent, content });
  }
};

const repository = new InMemoryAgentRepository();
const useCases = new AgentLifecycleUseCases({
  repository,
  now,
  generateAgentId,
  skillWriter: mockWriter
});

const workspaceId = "workspace-a";

// 5.2 Test: createAgent calls the skill writer once with correct agent and content
const createInput = {
  workspaceId,
  name: "Writer Agent",
  role: "Writer",
  model: "gpt-4",
  instructions: "Write things."
};

const createResult = await useCases.createAgent(createInput);

assert.equal(calls.length, 1);
assert.equal(calls[0].agent.agentId, createResult.agent.agentId);
assert.equal(calls[0].content, generateAgentSkillConfiguration(createResult.agent));

// 5.3 Test: updateAgent calls the skill writer once with updated content
const updateInput = {
  workspaceId,
  agentId: createResult.agent.agentId,
  role: "Senior Writer",
  model: "gpt-4-turbo",
  instructions: "Write better things."
};

const updateResult = await useCases.updateAgent(updateInput);

assert.equal(calls.length, 2);
assert.equal(calls[1].agent.role, "Senior Writer");
assert.equal(calls[1].content, generateAgentSkillConfiguration(updateResult.agent));

// 5.4 Test: skill writer throws → agent is still saved, error is caught (does not propagate)
const throwingWriter = {
  async writeSkillConfiguration() {
    throw new Error("Disk full");
  }
};

const throwingUseCases = new AgentLifecycleUseCases({
  repository,
  now,
  generateAgentId,
  skillWriter: throwingWriter
});

const throwingCreateInput = {
  workspaceId,
  name: "Throwing Agent",
  role: "Thrower",
  model: "gpt-4",
  instructions: "Throw things."
};

const throwingCreateResult = await throwingUseCases.createAgent(throwingCreateInput);
const savedAgent = await repository.findById(workspaceId, throwingCreateResult.agent.agentId);

assert.ok(savedAgent);
assert.equal(savedAgent.name, "Throwing Agent");

console.log("agent management skill writer tests passed");
