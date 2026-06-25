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

// New imports for Subscription & Payment
import { createSubscriptionRouter } from "./modules/subscription-payment/api/subscription-router.ts";
import { CheckoutUseCases } from "./modules/subscription-payment/application/checkout-use-cases.ts";
import { PrismaSubscriptionRepository } from "./modules/subscription-payment/infrastructure/prisma-subscription-repository.ts";
import { InMemorySubscriptionRepository } from "./modules/subscription-payment/infrastructure/in-memory-subscription-repository.ts";
import { MockPaymentAdapter } from "./modules/subscription-payment/infrastructure/mock-payment-adapter.ts";
import { InMemoryEventBus } from "./shared/events/event-bus.ts";

import { createWorkflowManagementRouter } from "./modules/workflow-management/api/workflow-router.ts";
import { WorkflowUseCases } from "./modules/workflow-management/application/workflow-use-cases.ts";
import { PrismaWorkflowRepository } from "./modules/workflow-management/infrastructure/prisma-workflow-repository.ts";
import { InMemoryWorkflowRepository } from "./modules/workflow-management/infrastructure/in-memory-workflow-repository.ts";

import { createAuthenticationRouter } from "./modules/authentication/api/authentication-router.ts";
import { RegisterUseCase } from "./modules/authentication/application/register-use-case.ts";
import { LoginUseCase } from "./modules/authentication/application/login-use-case.ts";
import { InMemoryUserRepository } from "./modules/authentication/infrastructure/in-memory-user-repository.ts";
import { InMemorySessionRepository } from "./modules/authentication/infrastructure/in-memory-session-repository.ts";
import { BcryptPasswordHasher } from "./modules/authentication/infrastructure/bcrypt-password-hasher.ts";
import { Sha256TokenHasher } from "./modules/authentication/infrastructure/sha256-token-hasher.ts";

const backendUrlStr = process.env.BACKEND_URL || "http://127.0.0.1:3001";
const parsedBackendUrl = new URL(backendUrlStr);

export const LOCAL_AGENT_API_HOST = parsedBackendUrl.hostname;
export const LOCAL_AGENT_API_PORT = parseInt(parsedBackendUrl.port, 10) || 3001;


export type LocalAgentManagementRuntime = {
  app: Express;
  repository: AgentRepository;
  useCases: AgentLifecycleUseCases;
  subscriptionRepository: any;
  checkoutUseCases: CheckoutUseCases;
  workflowRepository: any;
  workflowUseCases: any;
};

let cachedPrisma: any = null;

async function getPrismaClient(): Promise<any> {
  if (cachedPrisma) return cachedPrisma;
  if (process.env.DATABASE_URL) {
    const { PrismaClient, PrismaPg } = await import("@vcp/database");
    const pg = await import("pg");
    const Pool = pg.default ? pg.default.Pool : pg.Pool;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    cachedPrisma = new PrismaClient({ adapter });
    return cachedPrisma;
  }
  return null;
}

async function createRepository(): Promise<AgentRepository> {
  const prisma = await getPrismaClient();
  if (prisma) {
    const { PrismaAgentRepository } = await import(
      "./modules/agent-management/infrastructure/prisma-agent-repository.ts"
    );
    return new PrismaAgentRepository(prisma);
  }

  return new InMemoryAgentRepository();
}

async function createSubscriptionRepository(): Promise<any> {
  const prisma = await getPrismaClient();
  if (prisma) {
    return new PrismaSubscriptionRepository(prisma);
  }
  return new InMemorySubscriptionRepository();
}

function createSkillWriter(): AgentSkillWriter {
  if (process.env.AGENT_SKILLS_DIR) {
    return new FileSystemAgentSkillWriter(process.env.AGENT_SKILLS_DIR);
  }
  return new NoOpAgentSkillWriter();
}

export async function createLocalAgentManagementRuntime(): Promise<LocalAgentManagementRuntime> {
  const repository = await createRepository();
  const subscriptionRepository = await createSubscriptionRepository();
  const skillWriter = createSkillWriter();
  
  const eventBus = new InMemoryEventBus();

  const useCases = new AgentLifecycleUseCases({
    repository,
    skillWriter,
    now: () => new Date().toISOString(),
    generateAgentId: () => randomUUID()
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";

  const checkoutUseCases = new CheckoutUseCases({
    repository: subscriptionRepository,
    paymentAdapter: new MockPaymentAdapter(frontendUrl),
    eventBus,
    now: () => new Date().toISOString(),
    generateSubscriptionId: () => randomUUID() as any,
    generateTransactionId: () => randomUUID() as any,
    generateEventId: () => randomUUID() as any
  });

  const prisma = await getPrismaClient();
  const workflowRepository = prisma ? new PrismaWorkflowRepository(prisma) : new InMemoryWorkflowRepository();
  
  const mockExecutionHandoff = {
    async handoffExecution(request: any) {
      console.log("[Handoff] Mock Workflow Execution Handoff triggered:");
      console.log(JSON.stringify(request, null, 2));
    }
  };

  const agentProvider = async (workspaceId: any, agentIds: any[]) => {
    const all = await repository.listByWorkspace(workspaceId, { limit: 100, offset: 0 });
    return all.filter((a: any) => agentIds.includes(a.agentId));
  };

  const workflowUseCases = new WorkflowUseCases(
    workflowRepository,
    agentProvider,
    mockExecutionHandoff
  );

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

  app.use(
    "/api/subscriptions",
    createSubscriptionRouter({ useCases: checkoutUseCases })
  );

  app.use(
    "/api/workspaces/:workspaceId/workflows",
    createWorkflowManagementRouter({ useCases: workflowUseCases })
  );

  const authUserRepository = new InMemoryUserRepository();
  const authSessionRepository = new InMemorySessionRepository();
  const authPasswordHasher = new BcryptPasswordHasher();
  const authTokenHasher = new Sha256TokenHasher();
  app.use(
    "/api/auth",
    createAuthenticationRouter({
      registerUseCase: new RegisterUseCase(authUserRepository, authPasswordHasher),
      loginUseCase: new LoginUseCase(
        authUserRepository,
        authSessionRepository,
        authPasswordHasher,
        authTokenHasher
      ),
    })
  );

  return { app, repository, useCases, subscriptionRepository, checkoutUseCases, workflowRepository, workflowUseCases };
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
  await repository.save(
    createAgent({
      agentId: "agent-writer",
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Writer Agent",
      role: "Content Writer",
      model: "gpt-3.5",
      instructions: "Draft content based on research briefs.",
      createdAt: "2026-06-20T10:00:00.000Z",
      updatedAt: "2026-06-20T10:00:00.000Z"
    })
  );
}

const entryPath = process.argv[1];

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const { app } = await createLocalAgentManagementRuntime();
  app.listen(LOCAL_AGENT_API_PORT, LOCAL_AGENT_API_HOST, () => {
    console.log(`Agent & Billing API: http://${LOCAL_AGENT_API_HOST}:${LOCAL_AGENT_API_PORT}`);
  });
}
