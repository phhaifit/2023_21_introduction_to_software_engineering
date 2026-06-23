import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaPath = join(root, "packages/database/prisma/schema.prisma");
const exportsPath = join(root, "packages/database/src/index.ts");
const migrationPath = join(
  root,
  "packages/database/prisma/migrations/0002_establish_platform_data_model_boundaries/migration.sql"
);

const schema = readFileSync(schemaPath, "utf8");
const databaseExports = readFileSync(exportsPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");

function parseModels(source) {
  const models = new Map();
  const modelPattern = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;

  for (const match of source.matchAll(modelPattern)) {
    const [, modelName, body] = match;
    const fields = new Map();
    const indexes = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) {
        continue;
      }

      if (line.startsWith("@@index")) {
        const fieldMatch = line.match(/\[\s*([^\]]+)\s*\]/);
        if (fieldMatch) {
          indexes.push(
            fieldMatch[1]
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          );
        }
        continue;
      }

      if (line.startsWith("@@")) {
        continue;
      }

      const [fieldName, fieldType] = line.split(/\s+/);
      fields.set(fieldName, { type: fieldType, line });
    }

    models.set(modelName, { body, fields, indexes });
  }

  return models;
}

function requireModel(models, modelName) {
  assert.ok(models.has(modelName), `missing Prisma model: ${modelName}`);
  return models.get(modelName);
}

function requireField(modelName, model, fieldName, expectedType) {
  assert.ok(model.fields.has(fieldName), `${modelName} missing field ${fieldName}`);
  assert.equal(
    model.fields.get(fieldName).type,
    expectedType,
    `${modelName}.${fieldName} should be ${expectedType}`
  );
}

function requireIndexStartingWith(modelName, model, fieldName) {
  assert.ok(
    model.indexes.some((index) => index[0] === fieldName),
    `${modelName} missing lookup index starting with ${fieldName}`
  );
}

function requireIndexContaining(modelName, model, fieldName) {
  assert.ok(
    model.indexes.some((index) => index.includes(fieldName)),
    `${modelName} missing lookup index containing ${fieldName}`
  );
}

const expectedModels = {
  User: {
    fields: {
      userId: "String",
      email: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    statusIndexed: true,
    exported: true
  },
  Workspace: {
    fields: {
      workspaceId: "String",
      userId: "String",
      name: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["userId"],
    statusIndexed: true,
    exported: true
  },
  WorkspaceMember: {
    fields: {
      memberId: "String",
      workspaceId: "String",
      userId: "String",
      role: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["userId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Invitation: {
    fields: {
      invitationId: "String",
      workspaceId: "String",
      email: "String",
      role: "String",
      status: "String",
      invitedByUserId: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["invitedByUserId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Agent: {
    fields: {
      agentId: "String",
      workspaceId: "String",
      name: "String",
      role: "String",
      model: "String",
      instructions: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Subscription: {
    fields: {
      subscriptionId: "String",
      userId: "String",
      workspaceId: "String?",
      plan: "String",
      status: "String",
      expiresAt: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["userId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Transaction: {
    fields: {
      transactionId: "String",
      subscriptionId: "String",
      amount: "Float",
      currency: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["subscriptionId"],
    statusIndexed: true,
    exported: true
  },
  Tool: {
    fields: {
      toolId: "String",
      workspaceId: "String",
      name: "String",
      provider: "String",
      type: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  ToolConnection: {
    fields: {
      toolConnectionId: "String",
      workspaceId: "String",
      toolId: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["toolId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  AgentToolAssignment: {
    fields: {
      assignmentId: "String",
      workspaceId: "String",
      agentId: "String",
      toolId: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["agentId", "toolId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Workflow: {
    fields: {
      workflowId: "String",
      workspaceId: "String",
      name: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  WorkflowStep: {
    fields: {
      workflowStepId: "String",
      workspaceId: "String",
      workflowId: "String",
      agentId: "String",
      stepOrder: "Int",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["workflowId", "agentId"],
    workspaceScoped: true,
    exported: true
  },
  Task: {
    fields: {
      taskId: "String",
      workspaceId: "String",
      submittedByUserId: "String",
      routingMode: "String",
      agentId: "String?",
      workflowId: "String?",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["submittedByUserId"],
    parentFields: ["agentId", "workflowId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  TaskRun: {
    fields: {
      taskRunId: "String",
      workspaceId: "String",
      taskId: "String",
      jobId: "String?",
      status: "String",
      startedAt: "String?",
      completedAt: "String?",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["taskId", "jobId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Document: {
    fields: {
      documentId: "String",
      workspaceId: "String",
      uploadedByUserId: "String",
      fileName: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["uploadedByUserId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  KnowledgeIndex: {
    fields: {
      knowledgeIndexId: "String",
      workspaceId: "String",
      documentId: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["documentId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  KnowledgeAccessGrant: {
    fields: {
      knowledgeAccessGrantId: "String",
      workspaceId: "String",
      documentId: "String",
      agentId: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    parentFields: ["documentId", "agentId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  },
  Job: {
    fields: {
      jobId: "String",
      workspaceId: "String?",
      userId: "String?",
      type: "String",
      status: "String",
      createdAt: "String",
      updatedAt: "String"
    },
    userFields: ["userId"],
    workspaceScoped: true,
    statusIndexed: true,
    exported: true
  }
};

const models = parseModels(schema);
const expectedPrimaryIds = {
  User: "userId",
  Workspace: "workspaceId",
  WorkspaceMember: "memberId",
  Invitation: "invitationId",
  Agent: "agentId",
  Subscription: "subscriptionId",
  Transaction: "transactionId",
  Tool: "toolId",
  ToolConnection: "toolConnectionId",
  AgentToolAssignment: "assignmentId",
  Workflow: "workflowId",
  WorkflowStep: "workflowStepId",
  Task: "taskId",
  TaskRun: "taskRunId",
  Document: "documentId",
  KnowledgeIndex: "knowledgeIndexId",
  KnowledgeAccessGrant: "knowledgeAccessGrantId",
  Job: "jobId"
};

for (const [modelName, expectation] of Object.entries(expectedModels)) {
  const model = requireModel(models, modelName);

  for (const [fieldName, fieldType] of Object.entries(expectation.fields)) {
    requireField(modelName, model, fieldName, fieldType);
  }

  const primaryIdField = expectedPrimaryIds[modelName];
  assert.match(
    model.fields.get(primaryIdField).line,
    /\s@id(\s|$)/,
    `${modelName}.${primaryIdField} must be the primary identifier`
  );

  if (expectation.workspaceScoped) {
    requireField(modelName, model, "workspaceId", expectation.fields.workspaceId);
    requireIndexStartingWith(modelName, model, "workspaceId");
  }

  for (const fieldName of expectation.userFields ?? []) {
    requireIndexContaining(modelName, model, fieldName);
  }

  for (const fieldName of expectation.parentFields ?? []) {
    requireIndexContaining(modelName, model, fieldName);
  }

  if (expectation.statusIndexed) {
    requireIndexContaining(modelName, model, "status");
  }

  if (expectation.exported) {
    assert.match(
      databaseExports,
      new RegExp(`\\b${modelName}\\b`),
      `${modelName} type must be exported from @vcp/database`
    );
  }
}

for (const modelName of ["Agent", "Subscription", "Transaction"]) {
  assert.match(
    databaseExports,
    new RegExp(`\\b${modelName}\\b`),
    `${modelName} existing model export must remain available`
  );
}

assert.ok(existsSync(migrationPath), "platform data model migration must exist");

for (const tableName of [
  "users",
  "workspaces",
  "workspace_members",
  "invitations",
  "subscriptions",
  "transactions",
  "tools",
  "tool_connections",
  "agent_tool_assignments",
  "workflows",
  "workflow_steps",
  "tasks",
  "task_runs",
  "documents",
  "knowledge_indexes",
  "knowledge_access_grants",
  "jobs"
]) {
  assert.match(migration, new RegExp(`CREATE TABLE "${tableName}"`), `missing table ${tableName}`);
}

assert.doesNotMatch(migration, /ON DELETE CASCADE/i, "migration must avoid broad cascade deletes");

console.log("platform data model boundary checks passed");
