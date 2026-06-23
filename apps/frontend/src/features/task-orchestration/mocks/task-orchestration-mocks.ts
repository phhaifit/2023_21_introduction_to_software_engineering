import type {
  MockAgent,
  MockWorkflow
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

export interface TaskOrchestrationSeedData {
  agents: MockAgent[];
  workflows: MockWorkflow[];
}

export function createTaskOrchestrationSeedData(): TaskOrchestrationSeedData {
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

export const DEMO_PROMPTS = {
  weeklyProgressReport:
    "Lập báo cáo tiến độ tuần dựa trên số liệu mẫu.",
  specificAgentProductDescription:
    "Viết một đoạn mô tả ngắn cho sản phẩm mới của công ty.",
  researchAndSynthesis:
    "Nghiên cứu thông tin và tổng hợp thành báo cáo ngắn.",
  longRunningCancellation:
    "Tạo một báo cáo dài cần nhiều bước xử lý.",
  failureSimulation:
    "FAIL_SIMULATION: mô phỏng lỗi khi tổng hợp kết quả."
} as const;

export const MOCK_RESULTS = {
  weeklyProgressReport:
    "Tiến độ tuần ổn định: các hạng mục chính đúng kế hoạch và rủi ro đã được ghi nhận.",
  productDescription:
    "Sản phẩm giúp đội ngũ phối hợp công việc nhanh hơn trong một không gian thống nhất.",
  researchSummary:
    "Nghiên cứu cho thấy giải pháp phù hợp khi ưu tiên luồng làm việc rõ ràng và kết quả có thể kiểm chứng."
} as const;

export const DEMO_TIMINGS = {
  pendingMs: 600,
  stepMs: 700,
  streamChunkMs: 150
} as const;
