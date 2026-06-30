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

// Workspace Management
import { createWorkspaceManagementRouter } from "./modules/workspace-management/api/workspace-management-router.ts";
import { WorkspaceUseCases } from "./modules/workspace-management/application/workspace-use-cases.ts";
import { PrismaWorkspaceRepository } from "./modules/workspace-management/infrastructure/prisma-workspace-repository.ts";
import { InMemoryWorkspaceRepository } from "./modules/workspace-management/infrastructure/in-memory-workspace-repository.ts";
import { MockOpenClawRuntimeAdapter } from "./modules/workspace-management/infrastructure/mock-openclaw-runtime-adapter.ts";
import type { WorkspaceRepository } from "./modules/workspace-management/application/workspace-repository.ts";
import { PLAN_ENTITLEMENTS } from "@vcp/shared/contracts/plans.ts";

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
import { LocalKnowledgeFileStorage } from "./modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";
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

// New imports for Task Orchestration & OpenClaw network transport
import { createTaskOrchestrationRouter } from "./modules/task-orchestration/api/task-orchestration-router.ts";
import {
  OpenClawTaskExecutionAdapter,
  OpenClawExecutionOrchestrator,
  type ExternalAgentCatalog,
  type ExternalWorkflowCatalog,
  type ExternalAuthenticationService,
  type ExternalWorkspaceManagement
} from "./features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import { OpenClawHttpSSETransport } from "./features/task-execution/adapters/openclaw-network-transport.ts";
import { InMemoryConversationRepository } from "./modules/task-orchestration/infrastructure/in-memory-conversation-repository.ts";
import type { EntityId, WorkspaceExecutionRuntimeResolver, WorkspaceExecutionRuntime } from "@vcp/shared";

class ServerAgentCatalog implements ExternalAgentCatalog {
  async validateAndGetAgent(workspaceId: EntityId<"workspaceId">, agentId: string) {
    return {
      agentId,
      workspaceId: workspaceId as string,
      providerAgentMapping: "openclaw-agent-super-coder",
      status: "active" as const
    };
  }
}

class ServerWorkflowCatalog implements ExternalWorkflowCatalog {
  async validateAndGetWorkflow(workspaceId: EntityId<"workspaceId">, workflowId: string) {
    return {
      workflowId,
      workspaceId: workspaceId as string,
      providerWorkflowMapping: "openclaw-workflow-ci-cd",
      status: "active" as const
    };
  }
}

class ServerAuthenticationService implements ExternalAuthenticationService {
  async getAuthenticatedPrincipal(context: Record<string, unknown>) {
    return {
      principalId: "usr_task_commander_999",
      roles: ["workspace-admin"],
      permissions: ["start-task-execution", "cancel-task-execution", "view-advanced-provider-details"]
    };
  }

  async authorizeOperation(principal: any, operation: string, workspaceId: EntityId<"workspaceId">) {
    return true;
  }
}

class ServerWorkspaceManagement implements ExternalWorkspaceManagement {
  getWorkspaceExecutionRuntimeResolver(): WorkspaceExecutionRuntimeResolver {
    return {
      async resolve(workspaceId: EntityId<"workspaceId">): Promise<WorkspaceExecutionRuntime> {
        return {
          instanceId: "inst_openclaw_docker_01" as EntityId<"instanceId">,
          workspaceId,
          provider: "openclaw",
          status: "running",
          endpointReference: "http://127.0.0.1:18789",
          credentialReference: process.env.OPENCLAW_GATEWAY_TOKEN || "42c07ed4c737a6c9651450f70df15446fdd6fd8f6a04bfca831a74934f460e59",
          capabilities: ["http-sse-streaming", "local-execution"]
        };
      }
    };
  }
}

const backendUrlStr = process.env.BACKEND_URL || "http://127.0.0.1:3001";
const parsedBackendUrl = new URL(backendUrlStr);

import { createProductionLlmAgentDraftingService } from "./modules/agent-management/infrastructure/llm-provider-adapters.ts";
import { MockLlmAgentDraftProvider, LlmAgentDraftingService } from "./modules/agent-management/application/llm-agent-drafting-port.ts";

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
  openclawAdapter: OpenClawTaskExecutionAdapter;
  openclawOrchestrator: OpenClawExecutionOrchestrator;
  conversationRepository: any;
};

let cachedPrisma: any = null;
let prismaAttempted = false;

async function getPrismaClient(): Promise<any> {
  if (prismaAttempted) return cachedPrisma;
  prismaAttempted = true;

  if (process.env.DATABASE_URL) {
    try {
      const { PrismaClient, PrismaPg } = await import("@vcp/database");
      const pg = await import("pg");
      const Pool = pg.default ? pg.default.Pool : pg.Pool;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
      const prisma = new PrismaClient({ adapter });
      
      // Thử kết nối vật lý với DB bằng truy vấn SQL thô
      await prisma.$executeRawUnsafe("SELECT 1;");
      console.log("Database connection established successfully via Prisma.");
      cachedPrisma = prisma;
      return cachedPrisma;
    } catch (err) {
      console.warn("Could not connect to database via Prisma, fallback to InMemory repositories.");
      cachedPrisma = null;
      return null;
    }
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

async function createWorkspaceRepository(): Promise<WorkspaceRepository> {
  const prisma = await getPrismaClient();
  if (prisma) {
    return new PrismaWorkspaceRepository(prisma);
  }
  return new InMemoryWorkspaceRepository();
}

async function createConversationRepository(): Promise<any> {
  const prisma = await getPrismaClient();
  if (prisma) {
    const { PrismaConversationRepository } = await import(
      "./modules/task-orchestration/infrastructure/prisma-conversation-repository.ts"
    );
    return new PrismaConversationRepository(prisma);
  }
  return new InMemoryConversationRepository();
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

  const draftingPort = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY 
    ? createProductionLlmAgentDraftingService({
        geminiApiKey: process.env.GEMINI_API_KEY,
        geminiModelId: process.env.GEMINI_MODEL_ID,
        openrouterApiKey: process.env.OPENROUTER_API_KEY,
        openrouterModelId: process.env.OPENROUTER_MODEL_ID
      })
    : new LlmAgentDraftingService([new MockLlmAgentDraftProvider()]);

  const useCases = new AgentLifecycleUseCases({
    repository,
    skillWriter,
    draftingPort,
    now: () => new Date().toISOString(),
    generateAgentId: () => randomUUID()
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";

  const prisma = await getPrismaClient();
  const workflowRepository = prisma ? new PrismaWorkflowRepository(prisma) : new InMemoryWorkflowRepository();
  const knowledgeDocumentRepository = prisma
    ? new PrismaKnowledgeDocumentRepository(prisma)
    : new InMemoryKnowledgeDocumentRepository();

  const checkoutUseCases = new CheckoutUseCases({
    repository: subscriptionRepository,
    paymentAdapter: new MockPaymentAdapter(frontendUrl),
    eventBus,
    agentRepository: repository,
    documentRepository: knowledgeDocumentRepository,
    now: () => new Date().toISOString(),
    generateSubscriptionId: () => randomUUID() as any,
    generateTransactionId: () => randomUUID() as any,
    generateEventId: () => randomUUID() as any
  });
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
      fileStorage: new LocalKnowledgeFileStorage(),
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
  
  const agentProvider = async (workspaceId: any, agentIds: any[]) => {
    const all = await repository.listByWorkspace(workspaceId, { limit: 100, offset: 0 } as any);
    return all.agents.filter((a: any) => agentIds.includes(a.agentId));
  };

  if (repository instanceof InMemoryAgentRepository) {
    await seedDemoAgents(repository);
    await subscriptionRepository.saveSubscription({
      subscriptionId: "demo-subscription-id" as any,
      userId: "local-dev-user" as any,
      workspaceId: DEMO_WORKSPACE_ID,
      plan: "premium",
      status: "active",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoRenew: true,
      cardNumber: null,
      cardHolder: null,
      cardExpiry: null
    });
  }

  const app = express();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-mock-role, x-mock-user, x-request-id");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
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

  // ── Workspace Management ───────────────────────────────────────────────────
  // Null-safe Prisma stub: used when DB is unavailable; count queries return 0
  const nullSafePrisma = prisma ?? {
    agent:           { count: async () => 0 },
    workflow:        { count: async () => 0 },
    toolConnection:  { count: async () => 0 },
    workspaceMember: { findFirst: async () => null }
  };

  const workspaceRepository = await createWorkspaceRepository();
  const workspaceUseCases = new WorkspaceUseCases({
    repository: workspaceRepository,
    prisma: nullSafePrisma as any,
    eventBus,
    now: () => new Date().toISOString(),
    generateWorkspaceId: () => randomUUID() as any,
    generateEventId: () => randomUUID() as any
  });

  // Bridge: EventBus → in-process provisioning (local dev; prod uses @vcp/workers)
  const runtimeAdapter = new MockOpenClawRuntimeAdapter();
  eventBus.subscribe("workspace.provisioning_requested", async (event) => {
    const { workspaceId, plan } = event.payload;
    const now = new Date().toISOString();
    try {
      const ws = await workspaceRepository.findById(workspaceId);
      const result = await runtimeAdapter.provision({
        workspaceId,
        displayName: ws?.name ?? workspaceId,
        entitlement: PLAN_ENTITLEMENTS[plan]
      });
      await workspaceRepository.updateStatus(workspaceId, {
        status: "running",
        runtimeUrl: result.runtimeUrl,
        containerId: result.containerId
      }, now);
    } catch (err) {
      await workspaceRepository.updateStatus(workspaceId, {
        status: "failed",
        failureReason: err instanceof Error ? err.message : "Provisioning failed"
      }, now);
    }
  });

  eventBus.subscribe("workspace.deleted", async (event) => {
    const { workspaceId } = event.payload;
    try {
      await runtimeAdapter.stop(workspaceId);
      await runtimeAdapter.delete(workspaceId);
    } catch (_err) {
      // best-effort cleanup
    }
    await workspaceRepository.updateStatus(
      workspaceId,
      { status: "deleted" },
      new Date().toISOString()
    );
  });

  // Must be mounted BEFORE /:workspaceId/agents and /:workspaceId routes
  app.use("/api/workspaces", createWorkspaceManagementRouter(workspaceUseCases));

  app.use(
    "/api/workspaces/:workspaceId/agents",
    createAgentManagementRouter({ useCases, checkoutUseCases })
  );

  app.use(
    "/api/subscriptions",
    createSubscriptionRouter({ useCases: checkoutUseCases })
  );

  const serverWorkspaceMgmt = new ServerWorkspaceManagement();
  const serverAgentCatalog = new ServerAgentCatalog();
  const serverWorkflowCatalog = new ServerWorkflowCatalog();
  const serverAuthService = new ServerAuthenticationService();

  const conversationRepository = await createConversationRepository();
  const openclawTransport = new OpenClawHttpSSETransport();
  const openclawAdapter = new OpenClawTaskExecutionAdapter(
    serverWorkspaceMgmt.getWorkspaceExecutionRuntimeResolver(),
    serverAgentCatalog,
    serverWorkflowCatalog,
    openclawTransport
  );
  const openclawOrchestrator = new OpenClawExecutionOrchestrator(
    serverAuthService,
    serverWorkspaceMgmt,
    serverAgentCatalog,
    serverWorkflowCatalog,
    openclawAdapter,
    undefined,
    conversationRepository
  );

  app.use(
    "/api/workspaces/:workspaceId",
    createTaskOrchestrationRouter({ orchestrator: openclawOrchestrator, adapter: openclawAdapter, conversationRepository })
  );

  const executionService = new WorkflowExecutionService(
    workflowRepository,
    openclawOrchestrator,
    eventBus
  );

  const workflowUseCases = new WorkflowUseCases(
    workflowRepository,
    agentProvider,
    executionService
  );

  app.use(
    "/api/workspaces/:workspaceId/workflows",
    createWorkflowManagementRouter({ useCases: workflowUseCases, eventBus })
  );

  app.use(createKnowledgeBaseRagRouter({
    ...knowledgeBaseRagUseCases,
    checkoutUseCases
  }));

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
    knowledgeBaseRagUseCases,
    openclawAdapter,
    openclawOrchestrator,
    conversationRepository
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
  setInterval(() => {}, 100000);
}
