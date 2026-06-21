import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import { createLocalAgentManagementRuntime } from "@vcp/backend/local-agent-management-server.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

const runtime = await createLocalAgentManagementRuntime();
const server = createServer(runtime.app);
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const collectionUrl = `${baseUrl}/api/workspaces/${DEMO_WORKSPACE_ID}/agents`;

try {
  const initial = await fetch(collectionUrl).then((response) => response.json());
  assert.deepEqual(
    initial.data.map((agent) => agent.agentId),
    ["agent-support", "agent-research"]
  );

  const created = await fetch(collectionUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Planning Agent",
      role: "Planner",
      model: "gpt-4.1-mini",
      instructions: "Create execution plans."
    })
  }).then((response) => response.json());

  const stored = await runtime.repository.findById(DEMO_WORKSPACE_ID, created.data.agentId);
  assert.equal(stored.name, "Planning Agent");

  const refreshed = await fetch(collectionUrl).then((response) => response.json());
  assert.equal(refreshed.data.some((agent) => agent.agentId === created.data.agentId), true);
} finally {
  server.close();
  await once(server, "close");
}

console.log("agent management local runtime checks passed");
