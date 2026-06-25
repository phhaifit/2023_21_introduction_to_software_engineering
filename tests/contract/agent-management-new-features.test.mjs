import assert from "node:assert/strict";
import request from "supertest";
import express from "express";

import { InMemoryAgentRepository } from "@vcp/backend/modules/agent-management/infrastructure/in-memory-agent-repository.ts";
import { AgentLifecycleUseCases } from "@vcp/backend/modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgentManagementRouter } from "@vcp/backend/modules/agent-management/api/agent-management-router.ts";

const repository = new InMemoryAgentRepository();
const useCases = new AgentLifecycleUseCases({
  repository,
  now: () => "2026-06-20T00:00:00.000Z",
  generateAgentId: () => `test-agent-${Date.now()}`
});
const router = createAgentManagementRouter({ useCases });

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  req.context = {
    user: { id: "user-1", email: "test@example.com" },
    workspace: { workspaceId: "ws-1", name: "Test WS", role: "owner" }
  };
  next();
});

app.use("/api/agents", router);

async function runTests() {
  const createRes = await request(app)
    .post("/api/agents")
    .send({ name: "Alpha", role: "R1", model: "m1", instructions: "i1" });
  
  assert.equal(createRes.status, 200, "Create should succeed");
  const agentId = createRes.body.data.agentId;

  const renameRes = await request(app)
    .patch(`/api/agents/${agentId}/name`)
    .send({ name: "Alpha Renamed" });
  
  assert.equal(renameRes.status, 200, "Rename should succeed");
  assert.equal(renameRes.body.data.name, "Alpha Renamed");

  const renameDupRes = await request(app)
    .patch(`/api/agents/${agentId}/name`)
    .send({ name: "" });
  assert.equal(renameDupRes.status, 400, "Rename empty name should fail");

  const dupRes = await request(app)
    .post(`/api/agents/${agentId}/duplicate`);
  
  assert.equal(dupRes.status, 200, "Duplicate should succeed");
  assert.equal(dupRes.body.data.name, "Alpha Renamed (Copy)");
  assert.equal(dupRes.body.data.role, "R1");
  const dupId = dupRes.body.data.agentId;

  const listRes = await request(app)
    .get("/api/agents?search=copy")
    .expect(200);
  
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0].agentId, dupId);
  assert.equal(listRes.body.meta.pagination.totalItems, 1);
  assert.equal(listRes.body.meta.pagination.page, 1);

  console.log("agent management new features api tests passed");
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
