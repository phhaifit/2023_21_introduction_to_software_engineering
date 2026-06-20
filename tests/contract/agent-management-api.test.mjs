import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";

import { AgentLifecycleUseCases } from "../../backend/src/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgent } from "../../backend/src/modules/agent-management/domain/agent.ts";
import { createAgentManagementRouter } from "../../backend/src/modules/agent-management/api/agent-management-router.ts";
import { InMemoryAgentRepository } from "../../backend/src/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

function createUseCases(repository = new InMemoryAgentRepository()) {
  let idSequence = 0;
  let timeSequence = 0;

  return {
    repository,
    useCases: new AgentLifecycleUseCases({
      repository,
      now: () => `2026-06-20T00:00:0${timeSequence++}.000Z`,
      generateAgentId: () => `agent-created-${++idSequence}`
    })
  };
}

async function withAgentApi(useCases, callback) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/workspaces/:workspaceId/agents",
    createAgentManagementRouter({ useCases })
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-request-id": "test-request",
      ...(options.headers ?? {})
    },
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

function makeAgent(overrides = {}) {
  return createAgent({
    agentId: "agent-enabled",
    workspaceId: "workspace-a",
    name: "Research Agent",
    role: "Researcher",
    model: "gpt-4.1-mini",
    instructions: "Prepare market research.",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides
  });
}

{
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.deepEqual(response.body.data, []);
    assert.equal(response.body.meta.requestId, "test-request");
    assert.match(response.body.meta.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });
}

{
  const { repository, useCases } = createUseCases();
  await repository.save(makeAgent());
  await repository.save(
    makeAgent({
      agentId: "agent-disabled",
      name: "Support Agent",
      role: "Support",
      status: "disabled"
    })
  );
  await repository.save(
    makeAgent({
      agentId: "agent-deleted",
      name: "Deleted Agent",
      status: "deleted"
    })
  );
  await repository.save(
    makeAgent({
      agentId: "agent-other-workspace",
      workspaceId: "workspace-b",
      name: "Other Workspace Agent"
    })
  );

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.deepEqual(
      response.body.data.map((agent) => agent.agentId).sort(),
      ["agent-disabled", "agent-enabled"]
    );
    assert.equal(
      response.body.data.some((agent) => agent.agentId === "agent-deleted"),
      false
    );
    assert.equal(
      response.body.data.some((agent) => agent.agentId === "agent-other-workspace"),
      false
    );
    assert.equal(response.body.data[0].instructions, undefined);
  });
}

{
  const { repository, useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-created/agents", {
      method: "POST",
      body: {
        name: "Planning Agent",
        role: "Planner",
        model: "gpt-4.1-mini",
        instructions: "Create execution plans."
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.agentId, "agent-created-1");
    assert.equal(response.body.data.workspaceId, "workspace-created");
    assert.equal(response.body.data.name, "Planning Agent");
    assert.equal(response.body.data.status, "enabled");
    assert.equal(response.body.data.instructions, undefined);
    assert.equal(response.body.data.skillConfiguration, undefined);

    const stored = await repository.findById("workspace-created", "agent-created-1");
    assert.equal(stored.workspaceId, "workspace-created");
  });
}

{
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents", {
      method: "POST",
      body: {
        name: "",
        model: "gpt-4.1-mini",
        instructions: "Missing role."
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, "validation.invalid_input");
    assert.match(response.body.error.message, /Invalid agent configuration/);
    assert.ok(response.body.error.details.issues.includes("role is required"));
    assert.equal(response.body.data, undefined);
    assert.equal(response.body.meta.requestId, "test-request");
    assert.match(response.body.meta.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });
}

{
  const { repository, useCases } = createUseCases();
  await repository.save(makeAgent());

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-enabled",
      {
        method: "PATCH",
        body: {
          role: "Senior Researcher",
          model: "gpt-4.1",
          instructions: "Prepare cited market research."
        }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.role, "Senior Researcher");
    assert.equal(response.body.data.model, "gpt-4.1");
    assert.equal(response.body.data.instructions, undefined);
    assert.equal(response.body.data.skillConfiguration, undefined);

    const stored = await repository.findById("workspace-a", "agent-enabled");
    assert.equal(stored.role, "Senior Researcher");
    assert.equal(stored.model, "gpt-4.1");
    assert.equal(stored.instructions, "Prepare cited market research.");
  });
}

{
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/missing-agent",
      {
        method: "PATCH",
        body: {
          role: "Researcher",
          model: "gpt-4.1-mini",
          instructions: "Prepare market research."
        }
      }
    );

    assert.equal(response.status, 404);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, "agent.not_available");
  });
}

{
  const { repository, useCases } = createUseCases();
  await repository.save(
    makeAgent({
      agentId: "workspace-b-agent",
      workspaceId: "workspace-b"
    })
  );

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/workspace-b-agent/disable",
      { method: "POST" }
    );

    assert.equal(response.status, 404);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, "agent.not_available");
  });
}

{
  const unexpectedUseCases = {
    async listAgents() {
      throw new Error("repository unavailable");
    }
  };

  await withAgentApi(unexpectedUseCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents");

    assert.equal(response.status, 500);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, "system.unexpected_error");
    assert.equal(response.body.error.message.includes("repository unavailable"), false);
    assert.equal(response.body.meta.requestId, "test-request");
  });
}

{
  const { repository, useCases } = createUseCases();
  await repository.save(makeAgent());
  await repository.save(
    makeAgent({
      agentId: "agent-disabled",
      name: "Support Agent",
      role: "Support",
      status: "disabled"
    })
  );

  await withAgentApi(useCases, async (baseUrl) => {
    const disabled = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-enabled/disable",
      { method: "POST" }
    );
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data.status, "disabled");
    assert.equal(disabled.body.data.instructions, undefined);
    assert.equal(disabled.body.data.skillConfiguration, undefined);

    const enabled = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-disabled/enable",
      { method: "POST" }
    );
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.data.status, "enabled");
    assert.equal(enabled.body.data.instructions, undefined);
    assert.equal(enabled.body.data.skillConfiguration, undefined);

    const deleted = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-enabled",
      { method: "DELETE" }
    );
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.status, "deleted");
    assert.equal(deleted.body.data.instructions, undefined);
    assert.equal(deleted.body.data.skillConfiguration, undefined);

    const listed = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents");
    assert.equal(
      listed.body.data.some((agent) => agent.agentId === "agent-enabled"),
      false
    );
  });
}

console.log("agent management api checks passed");
