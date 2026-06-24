/*
  Warnings:

  - Added the required column `passwordHash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "sessions" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "revokedAt" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "executionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "triggeredBy" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "completedAt" TEXT,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "workflow_step_logs" (
    "logId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "workflowStepId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputData" JSONB,
    "outputData" JSONB,
    "errorMsg" TEXT,
    "startedAt" TEXT NOT NULL,
    "completedAt" TEXT,

    CONSTRAINT "workflow_step_logs_pkey" PRIMARY KEY ("logId")
);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "workflow_executions_workspaceId_idx" ON "workflow_executions"("workspaceId");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_idx" ON "workflow_executions"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_step_logs_workspaceId_idx" ON "workflow_step_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "workflow_step_logs_executionId_idx" ON "workflow_step_logs"("executionId");

-- CreateIndex
CREATE INDEX "workflow_step_logs_workflowStepId_idx" ON "workflow_step_logs"("workflowStepId");

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("workflowId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("workflowId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_logs" ADD CONSTRAINT "workflow_step_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions"("executionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_logs" ADD CONSTRAINT "workflow_step_logs_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "workflow_steps"("workflowStepId") ON DELETE RESTRICT ON UPDATE CASCADE;
