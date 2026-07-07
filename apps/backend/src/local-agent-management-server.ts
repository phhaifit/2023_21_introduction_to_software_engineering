import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import express, { type Express } from "express";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { AgentRepository } from "./modules/agent-management/application/agent-repository.ts";
import type { AgentSkillWriter } from "./modules/agent-management/application/agent-skill-writer.ts";
import { AgentLifecycleUseCases, type AgentRuntimeProfileReader } from "./modules/agent-management/application/agent-lifecycle-use-cases.ts";
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
import { createAuthUserContextMiddleware } from "./modules/authentication/api/authentication-user-context-middleware.ts";
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
import { createUser } from "./modules/authentication/domain/user.ts";
import { createKnowledgeBaseRagRouter } from "./modules/knowledge-base-rag/api/knowledge-base-rag-router.ts";
import { KnowledgeDataSourceUseCases } from "./modules/knowledge-base-rag/application/knowledge-data-source-use-cases.ts";
import { KnowledgeDocumentUseCases } from "./modules/knowledge-base-rag/application/knowledge-document-use-cases.ts";
import { KnowledgeIngestionUseCases } from "./modules/knowledge-base-rag/application/knowledge-ingestion-use-cases.ts";
import { KnowledgeRetrievalSearchUseCase } from "./modules/knowledge-base-rag/application/knowledge-retrieval-search-use-case.ts";
import { KnowledgeRagAnswerUseCase } from "./modules/knowledge-base-rag/application/knowledge-rag-answer-use-case.ts";
import { AgentKnowledgeAssignmentUseCase } from "./modules/knowledge-base-rag/application/agent-knowledge-assignment-use-case.ts";
import { AgentKnowledgeRetrievalTool } from "./modules/knowledge-base-rag/application/agent-knowledge-retrieval-tool.ts";
import { AgentKnowledgeOrchestrationUseCase } from "./modules/knowledge-base-rag/application/agent-knowledge-orchestration-use-case.ts";
import { KnowledgeBaseRagAccessPolicy } from "./modules/knowledge-base-rag/application/knowledge-base-rag-access-policy.ts";
import { KnowledgeSyncUseCases } from "./modules/knowledge-base-rag/application/knowledge-sync-use-cases.ts";
import {
  KnowledgeUploadUseCases,
  type KnowledgeUploadUseCaseDependencies
} from "./modules/knowledge-base-rag/application/knowledge-upload-use-cases.ts";
import type { KnowledgeDocumentRepository } from "./modules/knowledge-base-rag/application/knowledge-document-repository.ts";
import { LocalKnowledgeFileStorage } from "./modules/knowledge-base-rag/infrastructure/local-knowledge-file-storage.ts";
import { RuntimeKnowledgeDocumentTextExtractor } from "./modules/knowledge-base-rag/infrastructure/knowledge-document-text-extractor.ts";
import { StoredKnowledgeDocumentContentReader } from "./modules/knowledge-base-rag/infrastructure/stored-knowledge-document-content-reader.ts";
import { createKnowledgeEmbeddingAdapterFromEnvironment } from "./modules/knowledge-base-rag/infrastructure/openai-compatible-knowledge-embedding-adapter.ts";
import { createKnowledgeRagAnswerProviderFromEnvironment } from "./modules/knowledge-base-rag/infrastructure/openai-compatible-knowledge-rag-answer-provider.ts";
import { createKnowledgeVectorIndexAdapterFromEnvironment } from "./modules/knowledge-base-rag/infrastructure/pgvector-knowledge-vector-index-adapter.ts";
import {
  InMemoryKnowledgeDataSourceRepository,
  InMemoryKnowledgeAccessGrantRepository,
  InMemoryKnowledgeDocumentRepository,
  InMemoryKnowledgeIngestionJobRepository,
  InMemoryKnowledgeSyncJobRepository,
  InMemoryKnowledgeSyncScopeRepository
} from "./modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";
import { PrismaKnowledgeDataSourceRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-data-source-repository.ts";
import { PrismaKnowledgeAccessGrantRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-access-grant-repository.ts";
import { PrismaKnowledgeDocumentRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-document-repository.ts";
import { PrismaKnowledgeIngestionJobRepository } from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-ingestion-job-repository.ts";
import {
  PrismaKnowledgeSyncJobRepository,
  PrismaKnowledgeSyncScopeRepository
} from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-sync-repository.ts";
import {
  createWorkspaceUserManagementRouter,
  createAcceptInvitationRouter,
  WorkspaceUserManagementService,
  InMemoryWorkspaceUserManagementRepository,
  createWorkspaceContextMiddleware
} from "./modules/workspace-user-management/index.ts";
import { NodemailerEmailService } from "./shared/email/email-service.ts";
import { loadBackendEnvironment } from "./shared/config/backend-environment.ts";
import { createKnowledgeBaseRagLocalFlowRunner } from "./modules/knowledge-base-rag/worker/knowledge-base-rag-local-flow-runner.ts";
import {
  GoogleDriveOAuthService,
  GoogleDriveOAuthStateStore
} from "./modules/knowledge-base-rag/application/google-drive-oauth-service.ts";
import { GoogleDriveSyncRuntime } from "./modules/knowledge-base-rag/application/google-drive-sync-runtime.ts";
import { GoogleDriveAutoSyncScheduler } from "./modules/knowledge-base-rag/application/google-drive-auto-sync-scheduler.ts";
import { EncryptedFileGoogleDriveCredentialStore } from "./modules/knowledge-base-rag/infrastructure/encrypted-google-drive-credential-store.ts";
import { GoogleDriveApiProvider } from "./modules/knowledge-base-rag/infrastructure/google-drive-api-provider.ts";
import { LocalKnowledgeRuntimeQueue } from "./modules/knowledge-base-rag/infrastructure/local-knowledge-runtime-queue.ts";
import {
  PermanentKnowledgeRuntimeError,
  PrismaKnowledgeRuntimeQueue
} from "./modules/knowledge-base-rag/infrastructure/prisma-knowledge-runtime-queue.ts";

// New imports for Task Orchestration & OpenClaw network transport
import { createTaskOrchestrationRouter } from "./modules/task-orchestration/api/task-orchestration-router.ts";
import { CreateTaskService } from "./modules/task-orchestration/application/create-task-service.ts";
import {
  OpenClawTaskExecutionAdapter,
  OpenClawExecutionOrchestrator,
  type ExternalAgentCatalog,
  type ExternalWorkflowCatalog,
  type ExternalAuthenticationService,
  type ExternalWorkspaceManagement
} from "./features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import {
  DockerOpenClawAgentArtifactMirror,
  FileSystemOpenClawAgentMaterializer,
  NoOpOpenClawAgentMaterializer,
  NoOpOpenClawAgentArtifactMirror,
  type OpenClawAgentArtifactMirror,
  type OpenClawAgentMaterializer,
  type OpenClawMaterializedAgent
} from "./features/task-execution/adapters/openclaw-agent-materializer.ts";
import {
  DockerOpenClawWorkflowArtifactMirror,
  FileSystemOpenClawWorkflowMaterializer,
  NoOpOpenClawWorkflowArtifactMirror,
  NoOpOpenClawWorkflowMaterializer,
  type OpenClawWorkflowArtifactMirror,
  type OpenClawWorkflowMaterializer
} from "./features/task-execution/adapters/openclaw-workflow-materializer.ts";
import { OpenClawHttpSSETransport } from "./features/task-execution/adapters/openclaw-network-transport.ts";
import { InMemoryTaskLogRepository } from "./features/task-execution/adapters/task-log-repository.ts";
import { InMemoryConversationRepository } from "./modules/task-orchestration/infrastructure/in-memory-conversation-repository.ts";
import { InMemoryTaskRepository } from "./modules/task-orchestration/infrastructure/in-memory-task-repository.ts";
import { InMemoryTaskWorkRepository } from "./modules/task-orchestration/infrastructure/in-memory-task-work-repository.ts";
import { InMemoryTaskEventPublisher } from "./modules/task-orchestration/infrastructure/in-memory-task-event-publisher.ts";
import type { EntityId, WorkspaceExecutionRuntimeResolver, WorkspaceExecutionRuntime } from "@vcp/shared";
import type { WorkflowRepository } from "./modules/workflow-management/infrastructure/workflow-repository.ts";

function createKnowledgeRetrievalSearchUseCase(
  prisma: any,
  documentRepository: KnowledgeDocumentRepository,
  accessPolicy: KnowledgeBaseRagAccessPolicy
): KnowledgeRetrievalSearchUseCase {
  const embeddingProvider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER?.trim();
  const hasEmbeddingConfig = Boolean(
    embeddingProvider === "openrouter"
      ? (process.env.OPENROUTER_API_KEY ||
          process.env.KNOWLEDGE_EMBEDDING_API_KEY) &&
          process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS
      : process.env.KNOWLEDGE_EMBEDDING_PROVIDER &&
          process.env.KNOWLEDGE_EMBEDDING_BASE_URL &&
          process.env.KNOWLEDGE_EMBEDDING_API_KEY &&
          process.env.KNOWLEDGE_EMBEDDING_MODEL &&
          process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS
  );
  const hasVectorConfig = Boolean(
    process.env.KNOWLEDGE_VECTOR_PROVIDER &&
      process.env.KNOWLEDGE_VECTOR_DIMENSIONS &&
      process.env.KNOWLEDGE_VECTOR_DISTANCE
  );

  if (prisma && hasEmbeddingConfig && hasVectorConfig) {
    const embeddingAdapter = createKnowledgeEmbeddingAdapterFromEnvironment();
    const vectorAdapter = createKnowledgeVectorIndexAdapterFromEnvironment(prisma);
    return new KnowledgeRetrievalSearchUseCase({
      documentRepository,
      queryEmbeddingAdapter: embeddingAdapter,
      vectorQueryAdapter: vectorAdapter,
      accessPolicy
    });
  }

  return new KnowledgeRetrievalSearchUseCase({
    documentRepository,
    queryEmbeddingAdapter: {
      async generateQueryEmbedding() {
        throw new Error("Knowledge retrieval embedding is not configured.");
      }
    },
    vectorQueryAdapter: {
      async query() {
        throw new Error("Knowledge retrieval vector index is not configured.");
      }
    },
    accessPolicy
  });
}

function createKnowledgeRagAnswerUseCase(
  retrievalSearchUseCase: KnowledgeRetrievalSearchUseCase
): KnowledgeRagAnswerUseCase {
  const hasRagConfig = Boolean(
    process.env.KNOWLEDGE_RAG_PROVIDER &&
      process.env.KNOWLEDGE_RAG_BASE_URL &&
      process.env.KNOWLEDGE_RAG_API_KEY &&
      process.env.KNOWLEDGE_RAG_MODEL
  );
  const answerProvider = hasRagConfig
    ? createKnowledgeRagAnswerProviderFromEnvironment()
    : {
        async generateAnswer() {
          throw new Error("Knowledge answer provider is not configured.");
        }
      };

  return new KnowledgeRagAnswerUseCase({
    retrievalSearchUseCase,
    answerProvider,
    generateAnswerId: () => randomUUID()
  });
}

class ServerAgentCatalog implements ExternalAgentCatalog {
  private readonly repository: AgentRepository;
  private readonly runtimeProfileReader?: AgentRuntimeProfileReader;
  private readonly materializer: OpenClawAgentMaterializer;

  constructor(
    repository: AgentRepository,
    runtimeProfileReader?: AgentRuntimeProfileReader,
    materializer: OpenClawAgentMaterializer = new NoOpOpenClawAgentMaterializer()
  ) {
    this.repository = repository;
    this.runtimeProfileReader = runtimeProfileReader;
    this.materializer = materializer;
  }

  async validateAndGetAgent(workspaceId: EntityId<"workspaceId">, agentId: string) {
    const agent = await this.repository.findById(workspaceId, agentId as EntityId<"agentId">);

    if (!agent || agent.status !== "enabled") {
      return {
        agentId,
        workspaceId: workspaceId as string,
        providerAgentMapping: "",
        status: "inactive" as const
      };
    }

    const materialized = await this.materializeAgent(workspaceId, agent.agentId);

    return {
      agentId,
      workspaceId: workspaceId as string,
      providerAgentMapping: materialized?.providerAgentMapping ?? "",
      status: "active" as const,
      name: agent.name,
      role: agent.role,
      model: agent.model,
      instructions: agent.instructions,
      ...(materialized?.openClawAgentId ? { openClawAgentId: materialized.openClawAgentId } : {})
    };
  }

  async listAvailableAgents(workspaceId: EntityId<"workspaceId">) {
    const result = await this.repository.listByWorkspace(workspaceId, { limit: 100, offset: 0 });

    return Promise.all(
      result.agents
        .filter((agent) => agent.status === "enabled")
        .map(async (agent) => {
          const materialized = await this.materializeAgent(workspaceId, agent.agentId);

          return {
            agentId: agent.agentId as string,
            workspaceId: workspaceId as string,
            providerAgentMapping: materialized?.providerAgentMapping ?? "",
            status: "active" as const,
            name: agent.name,
            role: agent.role,
            model: agent.model,
            instructions: agent.instructions,
            ...(materialized?.openClawAgentId ? { openClawAgentId: materialized.openClawAgentId } : {})
          };
        })
    );
  }

  private async materializeAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<OpenClawMaterializedAgent | null> {
    if (!this.runtimeProfileReader) {
      return this.materializer.getMaterializedAgent(workspaceId, agentId);
    }

    try {
      const profile = await this.runtimeProfileReader.getAgentRuntimeProfile(workspaceId, agentId);
      return await this.materializer.materializeAgent(profile);
    } catch (err) {
      console.warn(
        `[OpenClaw Agent Sync] Agent ${agentId} was not materialized; native OpenClaw header will be omitted. ${formatOpenClawAgentSyncError(err)}`
      );
      return null;
    }
  }
}

function formatOpenClawAgentSyncError(err: unknown): string {
  if (!err || typeof err !== "object") {
    return `Reason: ${String(err)}`;
  }

  const record = err as Record<string, unknown>;
  const parts = [
    err instanceof Error && err.message ? `Reason: ${compactLogValue(err.message)}` : null,
    typeof record.code === "number" || typeof record.code === "string" ? `code=${record.code}` : null,
    typeof record.signal === "string" ? `signal=${record.signal}` : null,
    typeof record.stderr === "string" && record.stderr.trim()
      ? `stderr=${compactLogValue(record.stderr)}`
      : null,
    typeof record.stdout === "string" && record.stdout.trim()
      ? `stdout=${compactLogValue(record.stdout)}`
      : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "Reason: unknown";
}

function compactLogValue(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

class ServerWorkflowCatalog implements ExternalWorkflowCatalog {
  private readonly repository: WorkflowRepository;
  private readonly materializer: OpenClawWorkflowMaterializer;

  constructor(repository: WorkflowRepository, materializer: OpenClawWorkflowMaterializer = new NoOpOpenClawWorkflowMaterializer()) {
    this.repository = repository;
    this.materializer = materializer;
  }

  async validateAndGetWorkflow(workspaceId: EntityId<"workspaceId">, workflowId: string) {
    const workflow = await this.repository.findById(workspaceId, workflowId as EntityId<"workflowId">);

    if (!workflow || workflow.status !== "published") {
      return {
        workflowId,
        workspaceId: workspaceId as string,
        providerWorkflowMapping: "",
        status: "inactive" as const
      };
    }

    const materialized = await this.materializer.getMaterializedWorkflow(workspaceId, workflowId);

    return {
      workflowId,
      workspaceId: workspaceId as string,
      providerWorkflowMapping: materialized?.providerWorkflowMapping ?? `openclaw/workflow/${workflow.workflowId}`,
      status: "active" as const,
      name: workflow.name,
      description: workflow.description
    };
  }

  async listAvailableWorkflows(workspaceId: EntityId<"workspaceId">) {
    const result = await this.repository.listByWorkspace(workspaceId, { limit: 100, offset: 0 });

    return Promise.all(
      result.items
        .filter((workflow) => workflow.status === "published")
        .map(async (workflow) => {
          const materialized = await this.materializer.getMaterializedWorkflow(
            workspaceId,
            workflow.workflowId as string
          );

          return {
            workflowId: workflow.workflowId as string,
            workspaceId: workspaceId as string,
            providerWorkflowMapping: materialized?.providerWorkflowMapping ?? `openclaw/workflow/${workflow.workflowId}`,
            status: "active" as const,
            name: workflow.name,
            description: workflow.description
          };
        })
    );
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

async function createTaskRepository(): Promise<any> {
  const prisma = await getPrismaClient();
  if (prisma) {
    const { PrismaTaskRepository } = await import(
      "./modules/task-orchestration/infrastructure/prisma-task-repository.ts"
    );
    return new PrismaTaskRepository(prisma);
  }
  return new InMemoryTaskRepository();
}

async function createTaskWorkRepository(): Promise<any> {
  const prisma = await getPrismaClient();
  if (prisma) {
    const { PrismaTaskWorkRepository } = await import(
      "./modules/task-orchestration/infrastructure/prisma-task-work-repository.ts"
    );
    return new PrismaTaskWorkRepository(prisma);
  }
  return new InMemoryTaskWorkRepository();
}

function createSkillWriter(): AgentSkillWriter {
  if (process.env.AGENT_SKILLS_DIR) {
    return new FileSystemAgentSkillWriter(process.env.AGENT_SKILLS_DIR);
  }
  return new NoOpAgentSkillWriter();
}

function createOpenClawWorkflowMaterializer(): OpenClawWorkflowMaterializer {
  const baseDir = resolveOpenClawWorkflowWorkspaceDir();
  if (baseDir) {
    return new FileSystemOpenClawWorkflowMaterializer(baseDir, undefined, createOpenClawWorkflowArtifactMirror());
  }
  return new NoOpOpenClawWorkflowMaterializer();
}

function resolveOpenClawWorkflowWorkspaceDir(): string | null {
  if (process.env.OPENCLAW_WORKFLOW_WORKSPACE_DIR) {
    return process.env.OPENCLAW_WORKFLOW_WORKSPACE_DIR;
  }

  const agentDir = process.env.OPENCLAW_AGENT_WORKSPACE_DIR || process.env.AGENT_SKILLS_DIR;
  if (!agentDir) {
    return null;
  }

  return agentDir.endsWith("openclaw-agents")
    ? agentDir.replace(/openclaw-agents$/, "openclaw-workflows")
    : `${agentDir}-workflows`;
}

function createOpenClawWorkflowArtifactMirror(): OpenClawWorkflowArtifactMirror {
  const containerName = process.env.OPENCLAW_WORKFLOW_MIRROR_CONTAINER || process.env.OPENCLAW_AGENT_MIRROR_CONTAINER;
  const destinationDir =
    process.env.OPENCLAW_WORKFLOW_MIRROR_DIR ||
    (process.env.OPENCLAW_AGENT_MIRROR_DIR
      ? process.env.OPENCLAW_AGENT_MIRROR_DIR.replace(/openclaw-agents$/, "openclaw-workflows")
      : undefined);

  if (containerName && destinationDir) {
    return new DockerOpenClawWorkflowArtifactMirror(containerName, destinationDir);
  }

  return new NoOpOpenClawWorkflowArtifactMirror();
}

function createOpenClawAgentMaterializer(): OpenClawAgentMaterializer {
  const baseDir = process.env.OPENCLAW_AGENT_WORKSPACE_DIR || process.env.AGENT_SKILLS_DIR;
  if (baseDir) {
    return new FileSystemOpenClawAgentMaterializer(baseDir, undefined, createOpenClawAgentArtifactMirror());
  }
  return new NoOpOpenClawAgentMaterializer();
}

function createOpenClawAgentArtifactMirror(): OpenClawAgentArtifactMirror {
  const containerName = process.env.OPENCLAW_AGENT_MIRROR_CONTAINER;
  const destinationDir = process.env.OPENCLAW_AGENT_MIRROR_DIR;

  if (containerName && destinationDir) {
    return new DockerOpenClawAgentArtifactMirror(containerName, destinationDir);
  }

  return new NoOpOpenClawAgentArtifactMirror();
}

export async function createLocalAgentManagementRuntime(): Promise<LocalAgentManagementRuntime> {
  loadBackendEnvironment();

  const repository = await createRepository();
  const subscriptionRepository = await createSubscriptionRepository();
  const skillWriter = createSkillWriter();
  const openclawAgentMaterializer = createOpenClawAgentMaterializer();
  const openclawWorkflowMaterializer = createOpenClawWorkflowMaterializer();
  
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

  const frontendUrl =
    process.env.APP_FRONTEND_BASE_URL ||
    process.env.FRONTEND_URL ||
    "http://127.0.0.1:5173";

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
  const knowledgeAccessGrantRepository = prisma
    ? new PrismaKnowledgeAccessGrantRepository(prisma)
    : new InMemoryKnowledgeAccessGrantRepository();
  const knowledgeAccessPolicy = new KnowledgeBaseRagAccessPolicy(
    knowledgeAccessGrantRepository
  );
  const knowledgeBaseRagRepositories = {
    documentRepository: knowledgeDocumentRepository,
    ingestionJobRepository: knowledgeIngestionJobRepository,
    dataSourceRepository: knowledgeDataSourceRepository,
    syncScopeRepository: knowledgeSyncScopeRepository,
    syncJobRepository: knowledgeSyncJobRepository,
    accessGrantRepository: knowledgeAccessGrantRepository
  };
  const retrievalSearchUseCase = createKnowledgeRetrievalSearchUseCase(
    prisma,
    knowledgeDocumentRepository,
    knowledgeAccessPolicy
  );
  const knowledgeFileStorage = new LocalKnowledgeFileStorage();
  const inlineIngestionEnabled =
    process.env.KNOWLEDGE_INGESTION_MODE?.trim().toLowerCase() === "inline";
  const googleClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const googleRedirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const googleDriveOAuthScopeMode =
    process.env.GOOGLE_DRIVE_OAUTH_SCOPE_MODE?.trim().toLowerCase() ===
    "readonly"
      ? "readonly"
      : "file";
  const credentialEncryptionKey =
    process.env.GOOGLE_DRIVE_CREDENTIAL_ENCRYPTION_KEY;
  const googleDriveConfigured = Boolean(
    googleClientId &&
      googleClientSecret &&
      googleRedirectUri &&
      credentialEncryptionKey
  );
  const knowledgeQueueMode =
    process.env.KNOWLEDGE_QUEUE_MODE?.trim().toLowerCase() === "durable"
      ? "durable"
      : "process_local";
  let postUploadProcessor: KnowledgeUploadUseCaseDependencies["postUploadProcessor"];
  let fullIngestionProcessor: KnowledgeUploadUseCaseDependencies["postUploadProcessor"];
  let enqueueIngestionJob:
    | ((input: { workspaceId: any; jobId: any }) => Promise<void>)
    | undefined;
  let googleDriveSyncHandler:
    | ((input: { workspaceId: any; jobId: any }) => Promise<void>)
    | undefined;
  let durableQueue: PrismaKnowledgeRuntimeQueue | undefined;
  if (
    inlineIngestionEnabled ||
    (prisma && googleDriveConfigured) ||
    (prisma && knowledgeQueueMode === "durable")
  ) {
    if (!prisma) {
      throw new Error(
        "KNOWLEDGE_INGESTION_MODE=inline requires DATABASE_URL and PostgreSQL."
      );
    }
    const embeddingAdapter = createKnowledgeEmbeddingAdapterFromEnvironment();
    const vectorIndexAdapter =
      createKnowledgeVectorIndexAdapterFromEnvironment(prisma);
    const inlineRunner = createKnowledgeBaseRagLocalFlowRunner({
      documentRepository: knowledgeDocumentRepository,
      ingestionJobRepository: knowledgeIngestionJobRepository,
      contentReader: new StoredKnowledgeDocumentContentReader(
        knowledgeFileStorage,
        new RuntimeKnowledgeDocumentTextExtractor()
      ),
      embeddingAdapter,
      vectorIndexAdapter,
      now: () => new Date().toISOString(),
      generateChunkId: ({ documentId, chunkIndex }) =>
        `${documentId}:chunk:${chunkIndex}`,
      generateEventId: () => randomUUID() as any
    });
    fullIngestionProcessor = {
      async process(input) {
        const result = await inlineRunner.run(input);
        return { document: result.document, job: result.job };
      }
    };
    if (inlineIngestionEnabled) postUploadProcessor = fullIngestionProcessor;
    if (knowledgeQueueMode === "durable" && prisma) {
      const leaseMs = positiveIntegerEnvironment(
        process.env.KNOWLEDGE_QUEUE_LEASE_MS,
        300_000
      );
      const maxAttempts = positiveIntegerEnvironment(
        process.env.KNOWLEDGE_QUEUE_MAX_ATTEMPTS,
        3
      );
      const pollIntervalMs = positiveIntegerEnvironment(
        process.env.KNOWLEDGE_QUEUE_POLL_INTERVAL_MS,
        5_000
      );
      durableQueue = new PrismaKnowledgeRuntimeQueue({
        prisma,
        leaseOwner: `knowledge-worker-${process.pid}-${randomUUID()}`,
        leaseMs,
        maxAttempts,
        pollIntervalMs,
        handlers: {
          googleDriveSync: async (job) => {
            if (!googleDriveSyncHandler) {
              throw new PermanentKnowledgeRuntimeError(
                "knowledge.google_drive_handler_unavailable",
                "Google Drive synchronization runtime is unavailable."
              );
            }
            await googleDriveSyncHandler(job);
          },
          documentIngestion: async (job) => {
            const result = await inlineRunner.run(job);
            if (result.phase !== "completed") {
              throw new PermanentKnowledgeRuntimeError(
                result.failure?.errorCode ?? "knowledge.ingestion_failed",
                result.failure?.errorMessage ??
                  "Knowledge document ingestion failed."
              );
            }
          }
        }
      });
      enqueueIngestionJob = (input) =>
        durableQueue!.enqueue({ kind: "document-ingestion", ...input });
      postUploadProcessor = {
        async process(input) {
          await enqueueIngestionJob!(input);
          const job =
            await knowledgeIngestionJobRepository.getIngestionJobById(
              input.workspaceId,
              input.jobId
            );
          const document = job?.documentId
            ? await knowledgeDocumentRepository.getDocumentById(
                input.workspaceId,
                job.documentId
              )
            : null;
          if (!job || !document) {
            throw new Error("Queued knowledge ingestion state is unavailable.");
          }
          return { document, job };
        }
      };
    }
  }
  const uploadUseCases = new KnowledgeUploadUseCases({
    documentRepository: knowledgeDocumentRepository,
    ingestionJobRepository: knowledgeIngestionJobRepository,
    fileStorage: knowledgeFileStorage,
    postUploadProcessor,
    now: () => new Date().toISOString(),
    generateDocumentId: () => randomUUID() as any,
    generateJobId: () => randomUUID() as any
  });
  let googleDriveOAuthService: GoogleDriveOAuthService | undefined;
  let googleDriveProvider: GoogleDriveApiProvider | undefined;
  let enqueueSyncJob:
    | ((input: { workspaceId: any; jobId: any }) => Promise<void>)
    | undefined;
  if (
    googleClientId &&
    googleClientSecret &&
    googleRedirectUri &&
    credentialEncryptionKey &&
    fullIngestionProcessor
  ) {
    const credentialStore = new EncryptedFileGoogleDriveCredentialStore({
      rootDirectory: resolve(".data/knowledge-base-rag/google-drive-credentials"),
      encryptionSecret: credentialEncryptionKey
    });
    googleDriveOAuthService = new GoogleDriveOAuthService({
      config: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        redirectUri: googleRedirectUri,
        scopeMode: googleDriveOAuthScopeMode
      },
      dataSourceRepository: knowledgeDataSourceRepository,
      credentialStore,
      stateStore: new GoogleDriveOAuthStateStore(),
      now: () => new Date().toISOString(),
      generateSourceId: () => `google-drive-${randomUUID()}`
    });
    googleDriveProvider = new GoogleDriveApiProvider();
    const syncUploadUseCases = new KnowledgeUploadUseCases({
      documentRepository: knowledgeDocumentRepository,
      ingestionJobRepository: knowledgeIngestionJobRepository,
      fileStorage: knowledgeFileStorage,
      postUploadProcessor: fullIngestionProcessor,
      now: () => new Date().toISOString(),
      generateDocumentId: () => randomUUID() as any,
      generateJobId: () => randomUUID() as any
    });
    const syncRuntime = new GoogleDriveSyncRuntime({
      dataSourceRepository: knowledgeDataSourceRepository,
      syncScopeRepository: knowledgeSyncScopeRepository,
      syncJobRepository: knowledgeSyncJobRepository,
      documentRepository: knowledgeDocumentRepository,
      uploadUseCases: syncUploadUseCases,
      oauthService: googleDriveOAuthService,
      provider: googleDriveProvider,
      now: () => new Date().toISOString(),
      generateEventId: () => randomUUID()
    });
    googleDriveSyncHandler = async (job) => {
      await syncRuntime.execute(job);
      const completed =
        await knowledgeSyncJobRepository.getSyncJobById(
          job.workspaceId,
          job.jobId
        );
      if (completed?.status === "failed") {
        const permanentCodes = [
          "credential_invalid",
          "permission_denied",
          "insufficient_scope",
          "not_found",
          "unsupported_file"
        ];
        const errorCode = completed.errorCode ?? "google_drive.sync_failed";
        if (permanentCodes.some((code) => errorCode.includes(code))) {
          throw new PermanentKnowledgeRuntimeError(
            errorCode,
            completed.errorMessage ?? "Google Drive synchronization failed."
          );
        }
        throw new Error("Transient Google Drive synchronization failure.");
      }
    };
    if (durableQueue) {
      enqueueSyncJob = (input) =>
        durableQueue!.enqueue({ kind: "google-drive-sync", ...input });
    } else {
      const queue = new LocalKnowledgeRuntimeQueue({
        googleDriveSync: (job) => syncRuntime.execute(job)
      });
      enqueueSyncJob = (input) =>
        queue.enqueue({ kind: "google-drive-sync", ...input });
    }
  }
  durableQueue?.start();
  const knowledgeSyncUseCases = new KnowledgeSyncUseCases({
    syncScopeRepository: knowledgeSyncScopeRepository,
    syncJobRepository: knowledgeSyncJobRepository,
    dataSourceRepository: knowledgeDataSourceRepository,
    googleDriveOAuthService,
    googleDriveProvider,
    now: () => new Date().toISOString(),
    generateJobId: () => randomUUID() as any,
    enqueueSyncJob
  });
  if (
    process.env.KNOWLEDGE_AUTO_SYNC_ENABLED?.trim().toLowerCase() === "true" &&
    enqueueSyncJob
  ) {
    const configuredPollInterval = Number(
      process.env.KNOWLEDGE_AUTO_SYNC_POLL_INTERVAL_MS ?? "60000"
    );
    const scheduler = new GoogleDriveAutoSyncScheduler({
      dataSourceRepository: knowledgeDataSourceRepository,
      syncUseCases: knowledgeSyncUseCases,
      now: () => new Date().toISOString(),
      pollIntervalMs:
        Number.isFinite(configuredPollInterval) && configuredPollInterval > 0
          ? configuredPollInterval
          : 60_000
    });
    scheduler.start();
  }
  const knowledgeBaseRagUseCases = {
    documentUseCases: new KnowledgeDocumentUseCases({
      documentRepository: knowledgeDocumentRepository
    }),
    uploadUseCases,
    ingestionUseCases: new KnowledgeIngestionUseCases({
      ingestionJobRepository: knowledgeIngestionJobRepository
    }),
    dataSourceUseCases: new KnowledgeDataSourceUseCases({
      dataSourceRepository: knowledgeDataSourceRepository,
      now: () => new Date().toISOString()
    }),
    syncUseCases: knowledgeSyncUseCases,
    retrievalSearchUseCase,
    ragAnswerUseCase: createKnowledgeRagAnswerUseCase(retrievalSearchUseCase),
    agentKnowledgeAssignmentUseCase: new AgentKnowledgeAssignmentUseCase({
      accessGrantRepository: knowledgeAccessGrantRepository,
      documentRepository: knowledgeDocumentRepository,
      agentLookup: {
        async existsInWorkspace(workspaceId, agentId) {
          return Boolean(await repository.findById(workspaceId, agentId));
        }
      },
      accessPolicy: knowledgeAccessPolicy,
      now: () => new Date().toISOString(),
      generateGrantId: () => randomUUID()
    }),
    agentKnowledgeOrchestrationUseCase: new AgentKnowledgeOrchestrationUseCase({
      knowledgeRetrievalTool: new AgentKnowledgeRetrievalTool({
        retrievalSearchUseCase,
        agentLookup: {
          async existsInWorkspace(workspaceId, agentId) {
            return Boolean(await repository.findById(workspaceId, agentId));
          }
        }
      })
    }),
    accessPolicy: knowledgeAccessPolicy,
    googleDriveOAuthService,
    frontendBaseUrl: frontendUrl
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

  const authUserRepository = await createAuthUserRepository();
  const authSessionRepository = await createAuthSessionRepository();

  const workspaceUserManagementRepo = new InMemoryWorkspaceUserManagementRepository();
  const emailService = new NodemailerEmailService();
  const localEmailUserEmail = process.env.GMAIL_USER?.trim().toLowerCase();
  const workspaceUserManagementService = new WorkspaceUserManagementService({
    repository: workspaceUserManagementRepo,
    emailService: emailService,
    frontendUrl: frontendUrl,
    generateId: () => randomUUID(),
    sessionRepository: authSessionRepository,
  });
  await workspaceUserManagementRepo.createWorkspace({
    workspaceId: DEMO_WORKSPACE_ID,
    name: "Demo Workspace",
    createdAt: new Date().toISOString(),
    ownerId: "local-dev-user"
  });
  await workspaceUserManagementRepo.addWorkspaceMember({
    memberId: "local-member",
    workspaceId: DEMO_WORKSPACE_ID,
    userId: "local-dev-user",
    role: "host",
    isAccepted: true,
    joinedAt: new Date().toISOString()
  });
  if (localEmailUserEmail && localEmailUserEmail !== "dev@local.test") {
    await workspaceUserManagementRepo.addWorkspaceMember({
      memberId: "local-email-member",
      workspaceId: DEMO_WORKSPACE_ID,
      userId: "local-email-user",
      role: "admin",
      isAccepted: true,
      joinedAt: new Date().toISOString()
    });
  }

  // Real Authentication Setup (Moved up to enable session token verification globally)
  const authPasswordHasher = new BcryptPasswordHasher();
  const authTokenHasher = new Sha256TokenHasher();
  if (authUserRepository instanceof InMemoryUserRepository) {
    const timestamp = new Date().toISOString();
    const existingDevUser = await authUserRepository.findByEmail("dev@local.test");
    if (!existingDevUser) {
      await authUserRepository.create(createUser({
        userId: "local-dev-user" as any,
        email: "dev@local.test",
        displayName: "Local Developer",
        passwordHash: await authPasswordHasher.hash("Password123!"),
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    }
    if (localEmailUserEmail && localEmailUserEmail !== "dev@local.test") {
      const existingEmailUser = await authUserRepository.findByEmail(localEmailUserEmail);
      if (!existingEmailUser) {
        await authUserRepository.create(createUser({
          userId: "local-email-user" as any,
          email: localEmailUserEmail,
          displayName: "Local Email User",
          passwordHash: await authPasswordHasher.hash("Password123!"),
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp
        }));
      }
    }
  }
  const authenticateSessionUseCase = new AuthenticateSessionUseCase(
    authSessionRepository,
    authUserRepository,
    authTokenHasher
  );

  const app = express();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-mock-role, x-mock-user, x-request-id");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(express.json());

  const workspaceRepository = await createWorkspaceRepository();
  if (!(await workspaceRepository.findById(DEMO_WORKSPACE_ID))) {
    const now = new Date().toISOString();
    await workspaceRepository.save({
      workspaceId: DEMO_WORKSPACE_ID,
      userId: "local-dev-user" as any,
      name: "Demo Workspace",
      status: "running",
      plan: "premium",
      createdAt: now,
      updatedAt: now
    });
  }

  // ── Workspace Management ───────────────────────────────────────────────────
  // Null-safe Prisma stub: used when DB is unavailable; count queries return 0
  const nullSafePrisma = prisma ?? {
    agent:           { count: async () => 0 },
    workflow:        { count: async () => 0 },
    toolConnection:  { count: async () => 0 },
    workspaceMember: {
      findFirst: async (query: any) => {
        const where = query?.where ?? {};
        const member = await workspaceUserManagementRepo.getWorkspaceMember(where.workspaceId, where.userId);
        if (!member || !member.isAccepted) return null;
        if (where.status && where.status !== "active") return null;
        return {
          memberId: member.memberId,
          workspaceId: member.workspaceId,
          userId: member.userId,
          role: member.role,
          status: "active"
        };
      }
    }
  };
  const workspaceUseCases = new WorkspaceUseCases({
    repository: workspaceRepository,
    prisma: nullSafePrisma as any,
    eventBus,
    now: () => new Date().toISOString(),
    generateWorkspaceId: () => randomUUID() as any,
    generateEventId: () => randomUUID() as any
  });

  // (A) Real auth: populate context.user from Bearer token (never blocks)
  app.use(createAuthUserContextMiddleware({ authenticateSessionUseCase }));

  // (B) Real workspace resolver: only runs when real user is present AND URL has no
  // workspaceId segment. When URL contains /:workspaceId, the workspace context is
  // left to fake auth (C) — setting an incomplete {workspaceId, memberId:null} shape
  // would break requireWorkspaceContext() callers, so we defer that to a later PR.
  app.use(async (req, _res, next) => {
    const ctx = (req as any).context;
    const user = ctx?.user;
    if (!user) {
      next();
      return;
    }
    const urlMatch = req.path.match(/^\/api\/workspaces\/([^\/]+)/);
    if (urlMatch) {
      // URL already has a workspaceId: leave workspace context to fake auth (C).
      next();
      return;
    }
    try {
      const membership = await workspaceUseCases.resolveActiveMembership(user.userId);
      if (membership) {
        (req as any).context = { ...ctx, workspace: membership };
      }
    } catch {
      // Resolve failed — leave workspace undefined; never block.
    }
    next();
  });

  // (C) Fake Auth Middleware for local development.
  // It only activates when tests/tools explicitly provide x-mock-user so
  // browser requests without a real session still exercise the auth flow.
  app.use((req, _res, next) => {
    const mockUser = req.headers["x-mock-user"] as string | undefined;
    const role = (req.headers["x-mock-role"] as any) || "admin";
    const match = req.path.match(/^\/api\/workspaces\/([^\/]+)/);
    const workspaceId = match ? match[1] : DEMO_WORKSPACE_ID;

    // Always ensure requestId exists
    const existing = (req as any).context ?? {};
    if (!existing.requestId) {
      (req as any).context = { ...existing, requestId: req.headers["x-request-id"] || randomUUID() };
    }

    if (mockUser === "anonymous") {
      // anonymous header: clear user + workspace (legacy behaviour)
      (req as any).context = { ...(req as any).context, user: undefined, workspace: undefined };
      next();
      return;
    }

    if (!mockUser || (req as any).context.user) {
      next();
      return;
    }

    (req as any).context = {
      ...(req as any).context,
      user: {
        userId: mockUser,
        email: mockUser === "local-email-user" ? localEmailUserEmail ?? "dev@local.test" : "dev@local.test",
        displayName: "Local Developer"
      },
      workspace: {
        workspaceId,
        memberId: "local-member",
        role
      }
    };
    next();
  });

  app.use(
    "/api/workspaces/:workspaceId",
    createWorkspaceContextMiddleware(workspaceUserManagementRepo)
  );

  // ── Workspace Management ───────────────────────────────────────────────────

  // Bridge: EventBus → in-process provisioning (local dev; prod uses @vcp/workers)
  const runtimeAdapter = new MockOpenClawRuntimeAdapter();
  eventBus.subscribe("workspace.provisioning_requested", async (event) => {
    const { workspaceId, plan } = event.payload;
    const now = new Date().toISOString();
    try {
      const ws = await workspaceRepository.findById(workspaceId);
      if (ws) {
        await workspaceUserManagementRepo.createWorkspace({
          workspaceId: ws.workspaceId,
          name: ws.name,
          createdAt: ws.createdAt,
          ownerId: ws.userId
        });
        const ownerMembership = await workspaceUserManagementRepo.getWorkspaceMember(ws.workspaceId, ws.userId);
        if (!ownerMembership) {
          await workspaceUserManagementRepo.addWorkspaceMember({
            memberId: randomUUID(),
            workspaceId: ws.workspaceId,
            userId: ws.userId,
            role: "host",
            isAccepted: true,
            joinedAt: now
          });
        }
      }
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
  const serverAgentCatalog = new ServerAgentCatalog(repository, useCases, openclawAgentMaterializer);
  const serverWorkflowCatalog = new ServerWorkflowCatalog(workflowRepository, openclawWorkflowMaterializer);
  const serverAuthService = new ServerAuthenticationService();

  const conversationRepository = await createConversationRepository();
  const taskRepository = await createTaskRepository();
  const taskWorkRepository = await createTaskWorkRepository();
  const openclawTransport = new OpenClawHttpSSETransport();
  const openclawAdapter = new OpenClawTaskExecutionAdapter(
    serverWorkspaceMgmt.getWorkspaceExecutionRuntimeResolver(),
    serverAgentCatalog,
    serverWorkflowCatalog,
    openclawTransport
  );
  const taskLogRepository = new InMemoryTaskLogRepository();
  const openclawOrchestrator = new OpenClawExecutionOrchestrator(
    serverAuthService,
    serverWorkspaceMgmt,
    serverAgentCatalog,
    serverWorkflowCatalog,
    openclawAdapter,
    undefined,
    conversationRepository,
    taskLogRepository
  );
  const createTaskUseCase = new CreateTaskService(
    {
      nextTaskId: () => `task_${randomUUID()}` as EntityId<"taskId">,
      nextWorkId: () => `work_${randomUUID()}` as EntityId<"workId">
    },
    {
      now: () => new Date().toISOString()
    },
    {
      nextEventId: () => `evt_${randomUUID()}` as EntityId<"eventId">
    },
    {
      isAgentSelectable: async (workspaceId, agentId) => {
        const agent = await serverAgentCatalog.validateAndGetAgent(workspaceId, agentId);
        return agent.status === "active";
      }
    },
    {
      isWorkflowExecutable: async (workspaceId, workflowId) => {
        const workflow = await serverWorkflowCatalog.validateAndGetWorkflow(workspaceId, workflowId);
        return workflow.status === "active";
      }
    },
    taskRepository,
    taskWorkRepository,
    new InMemoryTaskEventPublisher()
  );

  app.use(
    "/api/workspaces/:workspaceId",
    createWorkspaceUserManagementRouter({ service: workspaceUserManagementService })
  );

  app.use(
    "/api/invitations",
    createAcceptInvitationRouter({ service: workspaceUserManagementService })
  );

  app.use(
    "/api/workspaces/:workspaceId",
    createTaskOrchestrationRouter({
      orchestrator: openclawOrchestrator,
      adapter: openclawAdapter,
      conversationRepository,
      createTaskUseCase,
      agentKnowledgeAskPort: {
        ask(workspaceId, agentId, request) {
          return knowledgeBaseRagUseCases.agentKnowledgeOrchestrationUseCase.ask(
            workspaceId,
            agentId,
            request
          );
        }
      }
    })
  );

  const executionService = new WorkflowExecutionService(
    workflowRepository,
    openclawOrchestrator,
    eventBus,
    openclawWorkflowMaterializer
  );

  openclawOrchestrator.setWorkflowExecutionService(executionService);

  const workflowUseCases = new WorkflowUseCases(
    workflowRepository,
    agentProvider,
    executionService,
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
      authenticateSessionUseCase,
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

function positiveIntegerEnvironment(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
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
