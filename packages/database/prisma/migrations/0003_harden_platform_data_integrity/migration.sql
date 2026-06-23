-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_workspaceId_email_status_key" ON "invitations"("workspaceId", "email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agents_workspaceId_name_key" ON "agents"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tool_connections_workspaceId_toolId_key" ON "tool_connections"("workspaceId", "toolId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tool_assignments_workspaceId_agentId_toolId_key" ON "agent_tool_assignments"("workspaceId", "agentId", "toolId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_workflowId_stepOrder_key" ON "workflow_steps"("workflowId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "task_runs_jobId_key" ON "task_runs"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_access_grants_workspaceId_documentId_agentId_key" ON "knowledge_access_grants"("workspaceId", "documentId", "agentId");
