-- Migration: 0005_extend_workspace_with_runtime_fields
-- Owner: workspace-management module (Member 3)
-- Adds runtime tracking and plan fields to the workspaces table.
-- All new columns are optional or have safe defaults so existing rows are unaffected.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS runtime_url TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS container_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS subscription_id TEXT;

-- Composite index for user + status queries used by listAccessibleByUser
CREATE INDEX IF NOT EXISTS "workspaces_userId_status_idx" ON "workspaces" ("userId", "status");
