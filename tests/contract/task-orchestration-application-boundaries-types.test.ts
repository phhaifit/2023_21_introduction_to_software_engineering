/**
 * Compile-time type verification for Task & Orchestration application boundaries.
 *
 * This file is compiled by tsconfig.task-orchestration.json in strict mode.
 * It verifies that:
 * - Port interfaces require correct parameters in correct order
 * - EntityId branded types are enforced
 * - Workspace scoping is required for all persistence operations
 * - Return types and promise shapes are correct
 * - Invalid assignments are rejected at compile time
 *
 * @ts-check
 */

import type {
  EntityId,
  TaskRoutingSelection,
  CreateTaskResponse,
} from "@vcp/shared";
import type { CreateTaskCommand } from "../../apps/backend/src/modules/task-orchestration/application/create-task-command.ts";
import type { CreateTaskUseCase } from "../../apps/backend/src/modules/task-orchestration/application/create-task-use-case.ts";
import type { Task } from "../../apps/backend/src/modules/task-orchestration/domain/task.ts";
import type { TaskWork } from "../../apps/backend/src/modules/task-orchestration/domain/task-work.ts";
import type { TaskRepository } from "../../apps/backend/src/modules/task-orchestration/application/task-repository.ts";
import type { TaskWorkRepository } from "../../apps/backend/src/modules/task-orchestration/application/task-work-repository.ts";
import type { TaskIdentityGenerator } from "../../apps/backend/src/modules/task-orchestration/application/ports.ts";
import type { TaskClock } from "../../apps/backend/src/modules/task-orchestration/application/ports.ts";
import type { AgentRoutingCatalog } from "../../apps/backend/src/modules/task-orchestration/application/ports.ts";
import type { WorkflowRoutingCatalog } from "../../apps/backend/src/modules/task-orchestration/application/ports.ts";

// ============================================================
// CreateTaskCommand: Valid and Invalid Cases
// ============================================================

// Valid: All required fields
const validCommand: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
};

// Invalid: Missing workspaceId
// @ts-expect-error Property 'workspaceId' is missing
const missingWorkspaceCommand: CreateTaskCommand = {
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
};

// Invalid: Missing submittedByUserId
// @ts-expect-error Property 'submittedByUserId' is missing
const missingSubmitterCommand: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
};

// Invalid: Missing prompt
// @ts-expect-error Property 'prompt' is missing
const missingPromptCommand: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  routing: { mode: "auto" } as TaskRoutingSelection,
};

// Invalid: Missing routing
// @ts-expect-error Property 'routing' is missing
const missingRoutingCommand: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
};

// Invalid: Fresh literal containing taskId
const commandWithTaskId: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
  // @ts-expect-error Object literal may only specify known properties, and 'taskId' does not exist
  taskId: "task-123" as EntityId<"taskId">,
};

// Invalid: Fresh literal containing workId
const commandWithWorkId: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
  // @ts-expect-error Object literal may only specify known properties, and 'workId' does not exist
  workId: "work-456" as EntityId<"workId">,
};

// Invalid: Fresh literal containing status
const commandWithStatus: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
  // @ts-expect-error Object literal may only specify known properties, and 'status' does not exist
  status: "queued",
};

// Invalid: Fresh literal containing createdAt
const commandWithCreatedAt: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
  // @ts-expect-error Object literal may only specify known properties, and 'createdAt' does not exist
  createdAt: "2026-06-24T00:00:00.000Z",
};

// Invalid: Fresh literal containing updatedAt
const commandWithUpdatedAt: CreateTaskCommand = {
  workspaceId: "workspace-1" as EntityId<"workspaceId">,
  submittedByUserId: "user-42" as EntityId<"userId">,
  prompt: "Analyze the market trends",
  routing: { mode: "auto" } as TaskRoutingSelection,
  // @ts-expect-error Object literal may only specify known properties, and 'updatedAt' does not exist
  updatedAt: "2026-06-24T00:00:00.000Z",
};

// ============================================================
// CreateTaskUseCase: Valid and Invalid Implementations
// ============================================================

// Valid: Correct implementation shape
const validUseCase: CreateTaskUseCase = {
  execute: async (command: CreateTaskCommand): Promise<CreateTaskResponse> => {
    return {
      taskId: "task-123" as EntityId<"taskId">,
      workId: "work-456" as EntityId<"workId">,
      status: "queued",
      createdAt: "2026-06-24T12:00:00.000Z",
    };
  },
};

// Invalid: Wrong command type
const wrongCommandUseCase: CreateTaskUseCase = {
  // @ts-expect-error Type '(command: { wrongField: string; }) => Promise<CreateTaskResponse>' is not assignable
  execute: async (command: { wrongField: string }): Promise<CreateTaskResponse> => {
    return {
      taskId: "task-123" as EntityId<"taskId">,
      workId: "work-456" as EntityId<"workId">,
      status: "queued",
      createdAt: "2026-06-24T12:00:00.000Z",
    };
  },
};

// Invalid: Wrong response Task ID type
const wrongResponseTaskIdUseCase: CreateTaskUseCase = {
  execute: async (command: CreateTaskCommand): Promise<CreateTaskResponse> => {
    return {
      // @ts-expect-error Type 'EntityId<"workId">' is not assignable to type 'EntityId<"taskId">'
      taskId: "work-456" as EntityId<"workId">,
      workId: "work-456" as EntityId<"workId">,
      status: "queued",
      createdAt: "2026-06-24T12:00:00.000Z",
    };
  },
};

// Invalid: Wrong response Work ID type
const wrongResponseWorkIdUseCase: CreateTaskUseCase = {
  execute: async (command: CreateTaskCommand): Promise<CreateTaskResponse> => {
    return {
      taskId: "task-123" as EntityId<"taskId">,
      // @ts-expect-error Type 'EntityId<"taskId">' is not assignable to type 'EntityId<"workId">'
      workId: "task-123" as EntityId<"taskId">,
      status: "queued",
      createdAt: "2026-06-24T12:00:00.000Z",
    };
  },
};

// Invalid: Wrong response status type
const wrongResponseStatusUseCase: CreateTaskUseCase = {
  execute: async (command: CreateTaskCommand): Promise<CreateTaskResponse> => {
    return {
      taskId: "task-123" as EntityId<"taskId">,
      workId: "work-456" as EntityId<"workId">,
      // @ts-expect-error Type '"wrong"' is not assignable to type TaskStatus
      status: "wrong",
      createdAt: "2026-06-24T12:00:00.000Z",
    };
  },
};

// Invalid: Missing response fields
const missingResponseFieldsUseCase: CreateTaskUseCase = {
  execute: async (command: CreateTaskCommand): Promise<CreateTaskResponse> => {
    // @ts-expect-error Property 'taskId' is missing
    return {
      workId: "work-456" as EntityId<"workId">,
      status: "queued",
      createdAt: "2026-06-24T12:00:00.000Z",
    };
  },
};

// ============================================================
// TaskRepository: Workspace Scoping and Parameter Types
// ============================================================

// Valid: save requires workspace ID and Task
const validSaveRepo: TaskRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    task: Task
  ): Promise<Task> => {
    return task;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<Task | null> => {
    return null;
  },
};

// Invalid: save without workspace parameter
const saveWithoutWorkspaceRepo: TaskRepository = {
  // @ts-expect-error Argument of type '(task: Task) => Promise<Task>' is not assignable
  save: async (task: Task): Promise<Task> => {
    return task;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<Task | null> => {
    return null;
  },
};

// Invalid: find without workspace parameter
const findWithoutWorkspaceRepo: TaskRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    task: Task
  ): Promise<Task> => {
    return task;
  },
  // @ts-expect-error Argument of type '(taskId: EntityId<"taskId">) => Promise<Task | null>' is not assignable
  findById: async (taskId: EntityId<"taskId">): Promise<Task | null> => {
    return null;
  },
};

// Invalid: Work ID cannot replace Task ID in find
const wrongIdKindRepo: TaskRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    task: Task
  ): Promise<Task> => {
    return task;
  },
  // @ts-expect-error Type 'EntityId<"workId">' is not assignable to type 'EntityId<"taskId">'
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"workId">
  ): Promise<Task | null> => {
    return null;
  },
};

// Invalid: Agent ID cannot replace Workspace ID
const wrongWorkspaceIdKindRepo: TaskRepository = {
  // @ts-expect-error Type 'EntityId<"agentId">' is not assignable to type 'EntityId<"workspaceId">'
  save: async (
    workspaceId: EntityId<"agentId">,
    task: Task
  ): Promise<Task> => {
    return task;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<Task | null> => {
    return null;
  },
};

// ============================================================
// TaskWorkRepository: Workspace Scoping and Parameter Types
// ============================================================

// Valid: save and find require workspace ID
const validWorkRepo: TaskWorkRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    work: TaskWork
  ): Promise<TaskWork> => {
    return work;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null> => {
    return null;
  },
  listByTaskId: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> => {
    return [];
  },
};

// Invalid: save without workspace
const workRepoSaveNoWorkspace: TaskWorkRepository = {
  // @ts-expect-error Argument of type '(work: TaskWork) => Promise<TaskWork>' is not assignable
  save: async (work: TaskWork): Promise<TaskWork> => {
    return work;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null> => {
    return null;
  },
  listByTaskId: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> => {
    return [];
  },
};

// Invalid: find without workspace
const workRepoFindNoWorkspace: TaskWorkRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    work: TaskWork
  ): Promise<TaskWork> => {
    return work;
  },
  // @ts-expect-error Argument of type '(workId: EntityId<"workId">) => Promise<TaskWork | null>' is not assignable
  findById: async (workId: EntityId<"workId">): Promise<TaskWork | null> => {
    return null;
  },
  listByTaskId: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> => {
    return [];
  },
};

// Invalid: list without workspace
const workRepoListNoWorkspace: TaskWorkRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    work: TaskWork
  ): Promise<TaskWork> => {
    return work;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null> => {
    return null;
  },
  // @ts-expect-error Argument of type '(taskId: EntityId<"taskId">) => Promise<TaskWork[]>' is not assignable
  listByTaskId: async (taskId: EntityId<"taskId">): Promise<readonly TaskWork[]> => {
    return [];
  },
};

// Invalid: Task ID and Work ID swapped
const workRepoSwappedIds: TaskWorkRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    work: TaskWork
  ): Promise<TaskWork> => {
    return work;
  },
  // @ts-expect-error Type 'EntityId<"taskId">' is not assignable to type 'EntityId<"workId">'
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"taskId">
  ): Promise<TaskWork | null> => {
    return null;
  },
  listByTaskId: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> => {
    return [];
  },
};

// Readonly collection is verified through type compatibility
// TypeScript does not report errors for Promise<TaskWork[]> vs Promise<readonly TaskWork[]>
// but the readonly modifier is enforced at the type definition level.
const workRepoWithReadonlyReturn: TaskWorkRepository = {
  save: async (
    workspaceId: EntityId<"workspaceId">,
    work: TaskWork
  ): Promise<TaskWork> => {
    return work;
  },
  findById: async (
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null> => {
    return null;
  },
  listByTaskId: async (
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> => {
    return [];
  },
};

// ============================================================
// TaskIdentityGenerator: Typed ID Generation
// ============================================================

// Valid: Returns correctly typed IDs
const validIdGen: TaskIdentityGenerator = {
  nextTaskId: (): EntityId<"taskId"> => {
    return "task-999" as EntityId<"taskId">;
  },
  nextWorkId: (): EntityId<"workId"> => {
    return "work-999" as EntityId<"workId">;
  },
};

// Invalid: Wrong Task ID kind
const wrongTaskIdKindGen: TaskIdentityGenerator = {
  // @ts-expect-error Type 'EntityId<"workId">' is not assignable to type 'EntityId<"taskId">'
  nextTaskId: (): EntityId<"workId"> => {
    return "work-999" as EntityId<"workId">;
  },
  nextWorkId: (): EntityId<"workId"> => {
    return "work-999" as EntityId<"workId">;
  },
};

// Invalid: Wrong Work ID kind
const wrongWorkIdKindGen: TaskIdentityGenerator = {
  nextTaskId: (): EntityId<"taskId"> => {
    return "task-999" as EntityId<"taskId">;
  },
  // @ts-expect-error Type 'EntityId<"taskId">' is not assignable to type 'EntityId<"workId">'
  nextWorkId: (): EntityId<"taskId"> => {
    return "task-999" as EntityId<"taskId">;
  },
};

// ============================================================
// TaskClock: String-Only Time Output
// ============================================================

// Valid: Returns ISO-8601 string
const validClock: TaskClock = {
  now: (): string => {
    return "2026-06-24T12:00:00.000Z";
  },
};

// Invalid: Returns Date
const dateClockImpl: TaskClock = {
  // @ts-expect-error Type 'Date' is not assignable to type 'string'
  now: (): Date => {
    return new Date();
  },
};

// Invalid: Returns number
const numberClockImpl: TaskClock = {
  // @ts-expect-error Type 'number' is not assignable to type 'string'
  now: (): number => {
    return Date.now();
  },
};

// ============================================================
// AgentRoutingCatalog: Workspace and Agent ID Requirements
// ============================================================

// Valid: Requires workspace ID and agent ID
const validAgentCatalog: AgentRoutingCatalog = {
  isAgentSelectable: async (
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<boolean> => {
    return true;
  },
};

// Invalid: Workflow ID cannot replace Agent ID
const wrongAgentIdKindCatalog: AgentRoutingCatalog = {
  // @ts-expect-error Type 'EntityId<"workflowId">' is not assignable to type 'EntityId<"agentId">'
  isAgentSelectable: async (
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"workflowId">
  ): Promise<boolean> => {
    return true;
  },
};

// Invalid: Missing workspace parameter
const agentCatalogNoWorkspace: AgentRoutingCatalog = {
  // @ts-expect-error Argument of type '(agentId: EntityId<"agentId">) => Promise<boolean>' is not assignable
  isAgentSelectable: async (agentId: EntityId<"agentId">): Promise<boolean> => {
    return true;
  },
};

// Invalid: Returns non-promise
const agentCatalogSyncReturn: AgentRoutingCatalog = {
  // @ts-expect-error Type 'boolean' is not assignable to type 'Promise<boolean>'
  isAgentSelectable: (
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): boolean => {
    return true;
  },
};

// ============================================================
// WorkflowRoutingCatalog: Workspace and Workflow ID Requirements
// ============================================================

// Valid: Requires workspace ID and workflow ID
const validWorkflowCatalog: WorkflowRoutingCatalog = {
  isWorkflowExecutable: async (
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): Promise<boolean> => {
    return true;
  },
};

// Invalid: Agent ID cannot replace Workflow ID
const wrongWorkflowIdKindCatalog: WorkflowRoutingCatalog = {
  // @ts-expect-error Type 'EntityId<"agentId">' is not assignable to type 'EntityId<"workflowId">'
  isWorkflowExecutable: async (
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"agentId">
  ): Promise<boolean> => {
    return true;
  },
};

// Invalid: Missing workspace parameter
const workflowCatalogNoWorkspace: WorkflowRoutingCatalog = {
  // @ts-expect-error Argument of type '(workflowId: EntityId<"workflowId">) => Promise<boolean>' is not assignable
  isWorkflowExecutable: async (workflowId: EntityId<"workflowId">): Promise<boolean> => {
    return true;
  },
};

// Invalid: Returns non-promise
const workflowCatalogSyncReturn: WorkflowRoutingCatalog = {
  // @ts-expect-error Type 'boolean' is not assignable to type 'Promise<boolean>'
  isWorkflowExecutable: (
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): boolean => {
    return true;
  },
};

// Export placeholder to avoid unused-variable warnings
export const typeTestsComplete = true;
