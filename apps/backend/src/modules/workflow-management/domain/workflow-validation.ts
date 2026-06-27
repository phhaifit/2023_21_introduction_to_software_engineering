import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import type { WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type AgentSummaryProvider = (
  workspaceId: EntityId<"workspaceId">,
  agentIds: EntityId<"agentId">[]
) => Promise<AgentPublicSummary[]>;

export class WorkflowValidationError extends Error {
  public readonly missingAgents: EntityId<"agentId">[];
  public readonly disabledAgents: EntityId<"agentId">[];

  constructor(
    missingAgents: EntityId<"agentId">[],
    disabledAgents: EntityId<"agentId">[]
  ) {
    super("Workflow validation failed: one or more agents are missing or disabled.");
    this.name = "WorkflowValidationError";
    this.missingAgents = missingAgents;
    this.disabledAgents = disabledAgents;
  }
}

export class WorkflowGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowGraphError";
  }
}

export function validateWorkflowDAG(steps: WorkflowStepDto[]): void {
  const stepMap = new Map<string, WorkflowStepDto>();
  for (const step of steps) {
    stepMap.set(step.workflowStepId, step);
  }

  // 1. Ensure all nextSteps point to valid existing steps
  for (const step of steps) {
    if (step.nextSteps) {
      for (const next of step.nextSteps) {
        if (!stepMap.has(next.targetStepId)) {
          throw new WorkflowGraphError(`Step ${step.workflowStepId} references non-existent target step ${next.targetStepId}`);
        }
      }
    }
  }

  // 2. Cycle detection using DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(stepId: string): boolean {
    if (recStack.has(stepId)) return true; // Cycle found
    if (visited.has(stepId)) return false;

    visited.add(stepId);
    recStack.add(stepId);

    const step = stepMap.get(stepId);
    if (step?.nextSteps) {
      for (const next of step.nextSteps) {
        if (dfs(next.targetStepId)) {
          return true;
        }
      }
    }

    recStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.workflowStepId)) {
      if (dfs(step.workflowStepId)) {
        throw new WorkflowGraphError("Workflow contains a cycle, which is not allowed.");
      }
    }
  }
}

export async function validateWorkflowAgents(
  workspaceId: EntityId<"workspaceId">,
  steps: WorkflowStepDto[],
  agentProvider: AgentSummaryProvider
): Promise<void> {
  const requiredAgentIds = [...new Set(steps.map((s) => s.agentId).filter((id): id is EntityId<"agentId"> => id !== null && id !== undefined))];
  
  if (requiredAgentIds.length === 0) {
    return;
  }

  const agents = await agentProvider(workspaceId, requiredAgentIds);
  const agentMap = new Map(agents.map((a) => [a.agentId, a]));

  const missingAgents: EntityId<"agentId">[] = [];
  const disabledAgents: EntityId<"agentId">[] = [];

  for (const agentId of requiredAgentIds) {
    const agent = agentMap.get(agentId);
    if (!agent) {
      missingAgents.push(agentId);
    } else if (agent.status === "disabled" || agent.status === "deleted") {
      disabledAgents.push(agentId);
    }
  }

  if (missingAgents.length > 0 || disabledAgents.length > 0) {
    throw new WorkflowValidationError(missingAgents, disabledAgents);
  }
}
