/*
  Warnings:

  - You are about to drop the column `container_id` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the column `failure_reason` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the column `runtime_url` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_id` on the `workspaces` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "workflow_executions" DROP CONSTRAINT "workflow_executions_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_step_logs" DROP CONSTRAINT "workflow_step_logs_executionId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_step_logs" DROP CONSTRAINT "workflow_step_logs_workflowStepId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_workflowId_fkey";

-- DropIndex
DROP INDEX "workflow_steps_workflowId_stepOrder_key";

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "autoRenew" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "workflow_steps" ADD COLUMN     "inputMapping" JSONB,
ADD COLUMN     "nextSteps" JSONB,
ADD COLUMN     "stepType" TEXT NOT NULL DEFAULT 'agent',
ALTER COLUMN "agentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "description" TEXT,
ADD COLUMN     "parentWorkflowId" TEXT,
ADD COLUMN     "triggerConfig" JSONB,
ADD COLUMN     "triggerType" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'published';

-- AlterTable
ALTER TABLE "workspaces" DROP COLUMN "container_id",
DROP COLUMN "failure_reason",
DROP COLUMN "runtime_url",
DROP COLUMN "subscription_id",
ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "runtimeUrl" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "gatewayToken" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "conversationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "associatedTarget" JSONB,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("conversationId")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE INDEX "payment_methods_workspaceId_idx" ON "payment_methods"("workspaceId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_idx" ON "conversations"("workspaceId");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- CreateIndex
CREATE INDEX "workflows_parentWorkflowId_idx" ON "workflows"("parentWorkflowId");

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("workflowId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("workflowId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_logs" ADD CONSTRAINT "workflow_step_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_logs" ADD CONSTRAINT "workflow_step_logs_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "workflow_steps"("workflowStepId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("conversationId") ON DELETE CASCADE ON UPDATE CASCADE;
