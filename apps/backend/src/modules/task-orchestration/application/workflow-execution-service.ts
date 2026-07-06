import type { EntityId, ExecuteWorkflowRequest, StartExecutionCommand, NormalizedRuntimeEvent } from "@vcp/shared";
import type { Workflow } from "../../workflow-management/domain/workflow.ts";
import type { WorkflowRepository } from "../../workflow-management/infrastructure/workflow-repository.ts";
import type { WorkflowExecutionHandoff, WorkflowMaterializationPort } from "../../workflow-management/application/workflow-use-cases.ts";
import type { EventBus } from "../../../shared/events/event-bus.ts";
import type { OpenClawExecutionOrchestrator } from "../../../features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import type {
  OpenClawMaterializedWorkflow,
  OpenClawWorkflowMaterializer,
  WorkflowStepAgentRef
} from "../../../features/task-execution/adapters/openclaw-workflow-materializer.ts";
import { randomUUID } from "crypto";

type ContainerWorkflowExecutionOptions = {
  workflow: Workflow;
  materializedWorkflow: OpenClawMaterializedWorkflow;
  initialInput: Record<string, unknown>;
  executionId: EntityId<"executionId">;
  triggeredBy: EntityId<"userId">;
  conversationId?: EntityId<"conversationId">;
  emitStepEvents?: boolean;
  createStepLogs?: boolean;
};

export class WorkflowExecutionService implements WorkflowExecutionHandoff, WorkflowMaterializationPort {
  private workflowRepo: WorkflowRepository;
  private orchestrator: OpenClawExecutionOrchestrator;
  private eventBus: EventBus;
  private workflowMaterializer: OpenClawWorkflowMaterializer;
  private autoRouteActiveWorkflows = new Map<
    string,
    {
      workflowId: EntityId<"workflowId">;
      executionId: EntityId<"executionId">;
      steps: import("../../workflow-management/domain/workflow.ts").WorkflowStep[];
      activeStepLogs: Map<string, EntityId<"logId">>;
      activeStepOutputs: Map<string, string>;
      currentActiveStepId: string | null;
    }
  >();

  constructor(
    workflowRepo: WorkflowRepository,
    orchestrator: OpenClawExecutionOrchestrator,
    eventBus: EventBus,
    workflowMaterializer: OpenClawWorkflowMaterializer
  ) {
    this.workflowRepo = workflowRepo;
    this.orchestrator = orchestrator;
    this.eventBus = eventBus;
    this.workflowMaterializer = workflowMaterializer;
  }

  async materializePublishedWorkflow(workflow: Workflow): Promise<void> {
    await this.materializeWorkflowOnContainer(workflow);
  }

  private async materializeWorkflowOnContainer(workflow: Workflow): Promise<OpenClawMaterializedWorkflow> {
    const agentRefs = await this.collectWorkflowAgentRefs(workflow);
    return this.workflowMaterializer.materializeWorkflow(workflow, agentRefs);
  }

  async handoffExecution(request: ExecuteWorkflowRequest): Promise<void> {
    console.log(`[WorkflowExecutionService] Received handoff executionId: ${request.executionId} for workflowId: ${request.workflowId}`);
    const workflow = await this.workflowRepo.findById(request.workspaceId, request.workflowId);

    if (!workflow) {
      throw new Error("Workflow not found during handoff");
    }

    await this.eventBus.publish({
      name: "workflow.execution_started",
      eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
      occurredAt: new Date().toISOString(),
      payload: {
        workspaceId: request.workspaceId,
        workflowId: request.workflowId,
        executionId: request.executionId!
      }
    });

    try {
      await this.workflowRepo.updateExecutionStatus(
        request.workspaceId,
        request.executionId!,
        "Running"
      );

      const materializedWorkflow = await this.materializeWorkflowOnContainer(workflow);
      await this.runContainerWorkflowExecution({
        workflow,
        materializedWorkflow,
        initialInput: request.inputData ?? {},
        executionId: request.executionId!,
        triggeredBy: request.triggeredBy,
        emitStepEvents: true,
        createStepLogs: true
      });

      await this.workflowRepo.updateExecutionStatus(
        request.workspaceId,
        request.executionId!,
        "Success",
        new Date().toISOString()
      );

      await this.eventBus.publish({
        name: "workflow.execution_completed",
        eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
        occurredAt: new Date().toISOString(),
        payload: {
          workspaceId: request.workspaceId,
          workflowId: request.workflowId,
          executionId: request.executionId!
        }
      });
    } catch (error: any) {
      console.error("[WorkflowExecutionService] Execution failed:", error);
      await this.workflowRepo.updateExecutionStatus(
        request.workspaceId,
        request.executionId!,
        "Failed",
        new Date().toISOString()
      );

      await this.eventBus.publish({
        name: "workflow.execution_failed",
        eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
        occurredAt: new Date().toISOString(),
        payload: {
          workspaceId: request.workspaceId,
          workflowId: request.workflowId,
          executionId: request.executionId!,
          errorMsg: error.message
        }
      });
    }
  }

  async executeWorkflowFromChat(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">,
    initialInput: Record<string, string>,
    executionId: EntityId<"executionId">,
    triggeredBy: EntityId<"userId">,
    convId: EntityId<"conversationId">
  ): Promise<string | null> {
    const workflow = await this.workflowRepo.findById(workspaceId, workflowId);
    if (!workflow) {
      throw new Error("Workflow not found during chat execution");
    }

    await this.workflowRepo.createExecution({
      executionId,
      workspaceId,
      workflowId,
      status: "Running",
      triggeredBy,
      startedAt: new Date().toISOString(),
      completedAt: null
    });

    await this.eventBus.publish({
      name: "workflow.execution_started",
      eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
      occurredAt: new Date().toISOString(),
      payload: { workspaceId, workflowId, executionId }
    });

    try {
      const materializedWorkflow = await this.materializeWorkflowOnContainer(workflow);
      const finalOutput = await this.runContainerWorkflowExecution({
        workflow,
        materializedWorkflow,
        initialInput,
        executionId,
        triggeredBy,
        conversationId: convId,
        emitStepEvents: true,
        createStepLogs: true
      });

      await this.workflowRepo.updateExecutionStatus(workspaceId, executionId, "Success", new Date().toISOString());
      await this.eventBus.publish({
        name: "workflow.execution_completed",
        eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
        occurredAt: new Date().toISOString(),
        payload: { workspaceId, workflowId, executionId }
      });

      return finalOutput;
    } catch (error: any) {
      console.error("[executeWorkflowFromChat Error]:", error);
      await this.workflowRepo.updateExecutionStatus(workspaceId, executionId, "Failed", new Date().toISOString());
      await this.eventBus.publish({
        name: "workflow.execution_failed",
        eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
        occurredAt: new Date().toISOString(),
        payload: { workspaceId, workflowId, executionId, errorMsg: error.message }
      });
      throw error;
    }
  }

  private async runContainerWorkflowExecution(options: ContainerWorkflowExecutionOptions): Promise<string> {
    const {
      workflow,
      materializedWorkflow,
      initialInput,
      executionId,
      triggeredBy,
      conversationId,
      emitStepEvents = false,
      createStepLogs = false
    } = options;

    const steps = materializedWorkflow.steps;
    if (steps.length === 0) {
      return "Workflow completed successfully.";
    }

    const taskId = `task_${randomUUID()}` as EntityId<"taskId">;
    const stepPrompt = buildStepPrompt(initialInput);
    
    const command: StartExecutionCommand = {
      taskId,
      workId: executionId as string as EntityId<"workId">,
      workspaceId: workflow.workspaceId,
      conversationId: (conversationId ?? `conv_${randomUUID()}`) as EntityId<"conversationId">,
      prompt: stepPrompt,
      routing: {
        mode: "predefined-workflow",
        workflowId: workflow.workflowId
      },
      routingPresentation: "container-backed",
      workflowStepContext: {
        workflowId: workflow.workflowId,
        stepOrder: 1,
        providerWorkflowMapping: materializedWorkflow.providerWorkflowMapping
      }
    };

    const activeStepLogs = new Map<string, EntityId<"logId">>();
    const activeStepOutputs = new Map<string, string>();
    let currentActiveStepId: string | null = null;

    const handleEvent = async (event: NormalizedRuntimeEvent) => {
      try {
        // Safe cast event.stepId because NormalizedRuntimeEvent union types do not all expose stepId.
        // This ensures the TypeScript compiler passes typecheck when streaming events from OpenClaw.
        const eventStepId = (event as any).stepId as string | undefined;
        console.log(`[WorkflowExecutionService] 🔔 Received OpenClaw event: type=${event.type}, stepId=${eventStepId || 'none'}, stepName=${(event as any).stepName || 'none'}`);
        const matchingStep = materializedWorkflow.steps.find(
          (s) =>
            s.workflowStepId === eventStepId ||
            `step-${s.stepOrder}` === eventStepId ||
            `step_${s.stepOrder}` === eventStepId ||
            String(s.stepOrder) === eventStepId
        ) || materializedWorkflow.steps[0];

        const realStepId = matchingStep?.workflowStepId as EntityId<"workflowStepId">;
        if (!realStepId) return;

        if (event.type === "step-started") {
          currentActiveStepId = eventStepId ?? null;
          if (eventStepId) {
            activeStepOutputs.set(eventStepId, "");
            const logId = `wfsl_${randomUUID()}` as EntityId<"logId">;
            activeStepLogs.set(eventStepId, logId);
          }

          if (createStepLogs) {
            await this.workflowRepo.createStepLog({
              logId: eventStepId ? activeStepLogs.get(eventStepId)! : (`wfsl_${randomUUID()}` as EntityId<"logId">),
              workspaceId: workflow.workspaceId,
              executionId,
              workflowStepId: realStepId,
              status: "Running",
              inputData: { stepName: (event as any).stepName },
              startedAt: new Date().toISOString()
            });
          }

          if (emitStepEvents) {
            await this.eventBus.publish({
              name: "workflow.step_started",
              eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
              occurredAt: new Date().toISOString(),
              payload: {
                workspaceId: workflow.workspaceId,
                workflowId: workflow.workflowId,
                executionId,
                workflowStepId: realStepId,
                stepOrder: matchingStep.stepOrder,
                agentId: matchingStep.agentId as EntityId<"agentId"> | undefined
              }
            });
          }
        } else if (event.type === "partial-output-received") {
          const stepIdToAppend = eventStepId || currentActiveStepId;
          if (stepIdToAppend) {
            const currentText = activeStepOutputs.get(stepIdToAppend) || "";
            activeStepOutputs.set(stepIdToAppend, currentText + ((event as any).outputChunk || ""));
          }
        } else if (event.type === "step-completed") {
          if (eventStepId) {
            const logId = activeStepLogs.get(eventStepId);
            if (logId) {
              const rawOutput = activeStepOutputs.get(eventStepId) || "";
              const stepOutput = rawOutput.trim() || (event as any).result || "Completed";

              if (createStepLogs) {
                await this.workflowRepo.updateStepLog(
                  logId,
                  "Success",
                  { text: stepOutput },
                  undefined,
                  new Date().toISOString()
                );
              }

              if (emitStepEvents) {
                await this.eventBus.publish({
                  name: "workflow.step_completed",
                  eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
                  occurredAt: new Date().toISOString(),
                  payload: {
                    workspaceId: workflow.workspaceId,
                    workflowId: workflow.workflowId,
                    executionId,
                    workflowStepId: realStepId,
                    stepOrder: matchingStep.stepOrder,
                    agentId: matchingStep.agentId as EntityId<"agentId"> | undefined,
                    outputData: { text: stepOutput }
                  }
                });
              }
            }
            if (currentActiveStepId === eventStepId) {
              currentActiveStepId = null;
            }
          }
        }
      } catch (err) {
        console.error("[WorkflowExecutionService] Error handling runtime event:", err);
      }
    };

    this.orchestrator.adapter.subscribe(taskId, handleEvent);

    try {
      const context = {
        principalId: triggeredBy as string,
        roles: ["workspace-admin"],
        permissions: ["start-task-execution"]
      };

      const result = await this.orchestrator.execute10StepStartFlow(context, command);
      if (result.status === "failed") {
        throw new Error("Workflow start execution failed in OpenClaw");
      }

      const stepTimeoutMs = getWorkflowStepTimeoutMs();
      const finalOutput = await this.waitForTaskOutput(taskId, workflow.workspaceId, stepTimeoutMs);

      return finalOutput;
    } finally {
      this.orchestrator.adapter.unsubscribe(taskId, handleEvent);
    }
  }

  private async waitForTaskOutput(
    taskId: EntityId<"taskId">,
    workspaceId: EntityId<"workspaceId">,
    timeoutMs: number
  ): Promise<string> {
    const maxAttempts = Math.ceil(timeoutMs / 500);
    let state = await this.orchestrator.getExposedState(taskId);
    let attempts = 0;

    while (state.status === "pending" || state.status === "in-progress") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      state = await this.orchestrator.getExposedState(taskId);
      attempts++;
      if (attempts > maxAttempts) break;
    }

    if (state.status === "completed") {
      const completedEvent = state.events.find((event) => event.type === "execution-completed") as
        | { finalOutput?: string }
        | undefined;
      if (completedEvent?.finalOutput) {
        return completedEvent.finalOutput;
      }

      const chunks = state.events
        .filter((event) => event.type === "partial-output-received")
        .map((event: any) => event.outputChunk);
      if (chunks.length > 0) {
        return chunks.join("");
      }

      return `Result from task ${taskId}`;
    }

    try {
      await this.orchestrator.forwardCancellation({}, taskId, workspaceId);
    } catch {
      // Ignore cancel errors to preserve original failure trace.
    }

    throw new Error(`Task did not complete successfully. Final status: ${state.status}`);
  }

  private async collectWorkflowAgentRefs(workflow: Workflow): Promise<Map<string, WorkflowStepAgentRef>> {
    const refs = new Map<string, WorkflowStepAgentRef>();

    for (const step of workflow.steps ?? []) {
      if (step.stepType !== "agent" || !step.agentId || refs.has(step.agentId as string)) {
        continue;
      }

      const agent = await this.orchestrator.agentCatalog.validateAndGetAgent(
        workflow.workspaceId,
        step.agentId as string
      );

      refs.set(step.agentId as string, {
        agentId: step.agentId as string,
        openClawAgentId: agent.openClawAgentId,
        providerAgentMapping: agent.providerAgentMapping
      });
    }

    return refs;
  }

  /**
   * Tracks and records logs dynamically for auto-routed workflows executing on OpenClaw.
   * Resolves the matching workflow in the workspace based on the incoming step ID.
   * Maps progress events directly to WorkflowExecution and WorkflowStepLog records.
   */
  async handleAutoRoutedWorkflowEvent(
    taskId: EntityId<"taskId">,
    workspaceId: EntityId<"workspaceId">,
    triggeredBy: EntityId<"userId">,
    event: NormalizedRuntimeEvent
  ): Promise<void> {
    const taskIdStr = taskId as string;
    const eventStepId = (event as any).stepId as string | undefined;
    console.log(`[WorkflowExecutionService] 🛡️ handleAutoRoutedWorkflowEvent: taskId=${taskIdStr}, eventType=${event.type}, eventStepId=${eventStepId || 'none'}`);

    // 1. Auto detect workflow if not already tracked
    let active = this.autoRouteActiveWorkflows.get(taskIdStr);
    
    if (!active && eventStepId) {
      const { items: workflows } = await this.workflowRepo.listByWorkspace(workspaceId);
      console.log(`[WorkflowExecutionService] AutoRoute detection: found ${workflows.length} workflows in workspace ${workspaceId}`);
      for (const wf of workflows) {
        const matchingStep = wf.steps.find(
          (s) =>
            s.workflowStepId === eventStepId ||
            `step-${s.stepOrder}` === eventStepId ||
            `step_${s.stepOrder}` === eventStepId ||
            String(s.stepOrder) === eventStepId
        );
        if (matchingStep) {
          console.log(`[WorkflowExecutionService] AutoRoute detection SUCCESS: resolved workflowId=${wf.workflowId} via matchingStep=${matchingStep.workflowStepId}`);
          const executionId = `wfe_${taskId}` as EntityId<"executionId">;
          active = {
            workflowId: wf.workflowId,
            executionId,
            steps: wf.steps,
            activeStepLogs: new Map(),
            activeStepOutputs: new Map(),
            currentActiveStepId: null
          };
          this.autoRouteActiveWorkflows.set(taskIdStr, active);

          // Create WorkflowExecution record
          await this.workflowRepo.createExecution({
            executionId,
            workspaceId,
            workflowId: wf.workflowId,
            status: "Running",
            triggeredBy,
            startedAt: new Date().toISOString(),
            completedAt: null
          });

          // Publish workflow.execution_started event
          await this.eventBus.publish({
            name: "workflow.execution_started",
            eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
            occurredAt: new Date().toISOString(),
            payload: { workspaceId, workflowId: wf.workflowId, executionId }
          });
          break;
        }
      }
    }

    if (!active) {
      return;
    }

    const { executionId, steps, activeStepLogs, activeStepOutputs } = active;

    try {
      const matchingStep = steps.find(
        (s) =>
          s.workflowStepId === eventStepId ||
          `step-${s.stepOrder}` === eventStepId ||
          `step_${s.stepOrder}` === eventStepId ||
          String(s.stepOrder) === eventStepId
      );

      const realStepId = matchingStep?.workflowStepId;

      if (event.type === "step-started") {
        active.currentActiveStepId = eventStepId ?? null;
        if (eventStepId) {
          activeStepOutputs.set(eventStepId, "");
          const logId = `wfsl_${randomUUID()}` as EntityId<"logId">;
          activeStepLogs.set(eventStepId, logId);

          if (realStepId) {
            await this.workflowRepo.createStepLog({
              logId,
              workspaceId,
              executionId,
              workflowStepId: realStepId,
              status: "Running",
              inputData: { stepName: (event as any).stepName },
              startedAt: new Date().toISOString()
            });

            await this.eventBus.publish({
              name: "workflow.step_started",
              eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
              occurredAt: new Date().toISOString(),
              payload: {
                workspaceId,
                workflowId: active.workflowId,
                executionId,
                workflowStepId: realStepId,
                stepOrder: matchingStep.stepOrder,
                agentId: matchingStep.agentId ?? undefined
              }
            });
          }
        }
      } else if (event.type === "partial-output-received") {
        const stepIdToAppend = eventStepId || active.currentActiveStepId;
        if (stepIdToAppend) {
          const currentText = activeStepOutputs.get(stepIdToAppend) || "";
          activeStepOutputs.set(stepIdToAppend, currentText + ((event as any).outputChunk || ""));
        }
      } else if (event.type === "step-completed") {
        if (eventStepId && realStepId) {
          const logId = activeStepLogs.get(eventStepId);
          if (logId) {
            const rawOutput = activeStepOutputs.get(eventStepId) || "";
            const stepOutput = rawOutput.trim() || (event as any).result || "Completed";

            await this.workflowRepo.updateStepLog(
              logId,
              "Success",
              { text: stepOutput },
              undefined,
              new Date().toISOString()
            );

            await this.eventBus.publish({
              name: "workflow.step_completed",
              eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
              occurredAt: new Date().toISOString(),
              payload: {
                workspaceId,
                workflowId: active.workflowId,
                executionId,
                workflowStepId: realStepId,
                stepOrder: matchingStep.stepOrder,
                agentId: matchingStep.agentId ?? undefined,
                outputData: { text: stepOutput }
              }
            });
          }
          if (active.currentActiveStepId === eventStepId) {
            active.currentActiveStepId = null;
          }
        }
      } else if (event.type === "execution-completed") {
        await this.workflowRepo.updateExecutionStatus(workspaceId, executionId, "Success", new Date().toISOString());
        await this.eventBus.publish({
          name: "workflow.execution_completed",
          eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
          occurredAt: new Date().toISOString(),
          payload: { workspaceId, workflowId: active.workflowId, executionId }
        });
        this.autoRouteActiveWorkflows.delete(taskIdStr);
      } else if (event.type === "execution-failed" || event.type === "execution-canceled") {
        const errorMsg = (event as any).error?.message || "Execution stopped";
        await this.workflowRepo.updateExecutionStatus(workspaceId, executionId, "Failed", new Date().toISOString());
        await this.eventBus.publish({
          name: "workflow.execution_failed",
          eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
          occurredAt: new Date().toISOString(),
          payload: { workspaceId, workflowId: active.workflowId, executionId, errorMsg }
        });
        this.autoRouteActiveWorkflows.delete(taskIdStr);
      }
    } catch (err) {
      console.error("[WorkflowExecutionService] Error handling auto-routed workflow event:", err);
    }
  }
}

export function buildStepPrompt(inputs: Record<string, unknown>): string {
  if (typeof inputs.prompt === "string" && inputs.prompt.trim()) {
    return inputs.prompt;
  }

  const serialized = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");

  return serialized || "Continue with the workflow step using the provided context.";
}


function getWorkflowStepTimeoutMs(): number {
  return process.env.WORKFLOW_STEP_TIMEOUT_MS
    ? parseInt(process.env.WORKFLOW_STEP_TIMEOUT_MS, 10)
    : 60000;
}
