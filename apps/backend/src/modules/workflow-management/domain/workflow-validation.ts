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

export async function validateWorkflowAgents(
  workspaceId: EntityId<"workspaceId">,
  steps: WorkflowStepDto[],
  agentProvider: AgentSummaryProvider
): Promise<void> {
  const requiredAgentIds = [...new Set(steps.map((s) => s.agentId))];
  
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
