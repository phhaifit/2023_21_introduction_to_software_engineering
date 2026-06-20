import assert from "node:assert/strict";

import {
  AgentLifecycleUseCases,
  AgentNotFoundError,
  AgentValidationError
} from "../../backend/src/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgent } from "../../backend/src/modules/agent-management/domain/agent.ts";
import { InMemoryAgentRepository } from "../../backend/src/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";

function createHarness() {
  const repository = new InMemoryAgentRepository();
  const timestamps = [
    "2026-06-20T01:00:00.000Z",
    "2026-06-20T02:00:00.000Z",
    "2026-06-20T03:00:00.000Z",
    "2026-06-20T04:00:00.000Z",
    "2026-06-20T05:00:00.000Z",
    "2026-06-20T06:00:00.000Z"
  ];
  const agentIds = ["agent-1", "agent-2", "agent-3"];

  return {
    repository,
    useCases: new AgentLifecycleUseCases({
      repository,
      now: () => timestamps.shift(),
      generateAgentId: () => agentIds.shift()
    })
  };
}

function makeAgent(overrides = {}) {
  return createAgent({
    agentId: "agent-seeded",
    workspaceId: workspaceA,
    name: "Seeded Agent",
    role: "Researcher",
    model: "gpt-4.1-mini",
    instructions: "Collect and summarize market data.",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  });
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ agentId: "agent-enabled", name: "Enabled Agent" }));
  await repository.save(
    makeAgent({ agentId: "agent-disabled", name: "Disabled Agent", status: "disabled" })
  );
  await repository.save(
    makeAgent({ agentId: "agent-deleted", name: "Deleted Agent", status: "deleted" })
  );
  await repository.save(
    makeAgent({
      agentId: "agent-other-workspace",
      workspaceId: workspaceB,
      name: "Other Workspace Agent"
    })
  );

  const agents = await useCases.listAgents(workspaceA);

  assert.deepEqual(
    agents.map((agent) => agent.agentId),
    ["agent-enabled", "agent-disabled"]
  );
  assert.deepEqual(Object.keys(agents[0]), [
    "agentId",
    "workspaceId",
    "name",
    "role",
    "model",
    "status",
    "updatedAt",
    "createdAt"
  ]);
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ agentId: "agent-enabled" }));
  await repository.save(
    makeAgent({ agentId: "agent-disabled", name: "Disabled Agent", status: "disabled" })
  );
  await repository.save(
    makeAgent({ agentId: "agent-deleted", name: "Deleted Agent", status: "deleted" })
  );
  await repository.save(
    makeAgent({
      agentId: "agent-other-workspace",
      workspaceId: workspaceB,
      name: "Other Agent"
    })
  );

  const enabled = await useCases.getAgentConfiguration(workspaceA, "agent-enabled");
  const disabled = await useCases.getAgentConfiguration(workspaceA, "agent-disabled");

  assert.equal(enabled.instructions, "Collect and summarize market data.");
  assert.equal(enabled.status, "enabled");
  assert.equal(disabled.status, "disabled");
  assert.deepEqual(Object.keys(enabled), [
    "agentId",
    "workspaceId",
    "name",
    "role",
    "model",
    "instructions",
    "status",
    "updatedAt"
  ]);

  await assert.rejects(
    () => useCases.getAgentConfiguration(workspaceA, "missing-agent"),
    AgentNotFoundError
  );
  await assert.rejects(
    () => useCases.getAgentConfiguration(workspaceA, "agent-deleted"),
    AgentNotFoundError
  );
  await assert.rejects(
    () => useCases.getAgentConfiguration(workspaceA, "agent-other-workspace"),
    AgentNotFoundError
  );
}

{
  const { repository, useCases } = createHarness();
  const result = await useCases.createAgent({
    workspaceId: workspaceA,
    name: " Support Agent ",
    role: " Customer Support ",
    model: " gpt-4.1-mini ",
    instructions: " Resolve customer tickets. "
  });

  assert.equal(result.agent.agentId, "agent-1");
  assert.equal(result.agent.name, "Support Agent");
  assert.equal(result.agent.role, "Customer Support");
  assert.equal(result.agent.model, "gpt-4.1-mini");
  assert.equal(result.agent.instructions, "Resolve customer tickets.");
  assert.equal(result.agent.status, "enabled");
  assert.match(result.skillConfiguration, /# Support Agent/);
  assert.match(result.skillConfiguration, /Role: Customer Support/);
  assert.match(result.skillConfiguration, /Model: gpt-4\.1-mini/);
  assert.match(result.skillConfiguration, /Resolve customer tickets\./);

  const saved = await repository.findById(workspaceA, "agent-1");
  assert.equal(saved.name, "Support Agent");
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ name: "Support Agent" }));

  await assert.rejects(
    () =>
      useCases.createAgent({
        workspaceId: workspaceA,
        name: " support agent ",
        role: "Support",
        model: "gpt-4.1-mini",
        instructions: "Help customers."
      }),
    AgentValidationError
  );

  await assert.rejects(
    () =>
      useCases.createAgent({
        workspaceId: workspaceA,
        name: "",
        role: "",
        model: "",
        instructions: ""
      }),
    AgentValidationError
  );
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ agentId: "agent-update" }));

  const result = await useCases.updateAgent({
    workspaceId: workspaceA,
    agentId: "agent-update",
    role: "Analyst",
    model: "gpt-4.1",
    instructions: "Prepare weekly analysis."
  });

  assert.equal(result.agent.role, "Analyst");
  assert.equal(result.agent.model, "gpt-4.1");
  assert.equal(result.agent.instructions, "Prepare weekly analysis.");
  assert.equal(result.agent.updatedAt, "2026-06-20T01:00:00.000Z");
  assert.match(result.skillConfiguration, /Role: Analyst/);

  const saved = await repository.findById(workspaceA, "agent-update");
  assert.equal(saved.role, "Analyst");
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ agentId: "agent-toggle" }));

  const disabled = await useCases.disableAgent(workspaceA, "agent-toggle");
  assert.equal(disabled.status, "disabled");

  let saved = await repository.findById(workspaceA, "agent-toggle");
  assert.equal(saved.status, "disabled");
  assert.equal(saved.updatedAt, "2026-06-20T01:00:00.000Z");

  const selectableAfterDisable = await repository.listByWorkspace(workspaceA, {
    statuses: ["enabled"]
  });
  assert.deepEqual(selectableAfterDisable, []);

  const enabled = await useCases.enableAgent(workspaceA, "agent-toggle");
  assert.equal(enabled.status, "enabled");

  saved = await repository.findById(workspaceA, "agent-toggle");
  assert.equal(saved.status, "enabled");
  assert.equal(saved.updatedAt, "2026-06-20T02:00:00.000Z");
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ agentId: "agent-delete" }));

  const deleted = await useCases.deleteAgent(workspaceA, "agent-delete");
  assert.equal(deleted.status, "deleted");

  const activeAgents = await useCases.listAgents(workspaceA);
  assert.deepEqual(activeAgents, []);

  const selectableAgents = await repository.listByWorkspace(workspaceA, {
    statuses: ["enabled"]
  });
  assert.deepEqual(selectableAgents, []);

  await assert.rejects(
    () => useCases.enableAgent(workspaceA, "agent-delete"),
    AgentValidationError
  );
}

console.log("agent management lifecycle checks passed");
