import assert from "node:assert/strict";

import { AgentLifecycleUseCases, AgentNotFoundError } from "@vcp/backend/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

const workspaceId = "workspace-runtime";

function createUseCases() {
  let idSequence = 0;
  let timeSequence = 0;
  const repository = new InMemoryAgentRepository();
  return {
    repository,
    useCases: new AgentLifecycleUseCases({
      repository,
      now: () => `2026-06-28T10:00:0${timeSequence++}.000Z`,
      generateAgentId: () => `agent-runtime-${++idSequence}`
    })
  };
}

async function buildOpenClawMaterializationInput(runtimeProfileReader, workspaceId, agentId) {
  const profile = await runtimeProfileReader.getAgentRuntimeProfile(workspaceId, agentId);

  return {
    platformAgentId: profile.agentId,
    workspaceId: profile.workspaceId,
    displayName: profile.name,
    model: profile.model,
    role: profile.role,
    instructions: profile.instructions,
    skillMarkdown: profile.skillMarkdown,
    agentDirectoryName: profile.materializationHints.agentDirectoryName,
    skillFileName: profile.materializationHints.skillFileName,
    toolIntent: profile.runtimeConfiguration.requestedTools,
    knowledgeIntent: profile.runtimeConfiguration.requestedKnowledge,
    requiresCurrentToolResolution: profile.materializationHints.requiresCurrentToolResolution,
    requiresCurrentKnowledgeResolution:
      profile.materializationHints.requiresCurrentKnowledgeResolution
  };
}

{
  const { useCases } = createUseCases();

  const created = await useCases.createAgent({
    workspaceId,
    name: "Runtime Handoff Agent",
    role: "Support specialist",
    model: "gemini-2.5-flash",
    instructions: "Resolve support requests using approved context.",
    responsibilities: ["Triage customer issues"],
    operatingContext: "Use workspace-approved support context only.",
    requestedTools: [{ name: "Slack", reason: "Notify support owners" }],
    requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
    constraints: ["Do not expose private account data"],
    escalationRules: ["Escalate billing disputes"],
    exampleTasks: ["Draft a customer support reply"]
  });

  const materializationInput = await buildOpenClawMaterializationInput(
    useCases,
    workspaceId,
    created.agent.agentId
  );

  assert.equal(materializationInput.platformAgentId, created.agent.agentId);
  assert.equal(materializationInput.workspaceId, workspaceId);
  assert.equal(materializationInput.displayName, "Runtime Handoff Agent");
  assert.equal(materializationInput.model, "gemini-2.5-flash");
  assert.match(materializationInput.skillMarkdown, /# Runtime Handoff Agent/);
  assert.match(materializationInput.skillMarkdown, /## Requested Tools\n- Slack: Notify support owners/);
  assert.deepEqual(materializationInput.toolIntent, [
    { name: "Slack", reason: "Notify support owners" }
  ]);
  assert.deepEqual(materializationInput.knowledgeIntent, [
    { title: "Support Handbook", reason: "Ground answers" }
  ]);
  assert.equal(materializationInput.requiresCurrentToolResolution, true);
  assert.equal(materializationInput.requiresCurrentKnowledgeResolution, true);

  const serialized = JSON.stringify(materializationInput);
  assert.doesNotMatch(
    serialized,
    /credential|secret|token|apiKey|rawProvider|providerError|runtimeUrl|containerId|terminalCommand|taskManifest|assignmentId|grantId|agents\.list/i
  );
}

{
  const { useCases } = createUseCases();
  const created = await useCases.createAgent({
    workspaceId,
    name: "Disabled Runtime Agent",
    role: "Support specialist",
    model: "gemini-2.5-flash",
    instructions: "Resolve support requests."
  });
  await useCases.disableAgent(workspaceId, created.agent.agentId);

  await assert.rejects(
    () => buildOpenClawMaterializationInput(useCases, workspaceId, created.agent.agentId),
    AgentNotFoundError
  );
}

console.log("agent management runtime profile handoff checks passed");
