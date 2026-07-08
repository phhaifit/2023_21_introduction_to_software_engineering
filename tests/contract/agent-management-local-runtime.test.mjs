import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import { createLocalAgentManagementRuntime } from "@vcp/backend/local-agent-management-server.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

const runtime = await createLocalAgentManagementRuntime();
const server = createServer(runtime.app);
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const collectionUrl = `${baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/agents`;

try {
  const unauthenticated = await fetch(collectionUrl);
  const unauthenticatedBody = await unauthenticated.json();
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticatedBody.error.code, "auth.unauthorized");

  const forbidden = await fetch(collectionUrl, {
    headers: { "x-mock-user": "local-nonmember-user" }
  });
  const forbiddenBody = await forbidden.json();
  assert.equal(forbidden.status, 403);
  assert.equal(forbiddenBody.error.code, "auth.forbidden");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "dev@local.test", password: "Password123!" })
  }).then((response) => response.json());
  const authHeaders = {
    authorization: `Bearer ${login.data.session.token}`
  };

  const initial = await fetch(collectionUrl, { headers: authHeaders }).then((response) => response.json());
  assert.deepEqual(
    initial.data.map((agent) => agent.agentId),
    ["agent-support", "agent-research", "agent-writer"]
  );

  const created = await fetch(collectionUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders },
    body: JSON.stringify({
      name: "Planning Agent",
      role: "Planner",
      model: "gemini-2.5-flash",
      instructions: "Create execution plans."
    })
  }).then((response) => response.json());

  const stored = await runtime.repository.findById(DEMO_WORKSPACE_ID, created.data.agentId);
  assert.equal(stored.name, "Planning Agent");

  const refreshed = await fetch(collectionUrl, { headers: authHeaders }).then((response) => response.json());
  assert.equal(refreshed.data.some((agent) => agent.agentId === created.data.agentId), true);
} finally {
  server.close();
  await once(server, "close");
  if (originalDatabaseUrl) {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

console.log("agent management local runtime checks passed");
process.exit(0);
