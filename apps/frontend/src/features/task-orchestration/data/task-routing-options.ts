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
