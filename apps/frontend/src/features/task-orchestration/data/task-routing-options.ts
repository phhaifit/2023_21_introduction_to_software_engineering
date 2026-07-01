import type {
  RoutingAgentOption,
  RoutingWorkflowOption
} from "../model/task-types";

export interface TaskRoutingOptions {
  agents: RoutingAgentOption[];
  workflows: RoutingWorkflowOption[];
}

export function createTaskRoutingOptions(): TaskRoutingOptions {
  return { agents: [], workflows: [] };
}

export const SUGGESTED_TASK_PROMPTS = {
  weeklyProgressReport:
    "Create a weekly progress report from the provided metrics.",
  specificAgentProductDescription:
    "Write a concise product description for the company's new release.",
  researchAndSynthesis:
    "Research a topic and synthesize the findings into a short brief."
} as const;

export const DEFAULT_TASK_RUNTIME_TIMINGS = {
  pendingMs: 600,
  stepMs: 700,
  streamChunkMs: 150
} as const;
