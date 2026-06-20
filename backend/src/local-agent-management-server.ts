import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import express, { type Express } from "express";

import { DEMO_WORKSPACE_ID } from "../../shared/demo-workspace.ts";
import { AgentLifecycleUseCases } from "./modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgentManagementRouter } from "./modules/agent-management/api/agent-management-router.ts";
import { createAgent } from "./modules/agent-management/domain/agent.ts";
import { InMemoryAgentRepository } from "./modules/agent-management/infrastructure/in-memory-agent-repository.ts";

export const LOCAL_AGENT_API_HOST = "127.0.0.1";
export const LOCAL_AGENT_API_PORT = 3001;

export type LocalAgentManagementRuntime = {
  app: Express;
  repository: InMemoryAgentRepository;
  useCases: AgentLifecycleUseCases;
};

export async function createLocalAgentManagementRuntime(): Promise<LocalAgentManagementRuntime> {
  const repository = new InMemoryAgentRepository();
  const useCases = new AgentLifecycleUseCases({
    repository,
    now: () => new Date().toISOString(),
    generateAgentId: () => randomUUID()
  });

  await seedDemoAgents(repository);

  const app = express();
  app.use(express.json());
  app.use(
    "/api/workspaces/:workspaceId/agents",
    createAgentManagementRouter({ useCases })
  );

  return { app, repository, useCases };
}

async function seedDemoAgents(repository: InMemoryAgentRepository): Promise<void> {
  await repository.save(
    createAgent({
      agentId: "agent-research",
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Research Agent",
      role: "Market researcher",
      model: "gpt-4.1-mini",
      instructions: "Track market signals and prepare concise opportunity briefs.",
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:30:00.000Z"
    })
  );
  await repository.save(
    createAgent({
      agentId: "agent-support",
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Support Agent",
      role: "Customer support",
      model: "gpt-4.1-mini",
      instructions: "Draft support replies and flag conversations that need a human owner.",
      status: "disabled",
      createdAt: "2026-06-19T09:15:00.000Z",
      updatedAt: "2026-06-20T07:45:00.000Z"
    })
  );
}

const entryPath = process.argv[1];

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const { app } = await createLocalAgentManagementRuntime();
  app.listen(LOCAL_AGENT_API_PORT, LOCAL_AGENT_API_HOST, () => {
    console.log(`Agent API: http://${LOCAL_AGENT_API_HOST}:${LOCAL_AGENT_API_PORT}`);
  });
}
