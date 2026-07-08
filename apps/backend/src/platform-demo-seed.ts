import type { PrismaClient } from "@vcp/database";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";

import { BcryptPasswordHasher } from "./modules/authentication/infrastructure/bcrypt-password-hasher.ts";

export const PLATFORM_DEMO_PASSWORD = "Password123!";

export const PLATFORM_DEMO_USERS = [
  {
    userId: "local-dev-user",
    email: "dev@local.test",
    role: "host",
    displayName: "Local Demo Manager"
  },
  {
    userId: "local-editor-user",
    email: "editor@local.test",
    role: "editor",
    displayName: "Local Demo Editor"
  },
  {
    userId: "local-viewer-user",
    email: "viewer@local.test",
    role: "viewer",
    displayName: "Local Demo Viewer"
  },
  {
    userId: "local-nonmember-user",
    email: "nonmember@local.test",
    role: null,
    displayName: "Local Demo Non-member"
  }
] as const;

export const PLATFORM_DEMO_WORKSPACES = [
  {
    workspaceId: DEMO_WORKSPACE_ID as string,
    userId: "local-dev-user",
    name: "Product Demo",
    status: "running",
    plan: "premium"
  },
  {
    workspaceId: "workspace-marketing-dept",
    userId: "local-dev-user",
    name: "Marketing Dept.",
    status: "running",
    plan: "standard"
  },
  {
    workspaceId: "workspace-engineering-team",
    userId: "local-dev-user",
    name: "Engineering Team",
    status: "running",
    plan: "premium"
  },
  {
    workspaceId: "workspace-sales-operations",
    userId: "local-dev-user",
    name: "Sales & Ops",
    status: "running",
    plan: "standard"
  }
] as const;

export type PlatformDemoSeedSummary = {
  users: number;
  workspaces: number;
  memberships: number;
  agents: number;
  workflows: number;
  tasks: number;
  documents: number;
};

export async function seedPlatformDemoData(
  prisma: PrismaClient,
  input: { now?: string } = {}
): Promise<PlatformDemoSeedSummary> {
  const now = input.now ?? new Date().toISOString();
  const expiresAt = "2027-12-31T23:59:59.000Z";
  const hasher = new BcryptPasswordHasher();
  const passwordHash = await hasher.hash(PLATFORM_DEMO_PASSWORD);

  for (const user of PLATFORM_DEMO_USERS) {
    await prisma.user.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        email: user.email,
        passwordHash,
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      update: {
        email: user.email,
        passwordHash,
        status: "active",
        updatedAt: now
      }
    });
  }

  for (const workspace of PLATFORM_DEMO_WORKSPACES) {
    await prisma.workspace.upsert({
      where: { workspaceId: workspace.workspaceId },
      create: {
        workspaceId: workspace.workspaceId,
        userId: workspace.userId,
        name: workspace.name,
        status: workspace.status,
        plan: workspace.plan,
        runtimeUrl: `http://localhost/openclaw/${workspace.workspaceId}`,
        containerId: `demo-${workspace.workspaceId}`,
        subscriptionId: `subscription-${workspace.workspaceId}`,
        createdAt: now,
        updatedAt: now
      },
      update: {
        userId: workspace.userId,
        name: workspace.name,
        status: workspace.status,
        plan: workspace.plan,
        runtimeUrl: `http://localhost/openclaw/${workspace.workspaceId}`,
        containerId: `demo-${workspace.workspaceId}`,
        subscriptionId: `subscription-${workspace.workspaceId}`,
        updatedAt: now
      }
    });
  }

  for (const workspace of PLATFORM_DEMO_WORKSPACES) {
    for (const user of PLATFORM_DEMO_USERS.filter((candidate) => candidate.role)) {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.workspaceId,
            userId: user.userId
          }
        },
        create: {
          memberId: `member-${workspace.workspaceId}-${user.userId}`,
          workspaceId: workspace.workspaceId,
          userId: user.userId,
          role: user.role!,
          status: "active",
          createdAt: now,
          updatedAt: now
        },
        update: {
          role: user.role!,
          status: "active",
          updatedAt: now
        }
      });
    }
  }

  await prisma.invitation.upsert({
    where: {
      workspaceId_email_status: {
        workspaceId: DEMO_WORKSPACE_ID as string,
        email: "candidate@local.test",
        status: "pending"
      }
    },
    create: {
      invitationId: "invitation-platform-demo-candidate",
      workspaceId: DEMO_WORKSPACE_ID as string,
      email: "candidate@local.test",
      role: "viewer",
      status: "pending",
      invitedByUserId: "local-dev-user",
      createdAt: now,
      updatedAt: now
    },
    update: {
      role: "viewer",
      invitedByUserId: "local-dev-user",
      updatedAt: now
    }
  });

  const agents = [
    {
      agentId: "agent-support",
      name: "Support Agent",
      role: "Customer Support",
      model: "gemini-2.5-flash",
      instructions: "Triage customer issues and draft concise answers.",
      status: "enabled"
    },
    {
      agentId: "agent-research",
      name: "Research Agent",
      role: "Market Researcher",
      model: "gemini-2.5-flash",
      instructions: "Summarize product, customer, and market documents with citations.",
      status: "enabled"
    },
    {
      agentId: "agent-writer",
      name: "Writer Agent",
      role: "Content Writer",
      model: "gemini-2.5-flash-lite",
      instructions: "Create polished product and internal communication drafts.",
      status: "disabled"
    }
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { agentId: agent.agentId },
      create: {
        ...agent,
        workspaceId: DEMO_WORKSPACE_ID as string,
        runtimeConfig: {
          responsibilities: ["Prepare demo-ready output", "Use assigned tools and knowledge safely"],
          constraints: ["Do not expose secrets", "Ask for clarification when workspace context is missing"]
        },
        createdAt: now,
        updatedAt: now
      },
      update: {
        name: agent.name,
        role: agent.role,
        model: agent.model,
        instructions: agent.instructions,
        status: agent.status,
        runtimeConfig: {
          responsibilities: ["Prepare demo-ready output", "Use assigned tools and knowledge safely"],
          constraints: ["Do not expose secrets", "Ask for clarification when workspace context is missing"]
        },
        updatedAt: now
      }
    });
  }

  await seedBilling(prisma, now, expiresAt);
  await seedTools(prisma, now);
  await seedKnowledge(prisma, now);
  await seedWorkflowAndTasks(prisma, now);

  return {
    users: PLATFORM_DEMO_USERS.length,
    workspaces: PLATFORM_DEMO_WORKSPACES.length,
    memberships: PLATFORM_DEMO_WORKSPACES.length * 3,
    agents: agents.length,
    workflows: 1,
    tasks: 2,
    documents: 2
  };
}

async function seedBilling(prisma: PrismaClient, now: string, expiresAt: string): Promise<void> {
  for (const workspace of PLATFORM_DEMO_WORKSPACES) {
    await prisma.subscription.upsert({
      where: { subscriptionId: `subscription-${workspace.workspaceId}` },
      create: {
        subscriptionId: `subscription-${workspace.workspaceId}`,
        userId: "local-dev-user",
        workspaceId: workspace.workspaceId,
        plan: workspace.plan === "premium" ? "premium" : "standard",
        status: "active",
        expiresAt,
        autoRenew: true,
        createdAt: now,
        updatedAt: now
      },
      update: {
        userId: "local-dev-user",
        workspaceId: workspace.workspaceId,
        plan: workspace.plan === "premium" ? "premium" : "standard",
        status: "active",
        expiresAt,
        autoRenew: true,
        updatedAt: now
      }
    });

    await prisma.transaction.upsert({
      where: { transactionId: `transaction-${workspace.workspaceId}-paid` },
      create: {
        transactionId: `transaction-${workspace.workspaceId}-paid`,
        subscriptionId: `subscription-${workspace.workspaceId}`,
        amount: workspace.plan === "premium" ? 49 : 19,
        currency: "USD",
        status: "success",
        createdAt: now,
        updatedAt: now
      },
      update: {
        amount: workspace.plan === "premium" ? 49 : 19,
        currency: "USD",
        status: "success",
        updatedAt: now
      }
    });

    await prisma.paymentMethod.upsert({
      where: { id: `payment-method-${workspace.workspaceId}` },
      create: {
        id: `payment-method-${workspace.workspaceId}`,
        workspaceId: workspace.workspaceId,
        type: "card",
        brand: "visa",
        last4: workspace.plan === "premium" ? "4242" : "1881",
        holder: "Local Demo Manager",
        isDefault: true,
        gatewayToken: `demo-token-${workspace.workspaceId}`,
        createdAt: now,
        updatedAt: now
      },
      update: {
        type: "card",
        brand: "visa",
        last4: workspace.plan === "premium" ? "4242" : "1881",
        holder: "Local Demo Manager",
        isDefault: true,
        gatewayToken: `demo-token-${workspace.workspaceId}`,
        updatedAt: now
      }
    });
  }

  for (const promo of [
    { promoCodeId: "promo-vcp10", code: "VCP10", discountAmount: 10 },
    { promoCodeId: "promo-vcp20", code: "VCP20", discountAmount: 20 }
  ]) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      create: {
        ...promo,
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: expiresAt,
        maxUsages: 100,
        currentUsages: 0,
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      update: {
        discountAmount: promo.discountAmount,
        validUntil: expiresAt,
        status: "active",
        updatedAt: now
      }
    });
  }
}

async function seedTools(prisma: PrismaClient, now: string): Promise<void> {
  const tools = [
    { toolId: "tool-web-search", name: "Web Search", provider: "platform", type: "search" },
    { toolId: "tool-google-drive", name: "Google Drive", provider: "google", type: "knowledge-source" },
    { toolId: "tool-slack", name: "Slack", provider: "slack", type: "messaging" }
  ];

  for (const tool of tools) {
    await prisma.tool.upsert({
      where: { toolId: tool.toolId },
      create: {
        ...tool,
        workspaceId: DEMO_WORKSPACE_ID as string,
        status: "available",
        createdAt: now,
        updatedAt: now
      },
      update: {
        name: tool.name,
        provider: tool.provider,
        type: tool.type,
        status: "available",
        updatedAt: now
      }
    });

    await prisma.toolConnection.upsert({
      where: {
        workspaceId_toolId: {
          workspaceId: DEMO_WORKSPACE_ID as string,
          toolId: tool.toolId
        }
      },
      create: {
        toolConnectionId: `connection-${tool.toolId}`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        toolId: tool.toolId,
        status: "connected",
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: "connected",
        updatedAt: now
      }
    });
  }

  for (const assignment of [
    { assignmentId: "assignment-research-search", agentId: "agent-research", toolId: "tool-web-search" },
    { assignmentId: "assignment-research-drive", agentId: "agent-research", toolId: "tool-google-drive" },
    { assignmentId: "assignment-support-slack", agentId: "agent-support", toolId: "tool-slack" }
  ]) {
    await prisma.agentToolAssignment.upsert({
      where: {
        workspaceId_agentId_toolId: {
          workspaceId: DEMO_WORKSPACE_ID as string,
          agentId: assignment.agentId,
          toolId: assignment.toolId
        }
      },
      create: {
        ...assignment,
        workspaceId: DEMO_WORKSPACE_ID as string,
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: "active",
        updatedAt: now
      }
    });
  }
}

async function seedKnowledge(prisma: PrismaClient, now: string): Promise<void> {
  await prisma.knowledgeDataSource.upsert({
    where: { sourceId: "source-demo-drive" },
    create: {
      sourceId: "source-demo-drive",
      workspaceId: DEMO_WORKSPACE_ID as string,
      provider: "google-drive",
      displayName: "Demo Drive",
      connectionStatus: "connected",
      lastSyncAt: now,
      connectedByUserId: "local-dev-user",
      safeMetadata: { accountEmail: "drive-demo@local.test" },
      createdAt: now,
      updatedAt: now
    },
    update: {
      connectionStatus: "connected",
      lastSyncAt: now,
      connectedByUserId: "local-dev-user",
      safeMetadata: { accountEmail: "drive-demo@local.test" },
      updatedAt: now
    }
  });

  await prisma.knowledgeSyncScopeNode.upsert({
    where: {
      sourceId_externalId: {
        sourceId: "source-demo-drive",
        externalId: "drive-folder-demo"
      }
    },
    create: {
      scopeNodeId: "scope-demo-drive-folder",
      workspaceId: DEMO_WORKSPACE_ID as string,
      sourceId: "source-demo-drive",
      externalId: "drive-folder-demo",
      nodeType: "folder",
      displayName: "Product Demo Docs",
      selected: true,
      safeMetadata: { path: "/Product Demo Docs" },
      createdAt: now,
      updatedAt: now
    },
    update: {
      displayName: "Product Demo Docs",
      selected: true,
      safeMetadata: { path: "/Product Demo Docs" },
      updatedAt: now
    }
  });

  const documents = [
    {
      documentId: "document-policy",
      displayName: "Demo Support Policy",
      fileName: "support-policy.md",
      content: "Support responses must be concise, accurate, and cite internal policy when available."
    },
    {
      documentId: "document-product-brief",
      displayName: "Product Brief",
      fileName: "product-brief.md",
      content: "The virtual company platform manages agents, workflows, tasks, tools, billing, and workspace access."
    }
  ];

  for (const document of documents) {
    await prisma.document.upsert({
      where: { documentId: document.documentId },
      create: {
        documentId: document.documentId,
        workspaceId: DEMO_WORKSPACE_ID as string,
        uploadedByUserId: "local-dev-user",
        displayName: document.displayName,
        fileName: document.fileName,
        mimeType: "text/markdown",
        fileType: "md",
        sizeBytes: document.content.length,
        sourceType: "google-drive",
        sourceId: "source-demo-drive",
        storageKey: `demo/${document.fileName}`,
        contentHash: `${document.documentId}-hash`,
        externalId: `${document.documentId}-external`,
        sourceModifiedAt: now,
        lastSyncedAt: now,
        status: "ready",
        ingestionStatus: "completed",
        indexingStatus: "completed",
        chunkCount: 1,
        indexedChunkCount: 1,
        createdAt: now,
        updatedAt: now
      },
      update: {
        displayName: document.displayName,
        fileName: document.fileName,
        sizeBytes: document.content.length,
        sourceId: "source-demo-drive",
        status: "ready",
        ingestionStatus: "completed",
        indexingStatus: "completed",
        chunkCount: 1,
        indexedChunkCount: 1,
        updatedAt: now
      }
    });

    await prisma.knowledgeDocumentChunk.upsert({
      where: { chunkId: `chunk-${document.documentId}-1` },
      create: {
        chunkId: `chunk-${document.documentId}-1`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        documentId: document.documentId,
        chunkIndex: 0,
        contentText: document.content,
        contentHash: `${document.documentId}-chunk-hash`,
        tokenCount: document.content.split(/\s+/).length,
        embeddingStatus: "completed",
        vectorRef: `vector-${document.documentId}-1`,
        sourceLocator: `${document.fileName}#1`,
        createdAt: now,
        updatedAt: now
      },
      update: {
        contentText: document.content,
        tokenCount: document.content.split(/\s+/).length,
        embeddingStatus: "completed",
        vectorRef: `vector-${document.documentId}-1`,
        updatedAt: now
      }
    });

    await prisma.knowledgeIndex.upsert({
      where: { knowledgeIndexId: `index-${document.documentId}` },
      create: {
        knowledgeIndexId: `index-${document.documentId}`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        documentId: document.documentId,
        status: "ready",
        chunkCount: 1,
        indexedChunkCount: 1,
        lastIndexedAt: now,
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: "ready",
        chunkCount: 1,
        indexedChunkCount: 1,
        lastIndexedAt: now,
        updatedAt: now
      }
    });

    await prisma.knowledgeIngestionJob.upsert({
      where: { jobId: `ingestion-${document.documentId}` },
      create: {
        jobId: `ingestion-${document.documentId}`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        documentId: document.documentId,
        status: "completed",
        progress: 100,
        queuedAt: now,
        startedAt: now,
        completedAt: now,
        requestedByUserId: "local-dev-user",
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: "completed",
        progress: 100,
        completedAt: now,
        updatedAt: now
      }
    });

    await prisma.knowledgeAccessGrant.upsert({
      where: {
        workspaceId_documentId_agentId: {
          workspaceId: DEMO_WORKSPACE_ID as string,
          documentId: document.documentId,
          agentId: "agent-research"
        }
      },
      create: {
        knowledgeAccessGrantId: `grant-agent-research-${document.documentId}`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        documentId: document.documentId,
        agentId: "agent-research",
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: "active",
        updatedAt: now
      }
    });
  }

  await prisma.knowledgeSyncJob.upsert({
    where: { jobId: "sync-job-demo-drive" },
    create: {
      jobId: "sync-job-demo-drive",
      workspaceId: DEMO_WORKSPACE_ID as string,
      sourceId: "source-demo-drive",
      status: "completed",
      requestedByUserId: "local-dev-user",
      queuedAt: now,
      startedAt: now,
      completedAt: now,
      totalItems: 2,
      syncedItems: 2,
      failedItems: 0,
      safeSummary: { documents: ["document-policy", "document-product-brief"] },
      createdAt: now,
      updatedAt: now
    },
    update: {
      status: "completed",
      completedAt: now,
      totalItems: 2,
      syncedItems: 2,
      failedItems: 0,
      safeSummary: { documents: ["document-policy", "document-product-brief"] },
      updatedAt: now
    }
  });

  await prisma.knowledgeSyncJobEvent.upsert({
    where: { syncJobEventId: "sync-event-demo-drive-completed" },
    create: {
      syncJobEventId: "sync-event-demo-drive-completed",
      workspaceId: DEMO_WORKSPACE_ID as string,
      jobId: "sync-job-demo-drive",
      eventType: "sync.completed",
      status: "completed",
      message: "Demo Drive sync completed.",
      occurredAt: now,
      createdAt: now
    },
    update: {
      status: "completed",
      message: "Demo Drive sync completed."
    }
  });

  await prisma.knowledgeRuntimeJob.upsert({
    where: { runtimeJobId: "runtime-job-demo-ingestion" },
    create: {
      runtimeJobId: "runtime-job-demo-ingestion",
      workspaceId: DEMO_WORKSPACE_ID as string,
      targetJobId: "ingestion-document-policy",
      kind: "knowledge.ingestion",
      status: "completed",
      attemptCount: 1,
      nextAttemptAt: now,
      queuedAt: now,
      startedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now
    },
    update: {
      status: "completed",
      attemptCount: 1,
      completedAt: now,
      updatedAt: now
    }
  });
}

async function seedWorkflowAndTasks(prisma: PrismaClient, now: string): Promise<void> {
  await prisma.workflow.upsert({
    where: { workflowId: "workflow-demo-customer-support" },
    create: {
      workflowId: "workflow-demo-customer-support",
      workspaceId: DEMO_WORKSPACE_ID as string,
      name: "Customer Support Triage",
      description: "Route a support issue through research and response drafting.",
      status: "published",
      triggerType: "manual",
      triggerConfig: { source: "demo" },
      version: 1,
      createdAt: now,
      updatedAt: now
    },
    update: {
      name: "Customer Support Triage",
      description: "Route a support issue through research and response drafting.",
      status: "published",
      triggerType: "manual",
      triggerConfig: { source: "demo" },
      version: 1,
      updatedAt: now
    }
  });

  for (const step of [
    { workflowStepId: "workflow-step-demo-research", agentId: "agent-research", stepOrder: 1 },
    { workflowStepId: "workflow-step-demo-support", agentId: "agent-support", stepOrder: 2 }
  ]) {
    await prisma.workflowStep.upsert({
      where: { workflowStepId: step.workflowStepId },
      create: {
        ...step,
        workspaceId: DEMO_WORKSPACE_ID as string,
        workflowId: "workflow-demo-customer-support",
        stepType: "agent",
        nextSteps: step.stepOrder === 1 ? ["workflow-step-demo-support"] : [],
        inputMapping: { from: step.stepOrder === 1 ? "task.prompt" : "previous.output" },
        createdAt: now,
        updatedAt: now
      },
      update: {
        agentId: step.agentId,
        stepOrder: step.stepOrder,
        nextSteps: step.stepOrder === 1 ? ["workflow-step-demo-support"] : [],
        inputMapping: { from: step.stepOrder === 1 ? "task.prompt" : "previous.output" },
        updatedAt: now
      }
    });
  }

  await prisma.workflowExecution.upsert({
    where: { executionId: "workflow-execution-demo-1" },
    create: {
      executionId: "workflow-execution-demo-1",
      workspaceId: DEMO_WORKSPACE_ID as string,
      workflowId: "workflow-demo-customer-support",
      status: "Succeeded",
      triggeredBy: "local-dev-user",
      startedAt: now,
      completedAt: now
    },
    update: {
      status: "Succeeded",
      triggeredBy: "local-dev-user",
      completedAt: now
    }
  });

  for (const log of [
    { logId: "workflow-log-demo-research", workflowStepId: "workflow-step-demo-research", outputData: { summary: "Found policy evidence." } },
    { logId: "workflow-log-demo-support", workflowStepId: "workflow-step-demo-support", outputData: { reply: "Drafted customer response." } }
  ]) {
    await prisma.workflowStepLog.upsert({
      where: { logId: log.logId },
      create: {
        logId: log.logId,
        workspaceId: DEMO_WORKSPACE_ID as string,
        executionId: "workflow-execution-demo-1",
        workflowStepId: log.workflowStepId,
        status: "completed",
        inputData: { prompt: "Customer asks about response time." },
        outputData: log.outputData,
        startedAt: now,
        completedAt: now
      },
      update: {
        status: "completed",
        outputData: log.outputData,
        completedAt: now
      }
    });
  }

  for (const task of [
    {
      taskId: "task-demo-agent-research",
      prompt: "Summarize the current support policy.",
      routingMode: "specific-agent",
      agentId: "agent-research",
      workflowId: null,
      status: "succeeded"
    },
    {
      taskId: "task-demo-workflow-support",
      prompt: "Prepare a support response for a delayed order.",
      routingMode: "predefined-workflow",
      agentId: null,
      workflowId: "workflow-demo-customer-support",
      status: "succeeded"
    }
  ]) {
    await prisma.task.upsert({
      where: { taskId: task.taskId },
      create: {
        ...task,
        workspaceId: DEMO_WORKSPACE_ID as string,
        submittedByUserId: "local-dev-user",
        createdAt: now,
        updatedAt: now
      },
      update: {
        prompt: task.prompt,
        routingMode: task.routingMode,
        agentId: task.agentId,
        workflowId: task.workflowId,
        status: task.status,
        updatedAt: now
      }
    });

    await prisma.taskRun.upsert({
      where: { taskRunId: `run-${task.taskId}` },
      create: {
        taskRunId: `run-${task.taskId}`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        taskId: task.taskId,
        jobId: `job-${task.taskId}`,
        status: task.status,
        attemptNumber: 1,
        resolvedAgentId: task.agentId,
        resolvedWorkflowId: task.workflowId,
        result: { text: `Demo result for ${task.taskId}` },
        queuedAt: now,
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: task.status,
        resolvedAgentId: task.agentId,
        resolvedWorkflowId: task.workflowId,
        result: { text: `Demo result for ${task.taskId}` },
        completedAt: now,
        updatedAt: now
      }
    });

    await prisma.job.upsert({
      where: { jobId: `job-${task.taskId}` },
      create: {
        jobId: `job-${task.taskId}`,
        workspaceId: DEMO_WORKSPACE_ID as string,
        userId: "local-dev-user",
        type: "task.execution",
        status: "completed",
        createdAt: now,
        updatedAt: now
      },
      update: {
        status: "completed",
        updatedAt: now
      }
    });
  }

  await prisma.conversation.upsert({
    where: { conversationId: "conversation-demo-support" },
    create: {
      conversationId: "conversation-demo-support",
      workspaceId: DEMO_WORKSPACE_ID as string,
      title: "Support demo conversation",
      associatedTarget: { type: "agent", agentId: "agent-support" },
      createdAt: now,
      updatedAt: now
    },
    update: {
      title: "Support demo conversation",
      associatedTarget: { type: "agent", agentId: "agent-support" },
      updatedAt: now
    }
  });

  for (const message of [
    { messageId: "message-demo-support-user", role: "user", content: "How quickly should we respond?" },
    { messageId: "message-demo-support-assistant", role: "assistant", content: "Use the support policy and answer within one business day." }
  ]) {
    await prisma.chatMessage.upsert({
      where: { messageId: message.messageId },
      create: {
        ...message,
        conversationId: "conversation-demo-support",
        timestamp: now
      },
      update: {
        role: message.role,
        content: message.content,
        timestamp: now
      }
    });
  }
}
