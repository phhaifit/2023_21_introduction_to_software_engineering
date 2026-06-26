import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";

import { AgentLifecycleUseCases } from "@vcp/backend/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgent } from "@vcp/backend/modules/agent-management/domain/agent.ts";
import { createAgentManagementRouter } from "@vcp/backend/modules/agent-management/api/agent-management-router.ts";
import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";

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
  app.use((req, res, next) => {
    const role = req.headers["x-test-role"] || "admin";
    const authenticated = req.headers["x-test-auth"] !== "false";
    const match = req.path.match(/^\/api\/workspaces\/([^\/]+)/);
    const workspaceId = match ? match[1] : "workspace-a";

    if (!authenticated) {
      req.context = { requestId: req.headers["x-request-id"] || "test-request" };
    } else {
      req.context = {
        requestId: req.headers["x-request-id"] || "test-request",
        user: {
          userId: "test-user",
          email: "test@example.com"
        },
        workspace: {
          workspaceId,
          memberId: "test-member",
          role
        }
      };
    }
    next();
  });
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

async function requestText(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "x-request-id": "test-request",
      ...(options.headers ?? {})
    }
  });

  return {
    status: response.status,
    headers: response.headers,
    body: await response.text()
  };
}

function makeAgent(overrides = {}) {
  return createAgent({
    agentId: "agent-enabled",
    workspaceId: "workspace-a",
    name: "Research Agent",
    role: "Researcher",
    model: "gemini-2.5-flash",
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
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents/models");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.deepEqual(
      response.body.data.map((model) => model.modelId),
      ["gemini-2.5-flash", "gemini-2.5-flash-lite", "openrouter/owl-alpha"]
    );
    assert.equal(response.body.data[0].providerId, "gemini");
    assert.equal(response.body.data[0].displayName, "Gemini 2.5 Flash");
    assert.ok(response.body.data[0].capabilities.includes("structured-output"));
    assert.equal(response.body.data[0].tier, "demo");
    assert.equal(response.body.data[0].enabled, true);
    assert.equal(response.body.data[0].credential, undefined);
    assert.equal(response.body.data[0].apiKey, undefined);

    const unauthorized = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/models",
      { headers: { "x-test-auth": "false" } }
    );

    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.ok, false);
    assert.equal(unauthorized.body.error.code, "auth.unauthorized");
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
  await repository.save(makeAgent());
  await repository.save(
    makeAgent({
      agentId: "agent-other-workspace",
      workspaceId: "workspace-b",
      name: "Other Agent"
    })
  );

  await withAgentApi(useCases, async (baseUrl) => {
    const configuration = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-enabled/configuration"
    );

    assert.equal(configuration.status, 200);
    assert.equal(configuration.body.ok, true);
    assert.equal(configuration.body.data.name, "Research Agent");
    assert.equal(configuration.body.data.instructions, "Prepare market research.");
    assert.equal(configuration.body.data.skillConfiguration, undefined);

    const crossWorkspace = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-other-workspace/configuration"
    );

    assert.equal(crossWorkspace.status, 404);
    assert.equal(crossWorkspace.body.error.code, "agent.not_available");
    assert.equal(crossWorkspace.body.data, undefined);
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
        model: "gemini-2.5-flash",
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

    const invalidModel = await requestJson(baseUrl, "/api/workspaces/workspace-created/agents", {
      method: "POST",
      body: {
        name: "Invalid Model Agent",
        role: "Planner",
        model: "unknown-model",
        instructions: "Create execution plans."
      }
    });

    assert.equal(invalidModel.status, 400);
    assert.equal(invalidModel.body.ok, false);
    assert.equal(invalidModel.body.error.code, "validation.invalid_input");
    assert.ok(
      invalidModel.body.error.details.issues.includes("model must match an enabled catalog model")
    );
  });
}

{
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents", {
      method: "POST",
      body: {
        name: "",
        model: "gemini-2.5-flash",
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
          model: "gemini-2.5-flash-lite",
          instructions: "Prepare cited market research."
        }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.role, "Senior Researcher");
    assert.equal(response.body.data.model, "gemini-2.5-flash-lite");
    assert.equal(response.body.data.instructions, undefined);
    assert.equal(response.body.data.skillConfiguration, undefined);

    const stored = await repository.findById("workspace-a", "agent-enabled");
    assert.equal(stored.role, "Senior Researcher");
    assert.equal(stored.model, "gemini-2.5-flash-lite");
    assert.equal(stored.instructions, "Prepare cited market research.");

    const invalidModel = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-enabled",
      {
        method: "PATCH",
        body: {
          role: "Senior Researcher",
          model: "unknown-model",
          instructions: "Prepare cited market research."
        }
      }
    );

    assert.equal(invalidModel.status, 400);
    assert.equal(invalidModel.body.ok, false);
    assert.equal(invalidModel.body.error.code, "validation.invalid_input");
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
          model: "gemini-2.5-flash",
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
  const { repository, useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents/skill-preview", {
      method: "POST",
      body: {
        name: "Preview Agent",
        role: "Researcher",
        model: "gemini-2.5-flash",
        instructions: "Summarize market signals.",
        responsibilities: ["Collect evidence"],
        requestedTools: [{ name: "Slack", reason: "Share summaries" }],
        requestedKnowledge: [{ title: "Market Report", reason: "Ground answers" }]
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.fileName, "skill.md");
    assert.match(response.body.data.markdown, /# Preview Agent/);
    assert.match(response.body.data.markdown, /## Requested Tools\n- Slack: Share summaries/);

    const list = await repository.listByWorkspace("workspace-a");
    assert.equal(list.total, 0);

    const invalid = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents/skill-preview", {
      method: "POST",
      body: {
        name: "",
        role: "Researcher",
        model: "gemini-2.5-flash",
        instructions: "Summarize market signals."
      }
    });

    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, "validation.invalid_input");
  });
}

{
  const { repository, useCases } = createUseCases();
  await repository.save(makeAgent());
  await repository.save(makeAgent({ agentId: "agent-disabled", status: "disabled" }));
  await repository.save(makeAgent({ agentId: "agent-deleted", status: "deleted" }));
  await repository.save(
    makeAgent({
      agentId: "agent-other-workspace",
      workspaceId: "workspace-b",
      name: "Other Agent"
    })
  );

  await withAgentApi(useCases, async (baseUrl) => {
    const downloaded = await requestText(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-enabled/skill.md"
    );

    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get("content-type"), /text\/markdown/);
    assert.match(downloaded.headers.get("content-disposition"), /research-agent\.skill\.md/);
    assert.match(downloaded.body, /# Research Agent/);
    assert.match(downloaded.body, /## Instructions\nPrepare market research\./);

    const disabled = await requestText(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-disabled/skill.md"
    );

    assert.equal(disabled.status, 200);

    const deleted = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-deleted/skill.md"
    );
    assert.equal(deleted.status, 404);
    assert.equal(deleted.body.error.code, "agent.not_available");

    const crossWorkspace = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/agent-other-workspace/skill.md"
    );
    assert.equal(crossWorkspace.status, 404);
    assert.equal(crossWorkspace.body.error.code, "agent.not_available");
  });
}

{
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    const valid = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/assistant/import-skill",
      {
        method: "POST",
        body: {
          markdown: "# Imported Agent\n\n## Role\nSupport",
          fileName: "skill.md"
        }
      }
    );

    assert.equal(valid.status, 200);
    assert.deepEqual(valid.body.data, { accepted: true, fileName: "skill.md" });

    const empty = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/assistant/import-skill",
      {
        method: "POST",
        body: {
          markdown: ""
        }
      }
    );

    assert.equal(empty.status, 400);
    assert.equal(empty.body.error.code, "validation.invalid_input");

    const nonMarkdown = await requestJson(
      baseUrl,
      "/api/workspaces/workspace-a/agents/assistant/import-skill",
      {
        method: "POST",
        body: {
          markdown: "plain text without markdown markers",
          fileName: "agent.txt"
        }
      }
    );

    assert.equal(nonMarkdown.status, 400);
    assert.equal(nonMarkdown.body.error.code, "validation.invalid_input");
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

{
  const { useCases } = createUseCases();

  await withAgentApi(useCases, async (baseUrl) => {
    // Test 401 Unauthorized
    const unauthResponse = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents", {
      headers: { "x-test-auth": "false" }
    });
    assert.equal(unauthResponse.status, 401);
    assert.equal(unauthResponse.body.ok, false);
    assert.equal(unauthResponse.body.error.code, "auth.unauthorized");

    // Test 403 Forbidden for Viewer on mutations
    const forbiddenResponse = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents", {
      method: "POST",
      headers: { "x-test-role": "viewer" },
      body: {
        name: "Test",
        role: "Test",
        model: "test",
        instructions: "test"
      }
    });
    assert.equal(forbiddenResponse.status, 403);
    assert.equal(forbiddenResponse.body.ok, false);
    assert.equal(forbiddenResponse.body.error.code, "auth.forbidden");

    // Test 200 OK for Viewer on reads
    const readResponse = await requestJson(baseUrl, "/api/workspaces/workspace-a/agents", {
      headers: { "x-test-role": "viewer" }
    });
    assert.equal(readResponse.status, 200);
    assert.equal(readResponse.body.ok, true);

    // Test 200 OK for Editor on mutations
    const editorResponse = await requestJson(baseUrl, "/api/workspaces/workspace-created/agents", {
      method: "POST",
      headers: { "x-test-role": "editor" },
      body: {
        name: "Test Editor",
        role: "Test",
        model: "gemini-2.5-flash",
        instructions: "test"
      }
    });
    assert.equal(editorResponse.status, 200);
    assert.equal(editorResponse.body.ok, true);
    assert.equal(editorResponse.body.data.name, "Test Editor");
  });
}

console.log("agent management api checks passed");
