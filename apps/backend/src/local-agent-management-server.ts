import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import express, { type Express } from "express";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { AgentRepository } from "./modules/agent-management/application/agent-repository.ts";
import type { AgentSkillWriter } from "./modules/agent-management/application/agent-skill-writer.ts";
import { AgentLifecycleUseCases } from "./modules/agent-management/application/agent-lifecycle-use-cases.ts";
import { createAgentManagementRouter } from "./modules/agent-management/api/agent-management-router.ts";
import { createAgent } from "./modules/agent-management/domain/agent.ts";
import { InMemoryAgentRepository } from "./modules/agent-management/infrastructure/in-memory-agent-repository.ts";
import { FileSystemAgentSkillWriter } from "./modules/agent-management/infrastructure/file-system-agent-skill-writer.ts";
import { NoOpAgentSkillWriter } from "./modules/agent-management/infrastructure/no-op-agent-skill-writer.ts";

export const LOCAL_AGENT_API_HOST = "127.0.0.1";
export const LOCAL_AGENT_API_PORT = 3001;

export type LocalAgentManagementRuntime = {
  app: Express;
  repository: AgentRepository;
  useCases: AgentLifecycleUseCases;
};

async function createRepository(): Promise<AgentRepository> {
  if (process.env.DATABASE_URL) {
    const { PrismaClient, PrismaPg } = await import("@vcp/database");
    const pg = await import("pg");
    const { PrismaAgentRepository } = await import(
      "./modules/agent-management/infrastructure/prisma-agent-repository.ts"
    );
    const Pool = pg.default ? pg.default.Pool : pg.Pool;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaAgentRepository(new PrismaClient({ adapter }));
  }

  return new InMemoryAgentRepository();
}

function createSkillWriter(): AgentSkillWriter {
  if (process.env.AGENT_SKILLS_DIR) {
    return new FileSystemAgentSkillWriter(process.env.AGENT_SKILLS_DIR);
  }
  return new NoOpAgentSkillWriter();
}

export async function createLocalAgentManagementRuntime(): Promise<LocalAgentManagementRuntime> {
  const repository = await createRepository();
  const skillWriter = createSkillWriter();
  const useCases = new AgentLifecycleUseCases({
    repository,
    skillWriter,
    now: () => new Date().toISOString(),
    generateAgentId: () => randomUUID()
  });

  if (repository instanceof InMemoryAgentRepository) {
    await seedDemoAgents(repository);
  }

  const app = express();
  app.use(express.json());

  // Fake Auth Middleware for local development
  app.use((req, res, next) => {
    const role = (req.headers["x-mock-role"] as any) || "admin";
    const anonymous = req.headers["x-mock-user"] === "anonymous";
    const match = req.path.match(/^\/api\/workspaces\/([^\/]+)/);
    const workspaceId = match ? match[1] : DEMO_WORKSPACE_ID;

    if (anonymous) {
      (req as any).context = { requestId: req.headers["x-request-id"] || randomUUID() };
    } else {
      (req as any).context = {
        requestId: req.headers["x-request-id"] || randomUUID(),
        user: {
          userId: "local-dev-user",
          email: "dev@local.test",
          displayName: "Local Developer"
        },
        workspace: {
          workspaceId,
          memberId: "local-member",
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

  return { app, repository, useCases };
}

async function seedDemoAgents(repository: AgentRepository): Promise<void> {
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
