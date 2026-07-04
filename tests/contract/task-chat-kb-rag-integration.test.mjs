import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import express from "express";

import { createTaskOrchestrationRouter } from "@vcp/backend/modules/task-orchestration/api/task-orchestration-router.ts";

const calls = [];
let responseMode = "answered";
const app = express();
app.use(express.json());
app.use((request, _response, next) => {
  request.context = {
    requestId: "task-chat-kb-test",
    user: { userId: "user-a", email: "user@example.com" },
    workspace: {
      workspaceId:
        request.header("x-test-workspace") ?? request.params.workspaceId ?? "workspace-a",
      memberId: "member-a",
      role: "admin"
    }
  };
  next();
});
app.use(
  "/api/workspaces/:workspaceId",
  createTaskOrchestrationRouter({
    orchestrator: {},
    adapter: {},
    conversationRepository: {},
    createTaskUseCase: {},
    agentKnowledgeAskPort: {
      async ask(workspaceId, agentId, request) {
        calls.push({ workspaceId, agentId, request });
        if (responseMode === "fallback") {
          return {
            status: "insufficient_evidence",
            answer:
              "I could not find enough information in this agent's assigned knowledge documents to answer reliably.",
            citations: [],
            warnings: ["insufficient_evidence"]
          };
        }
        if (responseMode === "unauthorized") {
          return {
            status: "unauthorized",
            answer: "",
            citations: [],
            warnings: ["Agent knowledge access is unavailable."]
          };
        }
        return {
          status: "answered",
          answer: "Equipment requests are reviewed within three business days.",
          citations: [
            {
              citationId: "E1",
              documentId: "document-policy",
              documentTitle: "sample-company-policy.txt",
              snippet:
                "Equipment requests are reviewed within three business days.",
              sourceType: "upload",
              sourceLocator: "text:0"
            }
          ],
          warnings: []
        };
      }
    }
  })
);

const server = createServer(app);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const answered = await post({
    agentId: "agent-a",
    message: "What is the equipment policy?"
  });
  assert.equal(answered.status, 200);
  assert.equal(answered.body.data.status, "answered");
  assert.equal(answered.body.data.citations[0].citationId, "E1");
  assert.deepEqual(calls[0], {
    workspaceId: "workspace-a",
    agentId: "agent-a",
    request: {
      message: "What is the equipment policy?",
      topK: undefined,
      filters: undefined
    }
  });
  assertSafe(answered.body);

  responseMode = "fallback";
  const fallback = await post({
    agentId: "agent-ungranted",
    message: "policy"
  });
  assert.equal(fallback.body.data.status, "insufficient_evidence");
  assert.deepEqual(fallback.body.data.citations, []);

  responseMode = "unauthorized";
  const unauthorized = await post({
    agentId: "agent-cross-workspace",
    message: "policy"
  });
  assert.equal(unauthorized.body.data.status, "unauthorized");
  assert.equal(unauthorized.body.data.answer, "");

  const invalid = await post({ agentId: "agent-a", message: "   " });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.message, "Agent and message are required.");

  const crossWorkspace = await post(
    { agentId: "agent-a", message: "policy" },
    { "x-test-workspace": "workspace-b" }
  );
  assert.equal(crossWorkspace.status, 403);
  assert.equal(crossWorkspace.body.error.code, "auth.forbidden");
  assertSafe(crossWorkspace.body);
} finally {
  server.close();
  await once(server, "close");
}

console.log("task chat KB/RAG integration checks passed");

async function post(body, headers = {}) {
  const response = await fetch(
    `${baseUrl}/api/workspaces/workspace-a/tasks/agent-knowledge/ask`,
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body)
    }
  );
  return { status: response.status, body: await response.json() };
}

function assertSafe(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /storageKey|filePath|absolutePath|localPath|privateUrl|queuePayload|workerPayload|vectorRef|rawVector|rawEmbedding|providerPayload|rawPrompt|systemPrompt|developerPrompt|stackTrace|credential|toolRuntime/i
  );
}
