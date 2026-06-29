import type {
  RoutingAgentOption,
  RoutingWorkflowOption
} from "../model/task-types";

const CANONICAL_AGENTS = [
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
] as const;

const CANONICAL_WORKFLOWS = [
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
] as const;

export interface TaskRoutingOptions {
  agents: RoutingAgentOption[];
  workflows: RoutingWorkflowOption[];
}

export function createTaskRoutingOptions(): TaskRoutingOptions {
  return {
    agents: CANONICAL_AGENTS.map((agent) => ({
      ...agent,
      capabilities: [...agent.capabilities]
    })),
    workflows: CANONICAL_WORKFLOWS.map((workflow) => ({
      ...workflow,
      agentIds: [...workflow.agentIds]
    }))
  };
}

export const SUGGESTED_TASK_PROMPTS = {
  weeklyProgressReport:
    "Lap bao cao tien do tuan dua tren so lieu dau vao.",
  specificAgentProductDescription:
    "Viet mot doan mo ta ngan cho san pham moi cua cong ty.",
  researchAndSynthesis:
    "Nghien cuu thong tin va tong hop thanh bao cao ngan."
} as const;

export const DEFAULT_TASK_RUNTIME_TIMINGS = {
  pendingMs: 600,
  stepMs: 700,
  streamChunkMs: 150
} as const;
