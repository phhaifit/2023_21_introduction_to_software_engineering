import assert from "node:assert/strict";

import {
  AgentLifecycleUseCases,
  AgentNotFoundError,
  AgentValidationError
} from "@vcp/backend/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgent } from "@vcp/backend/modules/agent-management/domain/agent.ts";
import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";

function createHarness(options = {}) {
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
      ...(options.modelCatalog ? { modelCatalog: options.modelCatalog } : {}),
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
    model: "gemini-2.5-flash",
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
    agents.items.map((agent) => agent.agentId),
    ["agent-enabled", "agent-disabled"]
  );
  assert.deepEqual(Object.keys(agents.items[0]), [
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
    model: " gemini-2.5-flash ",
    instructions: " Resolve customer tickets. "
  });

  assert.equal(result.agent.agentId, "agent-1");
  assert.equal(result.agent.name, "Support Agent");
  assert.equal(result.agent.role, "Customer Support");
  assert.equal(result.agent.model, "gemini-2.5-flash");
  assert.equal(result.agent.instructions, "Resolve customer tickets.");
  assert.equal(result.agent.status, "enabled");
  assert.match(result.skillConfiguration, /# Support Agent/);
  assert.match(result.skillConfiguration, /## Role\nCustomer Support/);
  assert.match(result.skillConfiguration, /## Model\ngemini-2\.5-flash/);
  assert.match(result.skillConfiguration, /Resolve customer tickets\./);

  const saved = await repository.findById(workspaceA, "agent-1");
  assert.equal(saved.name, "Support Agent");
}

{
  const { repository, useCases } = createHarness();
  const result = await useCases.createAgent({
    workspaceId: workspaceA,
    name: "Runtime Agent",
    role: "Support",
    model: "gemini-2.5-flash",
    instructions: "Answer support questions.",
    responsibilities: ["Triage customer issues", "Summarize blockers"],
    operatingContext: "Use only approved workspace context.",
    requestedTools: [{ name: "Slack", reason: "Notify owners" }],
    requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
    constraints: ["Do not promise refunds"],
    escalationRules: ["Escalate billing disputes"],
    exampleTasks: ["Draft a support response"]
  });

  const saved = await repository.findById(workspaceA, result.agent.agentId);
  assert.deepEqual(saved.runtimeConfiguration.responsibilities, [
    "Triage customer issues",
    "Summarize blockers"
  ]);
  assert.equal(saved.runtimeConfiguration.operatingContext, "Use only approved workspace context.");
  assert.deepEqual(saved.runtimeConfiguration.requestedTools, [
    { name: "Slack", reason: "Notify owners" }
  ]);
  assert.match(result.skillConfiguration, /## Responsibilities\n- Triage customer issues/);
  assert.match(result.skillConfiguration, /## Requested Knowledge\n- Support Handbook: Ground answers/);

  const profile = await useCases.getAgentRuntimeProfile(workspaceA, result.agent.agentId);
  assert.equal(profile.agentId, result.agent.agentId);
  assert.equal(profile.workspaceId, workspaceA);
  assert.equal(profile.status, "enabled");
  assert.equal(profile.runnable, true);
  assert.equal(profile.model, "gemini-2.5-flash");
  assert.equal(profile.materializationHints.profileVersion, "agent-runtime-profile.v1");
  assert.equal(profile.materializationHints.runtimeOwner, "task-orchestration-openclaw");
  assert.equal(profile.materializationHints.skillFileName, "skill.md");
  assert.equal(profile.materializationHints.requiresCurrentToolResolution, true);
  assert.equal(profile.materializationHints.requiresCurrentKnowledgeResolution, true);
  assert.match(profile.materializationHints.agentDirectoryName, /^runtime-agent-agent-1$/);
  assert.match(profile.skillMarkdown, /# Runtime Agent/);
  assert.match(profile.skillMarkdown, /## Constraints\n- Do not promise refunds/);
  assert.equal(profile.runtimeConfiguration.responsibilities[0], "Triage customer issues");

  const serializedProfile = JSON.stringify(profile);
  assert.doesNotMatch(
    serializedProfile,
    /credential|secret|token|apiKey|rawProvider|providerError|runtimeUrl|containerId|terminalCommand|taskManifest|assignmentId|grantId/i
  );
}

{
  const { repository, useCases } = createHarness();
  const preview = useCases.previewSkillMarkdown({
    name: " Draft Agent ",
    role: " Analyst ",
    model: " gemini-2.5-flash ",
    instructions: " Prepare weekly updates. ",
    responsibilities: ["Summarize business signals"],
    requestedTools: [{ name: "Slack", reason: "Share updates" }],
    requestedKnowledge: [{ title: "Revenue Report", reason: "Use current numbers" }]
  });

  assert.equal(preview.fileName, "skill.md");
  assert.match(preview.markdown, /# Draft Agent/);
  assert.match(preview.markdown, /## Responsibilities\n- Summarize business signals/);
  assert.match(preview.markdown, /## Requested Tools\n- Slack: Share updates/);
  const list = await repository.listByWorkspace(workspaceA);
  assert.equal(list.total, 0);

  assert.throws(
    () =>
      useCases.previewSkillMarkdown({
        name: "",
        role: "Analyst",
        model: "gemini-2.5-flash",
        instructions: "Prepare updates."
      }),
    AgentValidationError
  );
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
      name: "Other Agent"
    })
  );

  const enabled = await useCases.downloadAgentSkillMarkdown(workspaceA, "agent-enabled");
  const disabled = await useCases.downloadAgentSkillMarkdown(workspaceA, "agent-disabled");

  assert.equal(enabled.fileName, "skill.md");
  assert.match(enabled.markdown, /# Enabled Agent/);
  assert.match(disabled.markdown, /# Disabled Agent/);
  assert.match(disabled.markdown, /## Responsibilities\n_Not specified\._/);

  await assert.rejects(
    () => useCases.downloadAgentSkillMarkdown(workspaceA, "agent-deleted"),
    AgentNotFoundError
  );
  await assert.rejects(
    () => useCases.downloadAgentSkillMarkdown(workspaceA, "agent-other-workspace"),
    AgentNotFoundError
  );
}

{
  const { repository, useCases } = createHarness();
  await repository.save(makeAgent({ agentId: "agent-basic", name: "Basic Agent" }));
  await repository.save(makeAgent({ agentId: "agent-disabled", status: "disabled" }));
  await repository.save(makeAgent({ agentId: "agent-deleted", status: "deleted" }));
  await repository.save(
    makeAgent({
      agentId: "agent-other-workspace",
      workspaceId: workspaceB,
      name: "Other Agent"
    })
  );

  const basicProfile = await useCases.getAgentRuntimeProfile(workspaceA, "agent-basic");
  assert.deepEqual(basicProfile.runtimeConfiguration, {
    responsibilities: [],
    operatingContext: undefined,
    requestedTools: [],
    requestedKnowledge: [],
    constraints: [],
    escalationRules: [],
    exampleTasks: []
  });
  assert.equal(basicProfile.materializationHints.requiresCurrentToolResolution, false);
  assert.equal(basicProfile.materializationHints.requiresCurrentKnowledgeResolution, false);
  assert.match(basicProfile.skillMarkdown, /## Requested Tools\n_Not specified\._/);

  await assert.rejects(
    () => useCases.getAgentRuntimeProfile(workspaceA, "agent-disabled"),
    AgentNotFoundError
  );
  await assert.rejects(
    () => useCases.getAgentRuntimeProfile(workspaceA, "agent-deleted"),
    AgentNotFoundError
  );
  await assert.rejects(
    () => useCases.getAgentRuntimeProfile(workspaceA, "agent-other-workspace"),
    AgentNotFoundError
  );
}

{
  const { useCases } = createHarness();

  assert.deepEqual(
    useCases.validateSkillMarkdownImport({
      markdown: "# Imported Agent\n\n## Role\nSupport",
      fileName: "skill.md"
    }),
    { markdown: "# Imported Agent\n\n## Role\nSupport", fileName: "skill.md" }
  );

  assert.throws(
    () => useCases.validateSkillMarkdownImport({ markdown: "   " }),
    AgentValidationError
  );
  assert.throws(
    () =>
      useCases.validateSkillMarkdownImport({
        markdown: "plain text without markdown markers",
        fileName: "skill.txt"
      }),
    AgentValidationError
  );
}

{
  const disabledCatalog = {
    async listModels() {
      return [
        {
          providerId: "gemini",
          modelId: "gemini-2.5-flash",
          displayName: "Gemini 2.5 Flash",
          capabilities: ["text-generation"],
          tier: "demo",
          enabled: true
        },
        {
          providerId: "gemini",
          modelId: "disabled-demo-model",
          displayName: "Disabled Demo Model",
          capabilities: ["text-generation"],
          tier: "demo",
          enabled: false
        }
      ];
    }
  };
  const { useCases } = createHarness({ modelCatalog: disabledCatalog });

  const models = await useCases.listAgentModels(workspaceA);

  assert.deepEqual(
    models.map((model) => model.modelId),
    ["gemini-2.5-flash"]
  );
  assert.deepEqual(models[0].capabilities, ["text-generation"]);

  await assert.rejects(
    () =>
      useCases.createAgent({
        workspaceId: workspaceA,
        name: "Disabled Model Agent",
        role: "Researcher",
        model: "disabled-demo-model",
        instructions: "Prepare research."
      }),
    AgentValidationError
  );
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
        model: "gemini-2.5-flash",
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

  await assert.rejects(
    () =>
      useCases.createAgent({
        workspaceId: workspaceA,
        name: "Unknown Model Agent",
        role: "Researcher",
        model: "unknown-model",
        instructions: "Prepare research."
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
    model: "gemini-2.5-flash-lite",
    instructions: "Prepare weekly analysis.",
    constraints: ["Cite sources"],
    exampleTasks: ["Prepare a weekly report"]
  });

  assert.equal(result.agent.role, "Analyst");
  assert.equal(result.agent.model, "gemini-2.5-flash-lite");
  assert.equal(result.agent.instructions, "Prepare weekly analysis.");
  assert.equal(result.agent.updatedAt, "2026-06-20T01:00:00.000Z");
  assert.match(result.skillConfiguration, /## Role\nAnalyst/);
  assert.match(result.skillConfiguration, /## Constraints\n- Cite sources/);

  const saved = await repository.findById(workspaceA, "agent-update");
  assert.equal(saved.role, "Analyst");
  assert.deepEqual(saved.runtimeConfiguration.exampleTasks, ["Prepare a weekly report"]);

  await assert.rejects(
    () =>
      useCases.updateAgent({
        workspaceId: workspaceA,
        agentId: "agent-update",
        role: "Analyst",
        model: "unknown-model",
        instructions: "Prepare weekly analysis."
      }),
    AgentValidationError
  );
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
  assert.deepEqual(selectableAfterDisable.agents, []);

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
  assert.deepEqual(activeAgents.items, []);

  const selectableAgents = await repository.listByWorkspace(workspaceA, {
    statuses: ["enabled"]
  });
  assert.deepEqual(selectableAgents.agents, []);

  await assert.rejects(
    () => useCases.enableAgent(workspaceA, "agent-delete"),
    AgentValidationError
  );
}

console.log("agent management lifecycle checks passed");
