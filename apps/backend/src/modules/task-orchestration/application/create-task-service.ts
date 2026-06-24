import type { CreateTaskResponse } from "@vcp/shared";
import { createTask, TaskValidationError } from "../domain/task.ts";
import { createInitialTaskWork } from "../domain/task-work.ts";
import { createTaskSubmittedEvent } from "../domain/task-events.ts";
import { parseTaskRoutingSelection } from "../domain/routing-validation.ts";
import type { CreateTaskCommand } from "./create-task-command.ts";
import type { CreateTaskUseCase } from "./create-task-use-case.ts";
import { CreateTaskError } from "./create-task-error.ts";
import type {
  TaskIdentityGenerator,
  TaskClock,
  AgentRoutingCatalog,
  WorkflowRoutingCatalog,
  TaskEventIdentityGenerator
} from "./ports.ts";
import type { TaskRepository } from "./task-repository.ts";
import type { TaskWorkRepository } from "./task-work-repository.ts";
import type { TaskEventPublisher } from "./task-event-publisher.ts";

export class CreateTaskService implements CreateTaskUseCase {
  private readonly identityGenerator: TaskIdentityGenerator;
  private readonly clock: TaskClock;
  private readonly eventIdentityGenerator: TaskEventIdentityGenerator;
  private readonly agentRoutingCatalog: AgentRoutingCatalog;
  private readonly workflowRoutingCatalog: WorkflowRoutingCatalog;
  private readonly taskRepository: TaskRepository;
  private readonly taskWorkRepository: TaskWorkRepository;
  private readonly eventPublisher: TaskEventPublisher;

  constructor(
    identityGenerator: TaskIdentityGenerator,
    clock: TaskClock,
    eventIdentityGenerator: TaskEventIdentityGenerator,
    agentRoutingCatalog: AgentRoutingCatalog,
    workflowRoutingCatalog: WorkflowRoutingCatalog,
    taskRepository: TaskRepository,
    taskWorkRepository: TaskWorkRepository,
    eventPublisher: TaskEventPublisher
  ) {
    this.identityGenerator = identityGenerator;
    this.clock = clock;
    this.eventIdentityGenerator = eventIdentityGenerator;
    this.agentRoutingCatalog = agentRoutingCatalog;
    this.workflowRoutingCatalog = workflowRoutingCatalog;
    this.taskRepository = taskRepository;
    this.taskWorkRepository = taskWorkRepository;
    this.eventPublisher = eventPublisher;
  }

  async execute(command: CreateTaskCommand): Promise<CreateTaskResponse> {
    const prompt = parseTaskPrompt(command.prompt);
    const requestedRouting = parseTaskRoutingSelection(command.routing);

    if (requestedRouting.mode === "specific-agent") {
      const isSelectable = await this.agentRoutingCatalog.isAgentSelectable(
        command.workspaceId,
        requestedRouting.agentId
      );
      if (!isSelectable) {
        throw new CreateTaskError({
          errorType: "invalid-agent-target",
          workspaceId: command.workspaceId,
          targetId: requestedRouting.agentId
        });
      }
    } else if (requestedRouting.mode === "predefined-workflow") {
      const isExecutable = await this.workflowRoutingCatalog.isWorkflowExecutable(
        command.workspaceId,
        requestedRouting.workflowId
      );
      if (!isExecutable) {
        throw new CreateTaskError({
          errorType: "invalid-workflow-target",
          workspaceId: command.workspaceId,
          targetId: requestedRouting.workflowId
        });
      }
    }

    const taskId = this.identityGenerator.nextTaskId();
    const workId = this.identityGenerator.nextWorkId();
    const createdAt = this.clock.now();

    const task = createTask({
      taskId,
      workspaceId: command.workspaceId,
      submittedByUserId: command.submittedByUserId,
      prompt,
      routing: requestedRouting,
      createdAt,
      updatedAt: createdAt
    });

    const taskWork = createInitialTaskWork({
      workId,
      taskId,
      workspaceId: command.workspaceId,
      createdAt,
      updatedAt: createdAt
    });

    await this.taskRepository.save(command.workspaceId, task);
    await this.taskWorkRepository.save(command.workspaceId, taskWork);

    const event = createTaskSubmittedEvent({
      eventId: this.eventIdentityGenerator.nextEventId(),
      occurredAt: createdAt,
      workspaceId: command.workspaceId,
      taskId,
      workId,
      attemptNumber: 1,
      requestedRouting: task.requestedRouting
    });
    await this.eventPublisher.publish(event);

    return {
      taskId,
      workId,
      status: "queued",
      createdAt
    };
  }
}

function parseTaskPrompt(value: unknown): string {
  if (typeof value !== "string") {
    throw new TaskValidationError(["prompt must be a string"]);
  }

  const prompt = value.trim();
  if (prompt.length === 0) {
    throw new TaskValidationError(["prompt must not be empty or whitespace-only"]);
  }

  return prompt;
}

