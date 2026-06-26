import type { EntityId, ExecuteWorkflowRequest } from "@vcp/shared";
import type { TaskRepository } from "./task-repository.ts";
import type { TaskWorkRepository } from "./task-work-repository.ts";
import type { WorkflowExecutionHandoff } from "../../workflow-management/application/workflow-use-cases.ts";

export class WorkflowExecutionService implements WorkflowExecutionHandoff {
  // private taskRepository: TaskRepository;
  // private taskWorkRepository: TaskWorkRepository;

  constructor() {
    // this.taskRepository = taskRepository;
    // this.taskWorkRepository = taskWorkRepository;
  }

  // Implementation of Handoff interface
  async handoffExecution(request: ExecuteWorkflowRequest): Promise<void> {
    console.log("[WorkflowExecutionService] Received handoff:", request.workflowId);
    // Fetch workflow and start execution DAG. Since this service doesn't have the workflow repository, 
    // it's just a placeholder for now, or it will require it in constructor.
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

  // Evaluates a condition like "result.status === 'success'"
  evaluateCondition(condition: string, outputData: any): boolean {
    if (!condition || condition.trim() === "") return true;
    try {
      if (condition === "true") return true;
      if (condition === "false") return false;
      return true; // Fallback
    } catch (e) {
      console.warn("Failed to evaluate condition:", condition, e);
      return false;
    }
  }

  // Execute a workflow via BFS (DAG traversal)
  async executeDAG(workflow: any, initialInput: any): Promise<void> {
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
          : {};

        console.log(`[WorkflowExecutor] Executing Step: ${step.workflowStepId} (${step.stepType}) with inputs:`, inputs);

        let outputData = null;

        if (step.stepType === "approval") {
          console.log(`[WorkflowExecutor] Step ${step.workflowStepId} is WAITING_APPROVAL`);
          outputData = "APPROVED"; 
        } else {
          console.log(`[WorkflowExecutor] Agent ${step.agentId} processing...`);
          outputData = `Result from Agent ${step.agentId}`;
        }

        completedOutputs[step.workflowStepId] = outputData;

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
      }));
    }

    console.log("[WorkflowExecutor] Workflow completed successfully. Outputs:", completedOutputs);
  }
}
