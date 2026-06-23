-- CreateTable
CREATE TABLE "users" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "memberId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "invitations" (
    "invitationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("invitationId")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("subscriptionId")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transactionId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transactionId")
);

-- CreateTable
CREATE TABLE "tools" (
    "toolId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("toolId")
);

-- CreateTable
CREATE TABLE "tool_connections" (
    "toolConnectionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "tool_connections_pkey" PRIMARY KEY ("toolConnectionId")
);

-- CreateTable
CREATE TABLE "agent_tool_assignments" (
    "assignmentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "agent_tool_assignments_pkey" PRIMARY KEY ("assignmentId")
);

-- CreateTable
CREATE TABLE "workflows" (
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("workflowId")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "workflowStepId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("workflowStepId")
);

-- CreateTable
CREATE TABLE "tasks" (
    "taskId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "routingMode" TEXT NOT NULL,
    "agentId" TEXT,
    "workflowId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("taskId")
);

-- CreateTable
CREATE TABLE "task_runs" (
    "taskRunId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" TEXT,
    "completedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "task_runs_pkey" PRIMARY KEY ("taskRunId")
);

-- CreateTable
CREATE TABLE "documents" (
    "documentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "knowledge_indexes" (
    "knowledgeIndexId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_indexes_pkey" PRIMARY KEY ("knowledgeIndexId")
);

-- CreateTable
CREATE TABLE "knowledge_access_grants" (
    "knowledgeAccessGrantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_access_grants_pkey" PRIMARY KEY ("knowledgeAccessGrantId")
);

-- CreateTable
CREATE TABLE "jobs" (
    "jobId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "workspaces_userId_idx" ON "workspaces"("userId");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_status_idx" ON "workspace_members"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "invitations_workspaceId_idx" ON "invitations"("workspaceId");

-- CreateIndex
CREATE INDEX "invitations_invitedByUserId_idx" ON "invitations"("invitedByUserId");

-- CreateIndex
CREATE INDEX "invitations_workspaceId_status_idx" ON "invitations"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_workspaceId_idx" ON "subscriptions"("workspaceId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "transactions_subscriptionId_idx" ON "transactions"("subscriptionId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "tools_workspaceId_idx" ON "tools"("workspaceId");

-- CreateIndex
CREATE INDEX "tools_workspaceId_status_idx" ON "tools"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "tool_connections_workspaceId_idx" ON "tool_connections"("workspaceId");

-- CreateIndex
CREATE INDEX "tool_connections_toolId_idx" ON "tool_connections"("toolId");

-- CreateIndex
CREATE INDEX "tool_connections_workspaceId_status_idx" ON "tool_connections"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "agent_tool_assignments_workspaceId_idx" ON "agent_tool_assignments"("workspaceId");

-- CreateIndex
CREATE INDEX "agent_tool_assignments_agentId_idx" ON "agent_tool_assignments"("agentId");

-- CreateIndex
CREATE INDEX "agent_tool_assignments_toolId_idx" ON "agent_tool_assignments"("toolId");

-- CreateIndex
CREATE INDEX "agent_tool_assignments_workspaceId_status_idx" ON "agent_tool_assignments"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "workflows_workspaceId_idx" ON "workflows"("workspaceId");

-- CreateIndex
CREATE INDEX "workflows_workspaceId_status_idx" ON "workflows"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "workflow_steps_workspaceId_idx" ON "workflow_steps"("workspaceId");

-- CreateIndex
CREATE INDEX "workflow_steps_workflowId_idx" ON "workflow_steps"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_steps_agentId_idx" ON "workflow_steps"("agentId");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_idx" ON "tasks"("workspaceId");

-- CreateIndex
CREATE INDEX "tasks_submittedByUserId_idx" ON "tasks"("submittedByUserId");

-- CreateIndex
CREATE INDEX "tasks_agentId_idx" ON "tasks"("agentId");

-- CreateIndex
CREATE INDEX "tasks_workflowId_idx" ON "tasks"("workflowId");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_status_idx" ON "tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "task_runs_workspaceId_idx" ON "task_runs"("workspaceId");

-- CreateIndex
CREATE INDEX "task_runs_taskId_idx" ON "task_runs"("taskId");

-- CreateIndex
CREATE INDEX "task_runs_jobId_idx" ON "task_runs"("jobId");

-- CreateIndex
CREATE INDEX "task_runs_workspaceId_status_idx" ON "task_runs"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "documents_workspaceId_idx" ON "documents"("workspaceId");

-- CreateIndex
CREATE INDEX "documents_uploadedByUserId_idx" ON "documents"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "documents_workspaceId_status_idx" ON "documents"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "knowledge_indexes_workspaceId_idx" ON "knowledge_indexes"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_indexes_documentId_idx" ON "knowledge_indexes"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_indexes_workspaceId_status_idx" ON "knowledge_indexes"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "knowledge_access_grants_workspaceId_idx" ON "knowledge_access_grants"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_access_grants_documentId_idx" ON "knowledge_access_grants"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_access_grants_agentId_idx" ON "knowledge_access_grants"("agentId");

-- CreateIndex
CREATE INDEX "knowledge_access_grants_workspaceId_status_idx" ON "knowledge_access_grants"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "jobs_workspaceId_idx" ON "jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "jobs_userId_idx" ON "jobs"("userId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "agents_workspaceId_status_idx" ON "agents"("workspaceId", "status");
