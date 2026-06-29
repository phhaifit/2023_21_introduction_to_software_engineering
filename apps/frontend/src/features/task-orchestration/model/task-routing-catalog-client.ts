import type {
  AgentPublicSummary,
  EntityId,
  WorkflowDto
} from "@vcp/shared";

import type {
  RoutingAgentOption,
  RoutingWorkflowOption
} from "./task-types";

export type TaskRoutingCatalog = {
  agents: RoutingAgentOption[];
  workflows: RoutingWorkflowOption[];
};

export type TaskRoutingCatalogClient = {
  listRoutingCatalog(workspaceId: EntityId<"workspaceId">): Promise<TaskRoutingCatalog>;
};

type FetchImplementation = typeof fetch;

type WorkflowPublicSummary = Pick<
  WorkflowDto,
  "workflowId" | "name" | "description" | "status"
> & {
  stepCount?: number;
};

export function createTaskRoutingCatalogClient(input: {
  fetchImplementation?: FetchImplementation;
  baseUrl?: string;
} = {}): TaskRoutingCatalogClient {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const baseUrl = input.baseUrl?.replace(/\/$/, "") ?? "";

  async function requestData<T>(path: string): Promise<T> {
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      headers: { accept: "application/json" }
    });
    const body: unknown = await response.json().catch(() => undefined);

    if (!response.ok || !isRecord(body) || body.ok === false || !("data" in body)) {
      throw new Error("Routing catalog API returned an invalid response.");
    }

    return body.data as T;
  }

  return {
    async listRoutingCatalog(workspaceId) {
      const encodedWorkspaceId = encodeURIComponent(workspaceId);
      const [agents, workflows] = await Promise.all([
        requestData<AgentPublicSummary[]>(
          `/api/workspaces/${encodedWorkspaceId}/agents`
        ),
        requestData<WorkflowPublicSummary[]>(
          `/api/workspaces/${encodedWorkspaceId}/workflows`
        )
      ]);

      return {
        agents: agents.map(toRoutingAgentOption),
        workflows: workflows
          .filter((workflow) => workflow.status === "published")
          .map(toRoutingWorkflowOption)
      };
    }
  };
}

export function createLocalTaskRoutingCatalogClient(): TaskRoutingCatalogClient {
  return {
    async listRoutingCatalog() {
      return {
        agents: [
          {
            id: "AGT-CODE",
            name: "Code Agent",
            description: "Implements focused software changes from clear requirements.",
            capabilities: ["code generation", "refactoring", "debugging"],
            available: true
          },
          {
            id: "AGT-REVIEW",
            name: "Review Agent",
            description: "Reviews code for correctness, clarity, and maintainability.",
            capabilities: ["code review", "risk analysis", "quality checks"],
            available: true
          },
          {
            id: "AGT-RESEARCH",
            name: "Research Agent",
            description: "Collects and organizes information for a requested topic.",
            capabilities: ["research planning", "fact organization", "source comparison"],
            available: true
          },
          {
            id: "AGT-SYNTHESIS",
            name: "Synthesis Agent",
            description: "Combines structured inputs into concise final deliverables.",
            capabilities: ["content synthesis", "summarization", "report writing"],
            available: true
          }
        ],
        workflows: [
          {
            id: "WFL-CODE-REVIEW",
            name: "Code + Review",
            description: "Creates a software change and follows it with a focused review.",
            agentIds: ["AGT-CODE", "AGT-REVIEW"]
          },
          {
            id: "WFL-RESEARCH-SYNTHESIS",
            name: "Research + Synthesis",
            description: "Researches a topic and turns the findings into a concise report.",
            agentIds: ["AGT-RESEARCH", "AGT-SYNTHESIS"]
          }
        ]
      };
    }
  };
}

function toRoutingAgentOption(agent: AgentPublicSummary): RoutingAgentOption {
  const capabilities = [agent.role, agent.model].filter(Boolean);

  return {
    id: agent.agentId,
    name: agent.name,
    description: `${agent.role} using ${agent.model}`,
    capabilities,
    available: agent.status === "enabled"
  };
}

function toRoutingWorkflowOption(workflow: WorkflowPublicSummary): RoutingWorkflowOption {
  const stepCount = typeof workflow.stepCount === "number" ? workflow.stepCount : 0;

  return {
    id: workflow.workflowId,
    name: workflow.name,
    description:
      workflow.description ??
      `Published workflow with ${stepCount} ${stepCount === 1 ? "step" : "steps"}.`,
    agentIds: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
