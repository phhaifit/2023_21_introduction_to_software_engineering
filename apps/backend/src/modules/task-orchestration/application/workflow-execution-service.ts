import type { EntityId, ExecuteWorkflowRequest, StartExecutionCommand } from "@vcp/shared";
import type { WorkflowRepository } from "../../workflow-management/infrastructure/workflow-repository.ts";
import type { WorkflowExecutionHandoff } from "../../workflow-management/application/workflow-use-cases.ts";
import type { EventBus } from "../../../shared/events/event-bus.ts";
import type { OpenClawExecutionOrchestrator } from "../../../features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import { randomUUID } from "crypto";

export class WorkflowExecutionService implements WorkflowExecutionHandoff {
  private workflowRepo: WorkflowRepository;
  private orchestrator: OpenClawExecutionOrchestrator;
  private eventBus: EventBus;

  constructor(
    workflowRepo: WorkflowRepository,
    orchestrator: OpenClawExecutionOrchestrator,
    eventBus: EventBus
  ) {
    this.workflowRepo = workflowRepo;
    this.orchestrator = orchestrator;
    this.eventBus = eventBus;
  }

  // Implementation of Handoff interface
  async handoffExecution(request: ExecuteWorkflowRequest): Promise<void> {
    console.log(`[WorkflowExecutionService] Received handoff executionId: ${request.executionId} for workflowId: ${request.workflowId}`);
    const workflow = await this.workflowRepo.findById(request.workspaceId, request.workflowId);
    
    if (!workflow) {
      throw new Error("Workflow not found during handoff");
    }

    // Emit workflow started
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
      await this.executeDAG(workflow, request.inputData, request.executionId!, request.triggeredBy);
      
      // Update execution status
      await this.workflowRepo.updateExecutionStatus(request.workspaceId, request.executionId!, "Success", new Date().toISOString());
      
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
      await this.workflowRepo.updateExecutionStatus(request.workspaceId, request.executionId!, "Failed", new Date().toISOString());
      
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

  // Parses template string like {{ step_1.output }} and replaces it with actual output data
  parseInputMapping(mapping: Record<string, string>, previousOutputs: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === "string") {
        result[key] = value.replace(/\{\{\s*(step_[a-zA-Z0-9_-]+)\.output\s*\}\}/g, (match, stepId) => {
          return previousOutputs[stepId] !== undefined ? String(previousOutputs[stepId]) : match;
        });
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // Evaluates a condition like "result.status === 'success'" or basic string comparisons
  evaluateCondition(condition: string, outputData: any): boolean {
    if (!condition || condition.trim() === "") return true;
    const cond = condition.trim();
    if (cond === "true") return true;
    if (cond === "false") return false;

    try {
      let outputObj = outputData;
      if (typeof outputData === "string") {
        try {
          outputObj = JSON.parse(outputData);
        } catch {
          // Keep as string if not JSON
        }
      }

      // Safe evaluation with custom scope parameters: 'output' and 'result'
      const evaluator = new Function("output", "result", `
        try {
          return !!(${cond});
        } catch (e) {
          return false;
        }
      `);

      return evaluator(outputObj, outputObj);
    } catch (e) {
      console.warn("Failed to evaluate condition:", condition, e);
      return true; // Fallback to true on error so workflow doesn't lock up
    }
  }

  // Execute a workflow via BFS (DAG traversal)
  async executeDAG(workflow: any, initialInput: any, executionId: EntityId<"executionId">, triggeredBy: EntityId<"userId">, convId?: string): Promise<void> {
    const steps = workflow.steps;
    if (!steps || steps.length === 0) return;

    // Find start nodes (nodes with in-degree 0)
    const inDegrees = new Map<string, number>();
    for (const step of steps) {
      inDegrees.set(step.workflowStepId, 0);
    }
    for (const step of steps) {
      if (step.nextSteps) {
        for (const next of step.nextSteps) {
          inDegrees.set(next.targetStepId, (inDegrees.get(next.targetStepId) || 0) + 1);
        }
      }
    }

    const queue: any[] = [];
    for (const [stepId, degree] of inDegrees.entries()) {
      if (degree === 0) {
        queue.push(steps.find((s: any) => s.workflowStepId === stepId));
      }
    }

    const completedOutputs: Record<string, any> = { initial: initialInput };

    // BFS execution (Simulated synchronous execution for now)
    while (queue.length > 0) {
      const currentLayer = [...queue];
      queue.length = 0;

      await Promise.all(currentLayer.map(async (step) => {
        const inputs = step.inputMapping 
          ? this.parseInputMapping(step.inputMapping, completedOutputs)
          : (initialInput || {});

        const logId = `wfsl_${randomUUID()}` as EntityId<"logId">;
        await this.workflowRepo.createStepLog({
          logId,
          workspaceId: workflow.workspaceId,
          executionId,
          workflowStepId: step.workflowStepId,
          status: "Running",
          inputData: inputs,
          startedAt: new Date().toISOString()
        });

        await this.eventBus.publish({
          name: "workflow.step_started",
          eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
          occurredAt: new Date().toISOString(),
          payload: {
            workspaceId: workflow.workspaceId,
            workflowId: workflow.workflowId,
            executionId,
            workflowStepId: step.workflowStepId,
            stepOrder: step.stepOrder,
            agentId: step.agentId
          }
        });

        let outputData = null;

        try {
          if (step.stepType === "approval") {
            console.log(`[WorkflowExecutor] Step ${step.workflowStepId} is WAITING_APPROVAL`);
            outputData = "APPROVED"; 
          } else {
            console.log(`[WorkflowExecutor] Agent ${step.agentId} processing via OpenClaw...`);
            
            // Map to StartExecutionCommand
            const command: StartExecutionCommand = {
              taskId: `task_${randomUUID()}` as EntityId<"taskId">,
              workId: executionId as string as EntityId<"workId">,
              workspaceId: workflow.workspaceId,
              conversationId: `conv_${randomUUID()}` as EntityId<"conversationId">,
              prompt: inputs.prompt || JSON.stringify(inputs),
              routing: {
                mode: "specific-agent",
                agentId: step.agentId
              }
            };
            
            const context = {
              principalId: triggeredBy as string,
              roles: ["workspace-admin"], // TODO: wire workflow execution auth context.
              permissions: ["start-task-execution"]
            };

            const result = await this.orchestrator.execute10StepStartFlow(context, command);
            if (result.status === "failed") {
              throw new Error("Task execution failed in OpenClaw");
            }
            
            // For now, OpenClaw execution adapter may just complete it or we wait for state.
            // But since this is a pseudo-sync DAG engine running locally, let's poll or assume it completes.
            // We can just fetch exposed state.
            const timeoutMs = process.env.WORKFLOW_STEP_TIMEOUT_MS
              ? parseInt(process.env.WORKFLOW_STEP_TIMEOUT_MS, 10)
              : 30000; // Default to 30 seconds if not configured
            const maxAttempts = Math.ceil(timeoutMs / 500);

            let state = await this.orchestrator.getExposedState(command.taskId);
            let attempts = 0;
            while(state.status === "pending" || state.status === "in-progress") {
              await new Promise(r => setTimeout(r, 500));
              state = await this.orchestrator.getExposedState(command.taskId);
              attempts++;
              if (attempts > maxAttempts) break;
            }
            
            if (state.status === "completed") {
              const completedEvent = state.events.find(e => e.type === "execution-completed") as any;
              if (completedEvent && completedEvent.finalOutput) {
                outputData = completedEvent.finalOutput;
              } else {
                const chunks = state.events
                  .filter(e => e.type === "partial-output-received")
                  .map((e: any) => e.outputChunk);
                if (chunks.length > 0) {
                  outputData = chunks.join("");
                } else {
                  outputData = `Result from Agent ${step.agentId} (Task ${command.taskId})`;
                }
              }
            } else {
              // Clean up resources: automatically cancel the stuck task execution on the gateway
              try {
                await this.orchestrator.forwardCancellation({}, command.taskId, workflow.workspaceId);
              } catch (cancelErr) {
                // Ignore cancel errors to preserve original failure trace
              }
              throw new Error(`Task did not complete successfully. Final status: ${state.status}`);
            }
          }

          completedOutputs[step.workflowStepId] = outputData;

          // Append message of the finished agent into conversation if it runs from chat
          if (convId && this.orchestrator.conversationRepository) {
            try {
              const agentProfile = await this.orchestrator.agentCatalog.validateAndGetAgent(workflow.workspaceId, step.agentId);
              const agentName = agentProfile?.name || `Agent ${step.agentId}`;
              await this.orchestrator.conversationRepository.appendMessage(convId, {
                messageId: `msg_${randomUUID()}`,
                conversationId: convId,
                role: "assistant",
                content: `### [Agent: ${agentName}]\n\n${outputData}`,
                timestamp: new Date().toISOString()
              });
            } catch (chatErr) {
              console.error("[WorkflowExecutionService] Error appending agent output message:", chatErr);
            }
          }

          await this.workflowRepo.updateStepLog(logId, "Success", outputData, undefined, new Date().toISOString());

          await this.eventBus.publish({
            name: "workflow.step_completed",
            eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
            occurredAt: new Date().toISOString(),
            payload: {
              workspaceId: workflow.workspaceId,
              workflowId: workflow.workflowId,
              executionId,
              workflowStepId: step.workflowStepId,
              stepOrder: step.stepOrder,
              agentId: step.agentId,
              outputData
            }
          });

          if (step.nextSteps) {
            for (const next of step.nextSteps) {
              const isConditionMet = this.evaluateCondition(next.condition, outputData);
              if (isConditionMet) {
                const nextStep = steps.find((s: any) => s.workflowStepId === next.targetStepId);
                if (nextStep && !queue.includes(nextStep)) {
                  queue.push(nextStep);
                }
              }
            }
          }
        } catch (err: any) {
          await this.workflowRepo.updateStepLog(logId, "Failed", null, err.message, new Date().toISOString());
          await this.eventBus.publish({
            name: "workflow.step_failed",
            eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
            occurredAt: new Date().toISOString(),
            payload: {
              workspaceId: workflow.workspaceId,
              workflowId: workflow.workflowId,
              executionId,
              workflowStepId: step.workflowStepId,
              stepOrder: step.stepOrder,
              agentId: step.agentId,
              errorMsg: err.message
            }
          });
          throw err; // Stop workflow on step failure
        }
      }));
    }

    console.log("[WorkflowExecutor] Workflow completed successfully. Outputs:", completedOutputs);
  }

  // Triggered when running a workflow from the Chat interface
  async executeDAGFromChat(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">,
    initialInput: Record<string, string>,
    executionId: string,
    triggeredBy: string,
    taskId: EntityId<"taskId">,
    convId: string
  ): Promise<string | null> {
    const workflow = await this.workflowRepo.findById(workspaceId, workflowId);
    if (!workflow) {
      throw new Error("Workflow not found during chat execution");
    }

    // 1. Emit workflow execution started event
    await this.eventBus.publish({
      name: "workflow.execution_started",
      eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
      occurredAt: new Date().toISOString(),
      payload: {
        workspaceId,
        workflowId,
        executionId
      }
    });

    const steps = workflow.steps || [];

    try {
      // 2. Execute the DAG with convId so steps append messages
      await this.executeDAG(workflow, initialInput, executionId as any, triggeredBy as any, convId);

      // 3. Update status in repo
      await this.workflowRepo.updateExecutionStatus(workspaceId, executionId, "Success", new Date().toISOString());

      // 4. Emit completed event
      await this.eventBus.publish({
        name: "workflow.execution_completed",
        eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
        occurredAt: new Date().toISOString(),
        payload: {
          workspaceId,
          workflowId,
          executionId
        }
      });

      // 5. Find the final step's output to return as the final answer
      if (steps.length > 0) {
        let maxOrderStep = steps[0];
        for (const s of steps) {
          if (s.stepOrder > maxOrderStep.stepOrder) {
            maxOrderStep = s;
          }
        }
        const finalStepId = maxOrderStep.workflowStepId;
        const dbLogs = await this.workflowRepo.findStepLogs(workspaceId, executionId);
        const finalLog = dbLogs.find(l => l.workflowStepId === finalStepId && l.status === "Success");
        if (finalLog) {
          return finalLog.outputData;
        }
        
        const successfulLogs = dbLogs.filter(l => l.status === "Success");
        if (successfulLogs.length > 0) {
          return successfulLogs[successfulLogs.length - 1].outputData;
        }
      }

      return "Workflow completed successfully.";
    } catch (error: any) {
      console.error("[executeDAGFromChat Error]:", error);
      await this.workflowRepo.updateExecutionStatus(workspaceId, executionId, "Failed", new Date().toISOString());
      await this.eventBus.publish({
        name: "workflow.execution_failed",
        eventId: `evt_${randomUUID()}` as EntityId<"eventId">,
        occurredAt: new Date().toISOString(),
        payload: {
          workspaceId,
          workflowId,
          executionId,
          errorMsg: error.message
        }
      });
      throw error;
    }
  }
}
