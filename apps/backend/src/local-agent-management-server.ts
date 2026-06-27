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
import { WorkflowExecutionService } from "./modules/task-orchestration/application/workflow-execution-service.ts";

import { createAuthenticationRouter } from "./modules/authentication/api/authentication-router.ts";
import { RegisterUseCase } from "./modules/authentication/application/register-use-case.ts";
import { LoginUseCase } from "./modules/authentication/application/login-use-case.ts";
import { LogoutUseCase } from "./modules/authentication/application/logout-use-case.ts";
import { AuthenticateSessionUseCase } from "./modules/authentication/application/authenticate-session-use-case.ts";
import { InMemoryUserRepository } from "./modules/authentication/infrastructure/in-memory-user-repository.ts";
import { InMemorySessionRepository } from "./modules/authentication/infrastructure/in-memory-session-repository.ts";
import { PrismaUserRepository } from "./modules/authentication/infrastructure/prisma-user-repository.ts";
import { PrismaSessionRepository } from "./modules/authentication/infrastructure/prisma-session-repository.ts";
import { BcryptPasswordHasher } from "./modules/authentication/infrastructure/bcrypt-password-hasher.ts";
import { Sha256TokenHasher } from "./modules/authentication/infrastructure/sha256-token-hasher.ts";
import { createKnowledgeBaseRagRouter } from "./modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import { KnowledgeDataSourceUseCases } from "./modules/knowledge-base-rag/application/knowledge-data-source-use-cases.ts";
import { KnowledgeDocumentUseCases } from "./modules/knowledge-base-rag/application/knowledge-document-use-cases.ts";
import { KnowledgeIngestionUseCases } from "./modules/knowledge-base-rag/application/knowledge-ingestion-use-cases.ts";
import { KnowledgeSyncUseCases } from "./modules/knowledge-base-rag/application/knowledge-sync-use-cases.ts";
import { KnowledgeUploadUseCases } from "./modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "./modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { PrismaKnowledgeDataSourceRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-data-source-repository.ts";
import { PrismaKnowledgeDocumentRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-document-repository.ts";
import { PrismaKnowledgeIngestionJobRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-ingestion-job-repository.ts";
import {
  PrismaKnowledgeSyncJobRepository,
  PrismaKnowledgeSyncScopeRepository
} from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-sync-repository.ts";

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
  knowledgeBaseRagRepositories: any;
  knowledgeBaseRagUseCases: any;
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

async function createAuthUserRepository(): Promise<any> {
  const prisma = await getPrismaClient();
  if (prisma) {
    return new PrismaUserRepository(prisma);
  }
  return new InMemoryUserRepository();
}

async function createAuthSessionRepository(): Promise<any> {
  const prisma = await getPrismaClient();
  if (prisma) {
    return new PrismaSessionRepository(prisma);
  }
  return new InMemorySessionRepository();
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
  const knowledgeDocumentRepository = prisma
    ? new PrismaKnowledgeDocumentRepository(prisma)
    : new InMemoryKnowledgeDocumentRepository();
  const knowledgeIngestionJobRepository = prisma
    ? new PrismaKnowledgeIngestionJobRepository(prisma)
    : new InMemoryKnowledgeIngestionJobRepository();
  const knowledgeDataSourceRepository = prisma
    ? new PrismaKnowledgeDataSourceRepository(prisma)
    : new InMemoryKnowledgeDataSourceRepository();
  const knowledgeSyncScopeRepository = prisma
    ? new PrismaKnowledgeSyncScopeRepository(prisma)
    : new InMemoryKnowledgeSyncScopeRepository();
  const knowledgeSyncJobRepository = prisma
    ? new PrismaKnowledgeSyncJobRepository(prisma)
    : new InMemoryKnowledgeSyncJobRepository();
  const knowledgeBaseRagRepositories = {
    documentRepository: knowledgeDocumentRepository,
    ingestionJobRepository: knowledgeIngestionJobRepository,
    dataSourceRepository: knowledgeDataSourceRepository,
    syncScopeRepository: knowledgeSyncScopeRepository,
    syncJobRepository: knowledgeSyncJobRepository
  };
  const knowledgeBaseRagUseCases = {
    documentUseCases: new KnowledgeDocumentUseCases({
      documentRepository: knowledgeDocumentRepository
    }),
    uploadUseCases: new KnowledgeUploadUseCases({
      documentRepository: knowledgeDocumentRepository,
      ingestionJobRepository: knowledgeIngestionJobRepository,
      now: () => new Date().toISOString(),
      generateDocumentId: () => randomUUID() as any,
      generateJobId: () => randomUUID() as any
    }),
    ingestionUseCases: new KnowledgeIngestionUseCases({
      ingestionJobRepository: knowledgeIngestionJobRepository
    }),
    dataSourceUseCases: new KnowledgeDataSourceUseCases({
      dataSourceRepository: knowledgeDataSourceRepository,
      now: () => new Date().toISOString()
    }),
    syncUseCases: new KnowledgeSyncUseCases({
      syncScopeRepository: knowledgeSyncScopeRepository,
      syncJobRepository: knowledgeSyncJobRepository,
      now: () => new Date().toISOString(),
      generateJobId: () => randomUUID() as any
    })
  };
  
  const executionService = new WorkflowExecutionService();

  const agentProvider = async (workspaceId: any, agentIds: any[]) => {
    const all = await repository.listByWorkspace(workspaceId, { limit: 100, offset: 0 } as any);
    return all.agents.filter((a: any) => agentIds.includes(a.agentId));
  };

  const workflowUseCases = new WorkflowUseCases(
    workflowRepository,
    agentProvider,
    executionService
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

  app.use(createKnowledgeBaseRagRouter(knowledgeBaseRagUseCases));

  const authUserRepository = await createAuthUserRepository();
  const authSessionRepository = await createAuthSessionRepository();
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
      logoutUseCase: new LogoutUseCase(authSessionRepository, authTokenHasher),
      authenticateSessionUseCase: new AuthenticateSessionUseCase(
        authSessionRepository,
        authUserRepository,
        authTokenHasher
      ),
    })
  );

  return {
    app,
    repository,
    useCases,
    subscriptionRepository,
    checkoutUseCases,
    workflowRepository,
    workflowUseCases,
    knowledgeBaseRagRepositories,
    knowledgeBaseRagUseCases
  };
}

async function seedDemoAgents(repository: AgentRepository): Promise<void> {
  await repository.save(
    createAgent({
      agentId: "agent-research",
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Research Agent",
      role: "Market researcher",
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash-lite",
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
      model: "openrouter/owl-alpha",
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
