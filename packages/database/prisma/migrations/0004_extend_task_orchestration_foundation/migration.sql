-- Preflight: TaskRun ownership must be valid before adding the composite FK.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "task_runs" tr
        LEFT JOIN "tasks" t ON t."taskId" = tr."taskId"
        WHERE t."taskId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot add task_runs(workspaceId, taskId) foreign key: orphan task_run rows exist.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "task_runs" tr
        JOIN "tasks" t ON t."taskId" = tr."taskId"
        WHERE tr."workspaceId" <> t."workspaceId"
    ) THEN
        RAISE EXCEPTION 'Cannot add task_runs(workspaceId, taskId) foreign key: task_run workspaceId differs from task workspaceId.';
    END IF;
END $$;

-- Preflight: Task.prompt has no approved backfill policy for legacy rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "tasks") THEN
        RAISE EXCEPTION 'Cannot add required tasks.prompt: existing task rows require an approved prompt backfill policy.';
    END IF;
END $$;

-- AlterTable: Task submitted prompt is required for new rows.
ALTER TABLE "tasks" ADD COLUMN "prompt" TEXT NOT NULL;

-- AlterTable: add TaskWork-compatible persistence fields to TaskRun.
ALTER TABLE "task_runs" ADD COLUMN "attemptNumber" INTEGER;
ALTER TABLE "task_runs" ADD COLUMN "resolvedAgentId" TEXT;
ALTER TABLE "task_runs" ADD COLUMN "resolvedWorkflowId" TEXT;
ALTER TABLE "task_runs" ADD COLUMN "result" JSONB;
ALTER TABLE "task_runs" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "task_runs" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "task_runs" ADD COLUMN "queuedAt" TEXT;

-- Backfill: deterministic attempt numbering per Task.
WITH numbered_task_runs AS (
    SELECT
        "taskRunId",
        ROW_NUMBER() OVER (
            PARTITION BY "taskId"
            ORDER BY "createdAt", "taskRunId"
        ) AS "attemptNumber"
    FROM "task_runs"
)
UPDATE "task_runs" tr
SET "attemptNumber" = numbered_task_runs."attemptNumber"
FROM numbered_task_runs
WHERE tr."taskRunId" = numbered_task_runs."taskRunId";

-- Backfill: queuedAt uses the original creation timestamp.
UPDATE "task_runs"
SET "queuedAt" = "createdAt";

-- AlterTable: required TaskRun fields after deterministic backfill.
ALTER TABLE "task_runs" ALTER COLUMN "attemptNumber" SET NOT NULL;
ALTER TABLE "task_runs" ALTER COLUMN "queuedAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_workspaceId_taskId_key" ON "tasks"("workspaceId", "taskId");

-- CreateIndex
CREATE INDEX "task_runs_workspaceId_taskId_idx" ON "task_runs"("workspaceId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_runs_taskId_attemptNumber_key" ON "task_runs"("taskId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_workspaceId_taskId_fkey" FOREIGN KEY ("workspaceId", "taskId") REFERENCES "tasks"("workspaceId", "taskId") ON DELETE RESTRICT ON UPDATE NO ACTION;
