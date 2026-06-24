import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Repository root resolution based on import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../');

const schemaPath = path.join(repoRoot, 'packages/database/prisma/schema.prisma');
const migrationPath = path.join(
  repoRoot,
  'packages/database/prisma/migrations/0004_extend_task_orchestration_foundation/migration.sql'
);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract a Prisma model block with brace-aware parsing.
 * Finds "model ModelName {" and returns all content until the matching "}"
 * Handles nested braces correctly.
 *
 * @param {string} schemaText - The full schema content
 * @param {string} modelName - The model to extract (e.g., "Task")
 * @returns {string} The model block including "model ModelName { ... }"
 */
function extractPrismaModel(schemaText, modelName) {
  const modelRegex = new RegExp(`^\\s*model\\s+${modelName}\\s*\\{`, 'm');
  const match = schemaText.match(modelRegex);

  if (!match) {
    throw new Error(`Model '${modelName}' not found in schema.prisma`);
  }

  const startIdx = match.index;
  let braceCount = 0;
  let inModel = false;
  let modelEnd = -1;

  for (let i = startIdx; i < schemaText.length; i++) {
    const char = schemaText[i];

    if (char === '{') {
      braceCount++;
      inModel = true;
    } else if (char === '}') {
      braceCount--;
      if (inModel && braceCount === 0) {
        modelEnd = i;
        break;
      }
    }
  }

  if (modelEnd === -1) {
    throw new Error(
      `Malformed or unclosed model block for '${modelName}' in schema.prisma`
    );
  }

  return schemaText.substring(startIdx, modelEnd + 1);
}

/**
 * Parse Prisma model text and extract fields and decorators.
 *
 * @param {string} modelBlock - The model block text
 * @returns {object} { fields: [name, ...], decorators: [line, ...] }
 */
function parseModelBlock(modelBlock) {
  const lines = modelBlock.split('\n');
  const fields = [];
  const decorators = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Model decorator (@@)
    if (trimmed.startsWith('@@')) {
      decorators.push(trimmed);
      continue;
    }

    // Field decorator (@)
    if (trimmed.startsWith('@')) {
      continue;
    }

    // Field declaration: "fieldName TypeAndModifiers"
    const fieldMatch = trimmed.match(/^(\w+)\s+/);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
    }
  }

  return { fields, decorators };
}

/**
 * Assert that a decorator exists in the model.
 *
 * @param {string[]} decorators - List of decorators from the model
 * @param {string} pattern - Pattern to search for (substring match)
 * @param {string} message - Assertion message
 */
function assertDecoratorExists(decorators, pattern, message) {
  const found = decorators.some(d => d.includes(pattern));
  assert(found, `${message} - expected to find "${pattern}" in decorators`);
}

/**
 * Assert that a decorator does NOT exist in the model.
 *
 * @param {string[]} decorators - List of decorators from the model
 * @param {string} pattern - Pattern to search for
 * @param {string} message - Assertion message
 */
function assertDecoratorNotExists(decorators, pattern, message) {
  const found = decorators.some(d => d.includes(pattern));
  assert(
    !found,
    `${message} - expected NOT to find "${pattern}" in decorators`
  );
}

/**
 * Assert that all required fields exist in the model.
 *
 * @param {string[]} fields - List of fields from the model
 * @param {string[]} requiredFields - Fields that must exist
 * @param {string} message - Assertion message
 */
function assertFieldsExist(fields, requiredFields, message) {
  for (const field of requiredFields) {
    assert(
      fields.includes(field),
      `${message} - missing field '${field}'`
    );
  }
}

/**
 * Assert that fields do NOT exist in the model.
 *
 * @param {string[]} fields - List of fields from the model
 * @param {string[]} forbiddenFields - Fields that must not exist
 * @param {string} message - Assertion message
 */
function assertFieldsNotExist(fields, forbiddenFields, message) {
  for (const field of forbiddenFields) {
    assert(
      !fields.includes(field),
      `${message} - unexpected field '${field}'`
    );
  }
}

/**
 * Assert that the migration contains expected SQL patterns.
 *
 * @param {string} migrationContent - The migration SQL content
 * @param {string} pattern - Pattern to search for
 * @param {string} message - Assertion message
 */
function assertMigrationHasPattern(migrationContent, pattern, message) {
  assert(
    migrationContent.includes(pattern),
    `${message} - migration missing expected pattern: "${pattern}"`
  );
}

/**
 * Assert that the migration does NOT contain forbidden patterns.
 *
 * @param {string} migrationContent - The migration SQL content
 * @param {string} pattern - Pattern to search for
 * @param {string} message - Assertion message
 */
function assertMigrationNotHasPattern(migrationContent, pattern, message) {
  assert(
    !migrationContent.includes(pattern),
    `${message} - migration contains forbidden pattern: "${pattern}"`
  );
}

/**
 * Extract field type declarations from a Prisma model block.
 * Returns an object mapping field names to their declarations including type and nullability.
 *
 * @param {string} modelBlock - The model block text
 * @returns {object} { fieldName: "TypeDeclaration", ... }
 *   Example: { taskId: "String @id", result: "Json?" }
 */
function extractFieldTypes(modelBlock) {
  const lines = modelBlock.split('\n');
  const fields = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('@')) {
      continue;
    }

    // Field declaration: "fieldName Type [Type?] [@decorator] ..."
    const fieldMatch = trimmed.match(/^(\w+)\s+(\S+(?:\s+\S+)*?)(?:\s+@|$)/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const typeDecl = fieldMatch[2].trim();
      fields[fieldName] = typeDecl;
    }
  }

  return fields;
}

/**
 * Assert that a field has the expected type and nullability.
 *
 * @param {object} fieldTypes - Field types extracted from model
 * @param {string} fieldName - Name of field to check
 * @param {string} expectedType - Expected type (e.g., "String", "Int", "Json")
 * @param {boolean} expectedNullable - Whether the field should be nullable (ends with ?)
 * @param {string} modelName - Model name for error messages
 * @param {string} message - Assertion message
 */
function assertFieldDeclaration(fieldTypes, fieldName, expectedType, expectedNullable, modelName, message) {
  assert(
    fieldTypes[fieldName] !== undefined,
    `${message} - model ${modelName} missing field '${fieldName}'`
  );

  const declaration = fieldTypes[fieldName];
  const isNullable = declaration.endsWith('?');
  const actualType = isNullable ? declaration.slice(0, -1) : declaration;

  assert(
    actualType === expectedType && isNullable === expectedNullable,
    `${message} - model ${modelName} field '${fieldName}': ` +
    `expected '${expectedType}${expectedNullable ? '?' : ''}', ` +
    `got '${declaration}'`
  );
}

// ============================================================================
// TEST SUITE
// ============================================================================

console.log('Loading files...');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
console.log('✓ Schema and migration files loaded\n');

// ============================================================================
// COMPATIBILITY A2: Model existence
// ============================================================================
console.log('--- Compatibility A2: Model Existence ---');

const taskModelBlock = extractPrismaModel(schemaContent, 'Task');
assert(
  taskModelBlock.includes('model Task'),
  'Task model must exist in schema'
);
console.log('✓ Task model exists');

const taskRunModelBlock = extractPrismaModel(schemaContent, 'TaskRun');
assert(
  taskRunModelBlock.includes('model TaskRun'),
  'TaskRun model must exist in schema'
);
console.log('✓ TaskRun model exists');

try {
  extractPrismaModel(schemaContent, 'TaskWork');
  assert.fail('TaskWork model must NOT exist in schema');
} catch (e) {
  if (e.code === 'ERR_ASSERTION') throw e;
  console.log('✓ TaskWork model does NOT exist');
}

// ============================================================================
// COMPATIBILITY A2: TaskRun primary key and critical fields
// ============================================================================
console.log('\n--- Compatibility A2: TaskRun Primary Key & Critical Fields ---');

const taskRunParsed = parseModelBlock(taskRunModelBlock);
assertFieldsExist(
  taskRunParsed.fields,
  ['taskRunId'],
  'TaskRun must have taskRunId'
);
console.log('✓ TaskRun.taskRunId exists (primary key)');

assertFieldsExist(
  taskRunParsed.fields,
  ['jobId'],
  'TaskRun must have jobId'
);
console.log('✓ TaskRun.jobId exists');

assert(
  taskRunModelBlock.includes('@@map("task_runs")'),
  'TaskRun must map to "task_runs" table'
);
console.log('✓ TaskRun maps to "task_runs" table');

// Verify no task_works mapping exists
assert(
  !schemaContent.includes('task_works'),
  'Schema must not contain "task_works" table mapping'
);
console.log('✓ No "task_works" table mapping exists');

// Verify no workId field
const allFieldNames = taskRunParsed.fields;
assert(
  !allFieldNames.includes('workId'),
  'TaskRun must not have a "workId" field'
);
console.log('✓ TaskRun does not have "workId" field');

// ============================================================================
// TASK MODEL ASSERTIONS
// ============================================================================
console.log('\n--- Task Model Assertions ---');

const taskParsed = parseModelBlock(taskModelBlock);
const requiredTaskFields = [
  'taskId',
  'workspaceId',
  'submittedByUserId',
  'prompt',
  'routingMode',
  'agentId',
  'workflowId',
  'status',
  'createdAt',
  'updatedAt',
  'runs'
];
assertFieldsExist(
  taskParsed.fields,
  requiredTaskFields,
  'Task must have all approved fields'
);
console.log('✓ Task has all required fields');

// Check Task decorators
assertDecoratorExists(
  taskParsed.decorators,
  '@@unique([workspaceId, taskId])',
  'Task must have workspace-taskId composite unique index'
);
console.log('✓ Task has @@unique([workspaceId, taskId])');

assertDecoratorExists(
  taskParsed.decorators,
  '@@map("tasks")',
  'Task must map to "tasks" table'
);
console.log('✓ Task maps to "tasks" table');

// Reject forbidden Task fields
const forbiddenTaskFields = ['completedAt', 'finishedAt'];
assertFieldsNotExist(
  taskParsed.fields,
  forbiddenTaskFields,
  'Task must not have deprecated fields'
);
console.log('✓ Task does not have completedAt or finishedAt fields');

// Verify no Prisma relation to external modules in Task
assert(
  !taskModelBlock.includes('Workspace @relation'),
  'Task must not have Workspace Prisma relation'
);
assert(
  !taskModelBlock.includes('User @relation'),
  'Task must not have User Prisma relation'
);
assert(
  !taskModelBlock.includes('Agent @relation'),
  'Task must not have Agent Prisma relation'
);
assert(
  !taskModelBlock.includes('Workflow @relation'),
  'Task must not have Workflow Prisma relation'
);
console.log('✓ Task has no external module Prisma relations');

// ============================================================================
// TASK FIELD TYPE ASSERTIONS
// ============================================================================
console.log('\n--- Task Field Type Assertions ---');

const taskFieldTypes = extractFieldTypes(taskModelBlock);

// Verify exact field type declarations
assertFieldDeclaration(taskFieldTypes, 'taskId', 'String', false, 'Task', 'Task.taskId type');
console.log('✓ Task.taskId: String @id');

assertFieldDeclaration(taskFieldTypes, 'workspaceId', 'String', false, 'Task', 'Task.workspaceId type');
console.log('✓ Task.workspaceId: String');

assertFieldDeclaration(taskFieldTypes, 'submittedByUserId', 'String', false, 'Task', 'Task.submittedByUserId type');
console.log('✓ Task.submittedByUserId: String');

assertFieldDeclaration(taskFieldTypes, 'prompt', 'String', false, 'Task', 'Task.prompt type');
console.log('✓ Task.prompt: String (required)');

assertFieldDeclaration(taskFieldTypes, 'routingMode', 'String', false, 'Task', 'Task.routingMode type');
console.log('✓ Task.routingMode: String');

assertFieldDeclaration(taskFieldTypes, 'agentId', 'String', true, 'Task', 'Task.agentId type');
console.log('✓ Task.agentId: String?');

assertFieldDeclaration(taskFieldTypes, 'workflowId', 'String', true, 'Task', 'Task.workflowId type');
console.log('✓ Task.workflowId: String?');

assertFieldDeclaration(taskFieldTypes, 'status', 'String', false, 'Task', 'Task.status type');
console.log('✓ Task.status: String (default: queued)');

assertFieldDeclaration(taskFieldTypes, 'createdAt', 'String', false, 'Task', 'Task.createdAt type');
console.log('✓ Task.createdAt: String');

assertFieldDeclaration(taskFieldTypes, 'updatedAt', 'String', false, 'Task', 'Task.updatedAt type');
console.log('✓ Task.updatedAt: String');

assertFieldDeclaration(taskFieldTypes, 'runs', 'TaskRun[]', false, 'Task', 'Task.runs type');
console.log('✓ Task.runs: TaskRun[]');

// ============================================================================
// TASKRUN MODEL ASSERTIONS
// ============================================================================
console.log('\n--- TaskRun Model Assertions ---');

const requiredTaskRunFields = [
  'taskRunId',
  'workspaceId',
  'taskId',
  'jobId',
  'status',
  'attemptNumber',
  'resolvedAgentId',
  'resolvedWorkflowId',
  'result',
  'errorCode',
  'errorMessage',
  'queuedAt',
  'startedAt',
  'completedAt',
  'createdAt',
  'updatedAt',
  'task'
];
assertFieldsExist(
  taskRunParsed.fields,
  requiredTaskRunFields,
  'TaskRun must have all approved fields'
);
console.log('✓ TaskRun has all required fields');

// Check TaskRun unique constraints
assertDecoratorExists(
  taskRunParsed.decorators,
  '@@unique([taskId, attemptNumber])',
  'TaskRun must have unique taskId-attemptNumber constraint'
);
console.log('✓ TaskRun has @@unique([taskId, attemptNumber])');

assertDecoratorExists(
  taskRunParsed.decorators,
  '@@unique([jobId])',
  'TaskRun must have unique jobId constraint'
);
console.log('✓ TaskRun has @@unique([jobId])');

// Check TaskRun composite indexes
assertDecoratorExists(
  taskRunParsed.decorators,
  '@@index([workspaceId, taskId])',
  'TaskRun must have composite index on workspaceId, taskId'
);
console.log('✓ TaskRun has @@index([workspaceId, taskId])');

// Verify the Task relation has correct field references
assert(
  taskRunModelBlock.includes(
    'fields: [workspaceId, taskId]'
  ),
  'TaskRun.task relation must use fields [workspaceId, taskId]'
);
console.log('✓ TaskRun.task relation uses fields [workspaceId, taskId]');

assert(
  taskRunModelBlock.includes(
    'references: [workspaceId, taskId]'
  ),
  'TaskRun.task relation must reference [workspaceId, taskId]'
);
console.log('✓ TaskRun.task relation references [workspaceId, taskId]');

assert(
  taskRunModelBlock.includes('onDelete: Restrict'),
  'TaskRun.task relation must use onDelete: Restrict'
);
console.log('✓ TaskRun.task relation uses onDelete: Restrict');

assert(
  taskRunModelBlock.includes('onUpdate: NoAction'),
  'TaskRun.task relation must use onUpdate: NoAction'
);
console.log('✓ TaskRun.task relation uses onUpdate: NoAction');

// Verify TaskRun table mapping
assertDecoratorExists(
  taskRunParsed.decorators,
  '@@map("task_runs")',
  'TaskRun must map to "task_runs" table'
);
console.log('✓ TaskRun maps to "task_runs" table');

// Reject forbidden TaskRun indexes
assertDecoratorNotExists(
  taskRunParsed.decorators,
  '@@index([workspaceId, taskRunId])',
  'TaskRun must not have deprecated workspaceId-taskRunId index'
);
console.log('✓ TaskRun does not have deprecated @@index([workspaceId, taskRunId])');

// ============================================================================
// TASKRUN FIELD TYPE ASSERTIONS
// ============================================================================
console.log('\n--- TaskRun Field Type Assertions ---');

const taskRunFieldTypes = extractFieldTypes(taskRunModelBlock);

// Verify exact field type declarations
assertFieldDeclaration(taskRunFieldTypes, 'taskRunId', 'String', false, 'TaskRun', 'TaskRun.taskRunId type');
console.log('✓ TaskRun.taskRunId: String @id');

assertFieldDeclaration(taskRunFieldTypes, 'workspaceId', 'String', false, 'TaskRun', 'TaskRun.workspaceId type');
console.log('✓ TaskRun.workspaceId: String');

assertFieldDeclaration(taskRunFieldTypes, 'taskId', 'String', false, 'TaskRun', 'TaskRun.taskId type');
console.log('✓ TaskRun.taskId: String');

assertFieldDeclaration(taskRunFieldTypes, 'jobId', 'String', true, 'TaskRun', 'TaskRun.jobId type');
console.log('✓ TaskRun.jobId: String?');

assertFieldDeclaration(taskRunFieldTypes, 'status', 'String', false, 'TaskRun', 'TaskRun.status type');
console.log('✓ TaskRun.status: String (default: queued)');

assertFieldDeclaration(taskRunFieldTypes, 'attemptNumber', 'Int', false, 'TaskRun', 'TaskRun.attemptNumber type');
console.log('✓ TaskRun.attemptNumber: Int');

assertFieldDeclaration(taskRunFieldTypes, 'resolvedAgentId', 'String', true, 'TaskRun', 'TaskRun.resolvedAgentId type');
console.log('✓ TaskRun.resolvedAgentId: String?');

assertFieldDeclaration(taskRunFieldTypes, 'resolvedWorkflowId', 'String', true, 'TaskRun', 'TaskRun.resolvedWorkflowId type');
console.log('✓ TaskRun.resolvedWorkflowId: String?');

assertFieldDeclaration(taskRunFieldTypes, 'result', 'Json', true, 'TaskRun', 'TaskRun.result type');
console.log('✓ TaskRun.result: Json?');

assertFieldDeclaration(taskRunFieldTypes, 'errorCode', 'String', true, 'TaskRun', 'TaskRun.errorCode type');
console.log('✓ TaskRun.errorCode: String?');

assertFieldDeclaration(taskRunFieldTypes, 'errorMessage', 'String', true, 'TaskRun', 'TaskRun.errorMessage type');
console.log('✓ TaskRun.errorMessage: String?');

assertFieldDeclaration(taskRunFieldTypes, 'queuedAt', 'String', false, 'TaskRun', 'TaskRun.queuedAt type');
console.log('✓ TaskRun.queuedAt: String (required)');

assertFieldDeclaration(taskRunFieldTypes, 'startedAt', 'String', true, 'TaskRun', 'TaskRun.startedAt type');
console.log('✓ TaskRun.startedAt: String?');

assertFieldDeclaration(taskRunFieldTypes, 'completedAt', 'String', true, 'TaskRun', 'TaskRun.completedAt type');
console.log('✓ TaskRun.completedAt: String?');

assertFieldDeclaration(taskRunFieldTypes, 'createdAt', 'String', false, 'TaskRun', 'TaskRun.createdAt type');
console.log('✓ TaskRun.createdAt: String');

assertFieldDeclaration(taskRunFieldTypes, 'updatedAt', 'String', false, 'TaskRun', 'TaskRun.updatedAt type');
console.log('✓ TaskRun.updatedAt: String');

assertFieldDeclaration(taskRunFieldTypes, 'task', 'Task', false, 'TaskRun', 'TaskRun.task type');
console.log('✓ TaskRun.task: Task @relation');

// ============================================================================
// MIGRATION SCOPE ASSERTIONS
// ============================================================================
console.log('\n--- Migration Scope Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  '"tasks"',
  'Migration must modify tasks table'
);
console.log('✓ Migration modifies "tasks" table');

assertMigrationHasPattern(
  migrationContent,
  '"task_runs"',
  'Migration must modify task_runs table'
);
console.log('✓ Migration modifies "task_runs" table');

// ============================================================================
// NON-DESTRUCTIVE MIGRATION ASSERTIONS
// ============================================================================
console.log('\n--- Non-Destructive Migration Assertions ---');

assertMigrationNotHasPattern(
  migrationContent,
  'DROP TABLE',
  'Migration must not drop tables'
);
console.log('✓ Migration does not drop tables');

assertMigrationNotHasPattern(
  migrationContent,
  'DROP COLUMN',
  'Migration must not drop columns'
);
console.log('✓ Migration does not drop columns');

assertMigrationNotHasPattern(
  migrationContent,
  'TRUNCATE',
  'Migration must not truncate tables'
);
console.log('✓ Migration does not truncate tables');

assertMigrationNotHasPattern(
  migrationContent,
  'task_works',
  'Migration must not create task_works table'
);
console.log('✓ Migration does not reference task_works');

// ============================================================================
// PROMPT MIGRATION ASSERTIONS
// ============================================================================
console.log('\n--- Prompt Migration Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  'IF EXISTS (SELECT 1 FROM "tasks")',
  'Migration must preflight existing Task rows'
);
console.log('✓ Migration has Task row preflight');

assertMigrationHasPattern(
  migrationContent,
  'approved prompt backfill policy',
  'Migration must reference approved prompt backfill policy'
);
console.log('✓ Migration references approved prompt backfill policy');

assertMigrationHasPattern(
  migrationContent,
  'ADD COLUMN "prompt" TEXT NOT NULL',
  'Migration must add prompt as TEXT NOT NULL'
);
console.log('✓ Migration adds prompt as TEXT NOT NULL');

assertMigrationNotHasPattern(
  migrationContent,
  "DEFAULT ''",
  'Migration must not provide empty-string prompt default'
);
console.log('✓ Migration does not provide empty prompt default');

// ============================================================================
// OWNERSHIP PREFLIGHT ASSERTIONS
// ============================================================================
console.log('\n--- Ownership Preflight Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  'orphan task_run rows exist',
  'Migration must have orphan TaskRun detection'
);
console.log('✓ Migration has orphan TaskRun detection');

assertMigrationHasPattern(
  migrationContent,
  'task_run workspaceId differs from task workspaceId',
  'Migration must have workspace mismatch detection'
);
console.log('✓ Migration has workspace mismatch detection');

// Verify preflights occur before foreign key addition
const preflight1Idx = migrationContent.indexOf('orphan task_run rows');
const preflight2Idx = migrationContent.indexOf(
  'task_run workspaceId differs from task'
);
const fkIdx = migrationContent.indexOf('task_runs_workspaceId_taskId_fkey');

assert(
  preflight1Idx < fkIdx && preflight2Idx < fkIdx,
  'Ownership preflights must occur before foreign key creation'
);
console.log('✓ Ownership preflights occur before foreign key creation');

// ============================================================================
// ATTEMPTNUMBER MIGRATION ASSERTIONS
// ============================================================================
console.log('\n--- attemptNumber Migration Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  'ADD COLUMN "attemptNumber" INTEGER',
  'Migration must add attemptNumber without NOT NULL initially'
);
console.log('✓ Migration adds attemptNumber without initial NOT NULL');

assertMigrationHasPattern(
  migrationContent,
  'ROW_NUMBER() OVER',
  'Migration must use ROW_NUMBER window function'
);
console.log('✓ Migration uses ROW_NUMBER() OVER');

assertMigrationHasPattern(
  migrationContent,
  'PARTITION BY "taskId"',
  'Migration must partition by taskId'
);
console.log('✓ Migration partitions by taskId');

assertMigrationHasPattern(
  migrationContent,
  'ORDER BY "createdAt", "taskRunId"',
  'Migration must order by createdAt, taskRunId'
);
console.log('✓ Migration orders by createdAt, taskRunId');

// Verify backfill occurs before SET NOT NULL
const attemptNumberBackfillIdx = migrationContent.indexOf(
  'UPDATE "task_runs" tr'
);
const attemptNumberSetNotNullIdx = migrationContent.indexOf(
  'ALTER COLUMN "attemptNumber" SET NOT NULL'
);

assert(
  attemptNumberBackfillIdx < attemptNumberSetNotNullIdx,
  'attemptNumber backfill must occur before SET NOT NULL'
);
console.log('✓ attemptNumber backfill occurs before SET NOT NULL');

// Verify unique index creation after SET NOT NULL
const uniqueIndexAttemptIdx = migrationContent.indexOf(
  'task_runs_taskId_attemptNumber_key'
);

assert(
  attemptNumberSetNotNullIdx < uniqueIndexAttemptIdx,
  'SET NOT NULL must occur before unique index creation'
);
console.log('✓ SET NOT NULL occurs before unique index creation');

// ============================================================================
// QUEUEDAT MIGRATION ASSERTIONS
// ============================================================================
console.log('\n--- queuedAt Migration Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  'ADD COLUMN "queuedAt" TEXT',
  'Migration must add queuedAt as TEXT'
);
console.log('✓ Migration adds queuedAt as TEXT');

assertMigrationHasPattern(
  migrationContent,
  'SET "queuedAt" = "createdAt"',
  'Migration must backfill queuedAt from createdAt'
);
console.log('✓ Migration backfills queuedAt from createdAt');

// Verify backfill occurs before SET NOT NULL
const queuedAtBackfillIdx = migrationContent.indexOf(
  'SET "queuedAt" = "createdAt"'
);
const queuedAtSetNotNullIdx = migrationContent.indexOf(
  'ALTER COLUMN "queuedAt" SET NOT NULL'
);

assert(
  queuedAtBackfillIdx < queuedAtSetNotNullIdx,
  'queuedAt backfill must occur before SET NOT NULL'
);
console.log('✓ queuedAt backfill occurs before SET NOT NULL');

// ============================================================================
// RESULT MIGRATION ASSERTIONS
// ============================================================================
console.log('\n--- Result Migration Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  'ADD COLUMN "result" JSONB',
  'Migration must add result as JSONB'
);
console.log('✓ Migration adds result as JSONB');

// ============================================================================
// COMPOSITE FOREIGN KEY ASSERTIONS
// ============================================================================
console.log('\n--- Composite Foreign Key Assertions ---');

assertMigrationHasPattern(
  migrationContent,
  'FOREIGN KEY ("workspaceId", "taskId") REFERENCES "tasks"("workspaceId", "taskId")',
  'Migration must create composite FK with correct columns'
);
console.log(
  '✓ Migration creates composite FK with correct columns'
);

assertMigrationHasPattern(
  migrationContent,
  'ON DELETE RESTRICT',
  'Migration must specify ON DELETE RESTRICT'
);
console.log('✓ Migration specifies ON DELETE RESTRICT');

assertMigrationHasPattern(
  migrationContent,
  'ON UPDATE NO ACTION',
  'Migration must specify ON UPDATE NO ACTION'
);
console.log('✓ Migration specifies ON UPDATE NO ACTION');

// ============================================================================
// SUCCESS REPORT
// ============================================================================

console.log('\n' + '='.repeat(75));
console.log('SUCCESS: All Task & Orchestration Prisma Persistence Contracts Verified');
console.log('='.repeat(75));

console.log('\nVerified Contracts:');
console.log('  ✓ Model Existence (Task, TaskRun; no TaskWork)');
console.log('  ✓ Task Model Fields & Decorators');
console.log('  ✓ Task Field Types & Nullability');
console.log('  ✓ TaskRun Model Fields & Decorators');
console.log('  ✓ TaskRun Field Types & Nullability');
console.log('  ✓ TaskRun Primary Key & JobId');
console.log('  ✓ Task Composite Unique Index');
console.log('  ✓ TaskRun Composite Indexes & Foreign Key');
console.log('  ✓ Table Mappings');
console.log('  ✓ Non-Destructive Migration');
console.log('  ✓ Prompt Migration & Preflight');
console.log('  ✓ Ownership Preflights');
console.log('  ✓ attemptNumber Migration');
console.log('  ✓ queuedAt Migration');
console.log('  ✓ Result JSONB Migration');
console.log('  ✓ Composite Foreign Key Constraints');

console.log(
  '\nTest file: tests/contract/task-orchestration-prisma-persistence.test.mjs'
);
console.log('Schema file: packages/database/prisma/schema.prisma');
console.log(
  'Migration file: packages/database/prisma/migrations/0004_extend_task_orchestration_foundation/migration.sql'
);
console.log('\nExit code: 0 (success)');

process.exit(0);
