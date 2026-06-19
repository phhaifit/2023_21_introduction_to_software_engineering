export const CAPABILITIES = [
  "authentication",
  "subscription-payment",
  "workspace-management",
  "workspace-user-management",
  "agent-management",
  "tools-integration",
  "workflow-management",
  "task-orchestration",
  "knowledge-base-rag"
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "authentication": "Authentication",
  "subscription-payment": "Subscription & Payment",
  "workspace-management": "Workspace Management",
  "workspace-user-management": "Workspace User Management",
  "agent-management": "Agent Management",
  "tools-integration": "Tools & Integration",
  "workflow-management": "Workflow Management",
  "task-orchestration": "Task & Orchestration",
  "knowledge-base-rag": "Knowledge Base / RAG"
};
