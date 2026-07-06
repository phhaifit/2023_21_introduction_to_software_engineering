import type {
  ApiSuccess,
  CreateTaskRequest,
  CreateTaskResponse,
  EntityId,
  TaskRoutingSelection,
  TaskStatus
} from "@vcp/shared";

const agentId = "agent-contract-test" as EntityId<"agentId">;
const workflowId = "workflow-contract-test" as EntityId<"workflowId">;
const taskId = "task-contract-test" as EntityId<"taskId">;
const workId = "work-contract-test" as EntityId<"workId">;

const autoRouting: TaskRoutingSelection = { mode: "auto" };
const agentRouting: TaskRoutingSelection = {
  mode: "specific-agent",
  agentId
};
const workflowRouting: TaskRoutingSelection = {
  mode: "predefined-workflow",
  workflowId
};

const createRequest: CreateTaskRequest = {
  prompt: "Prepare a deterministic report.",
  routing: autoRouting
};

const canonicalStatus: TaskStatus = "queued";
const createResponse: CreateTaskResponse = {
  taskId,
  workId,
  status: canonicalStatus,
  createdAt: "2026-06-23T00:00:00.000Z"
};

const successEnvelope: ApiSuccess<CreateTaskResponse> = {
  ok: true,
  data: createResponse,
  meta: {
    requestId: "request-contract-test",
    timestamp: "2026-06-23T00:00:00.000Z"
  }
};

void [
  agentRouting,
  workflowRouting,
  createRequest,
  successEnvelope
];

// @ts-expect-error specific-agent routing requires agentId
const missingAgent: TaskRoutingSelection = { mode: "specific-agent" };

// @ts-expect-error predefined-workflow routing requires workflowId
const missingWorkflow: TaskRoutingSelection = { mode: "predefined-workflow" };

// @ts-expect-error auto routing cannot include an agent target
const autoWithAgent: TaskRoutingSelection = { mode: "auto", agentId };

// @ts-expect-error auto routing cannot include a workflow target
const autoWithWorkflow: TaskRoutingSelection = { mode: "auto", workflowId };

// @ts-expect-error specific-agent routing cannot include a workflow target
const agentWithWorkflow: TaskRoutingSelection = {
  mode: "specific-agent",
  agentId,
  workflowId
};

// @ts-expect-error workflow routing cannot include an agent target
const workflowWithAgent: TaskRoutingSelection = {
  mode: "predefined-workflow",
  workflowId,
  agentId
};

// @ts-expect-error specific-agent routing cannot contain both targets
const specificWithBothTargets: TaskRoutingSelection = {
  mode: "specific-agent",
  agentId,
  workflowId
};

// @ts-expect-error workflow routing cannot contain both targets
const workflowWithBothTargets: TaskRoutingSelection = {
  mode: "predefined-workflow",
  workflowId,
  agentId
};

const structuralAutoWithAgent = {
  mode: "auto" as const,
  agentId
};
// @ts-expect-error non-fresh auto routing cannot include an agent target
const structuralAutoAgentRouting: TaskRoutingSelection = structuralAutoWithAgent;

const structuralAutoWithWorkflow = {
  mode: "auto" as const,
  workflowId
};
// @ts-expect-error non-fresh auto routing cannot include a workflow target
const structuralAutoWorkflowRouting: TaskRoutingSelection =
  structuralAutoWithWorkflow;

const structuralSpecificWithWorkflow = {
  mode: "specific-agent" as const,
  agentId,
  workflowId
};
// @ts-expect-error non-fresh specific-agent routing cannot include workflowId
const structuralSpecificRouting: TaskRoutingSelection =
  structuralSpecificWithWorkflow;

const structuralWorkflowWithAgent = {
  mode: "predefined-workflow" as const,
  workflowId,
  agentId
};
// @ts-expect-error non-fresh workflow routing cannot include agentId
const structuralWorkflowRouting: TaskRoutingSelection =
  structuralWorkflowWithAgent;

const structuralBothTargets = {
  mode: "auto" as const,
  agentId,
  workflowId
};
// @ts-expect-error non-fresh auto routing cannot include both targets
const structuralBothRouting: TaskRoutingSelection = structuralBothTargets;

const requestWithWorkspace: CreateTaskRequest = {
  prompt: "Invalid transport shape.",
  routing: autoRouting,
  // @ts-expect-error authenticated workspace identity is not request-body data
  workspaceId: "workspace-contract-test"
};

void [
  missingAgent,
  missingWorkflow,
  autoWithAgent,
  autoWithWorkflow,
  agentWithWorkflow,
  workflowWithAgent,
  specificWithBothTargets,
  workflowWithBothTargets,
  structuralAutoAgentRouting,
  structuralAutoWorkflowRouting,
  structuralSpecificRouting,
  structuralWorkflowRouting,
  structuralBothRouting,
  requestWithWorkspace
];
