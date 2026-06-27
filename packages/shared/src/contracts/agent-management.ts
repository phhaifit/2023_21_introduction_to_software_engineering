import type { EntityId } from "./ids.ts";
import type { AgentStatus } from "./statuses.ts";

export const AGENT_PUBLIC_SUMMARY_FIELDS = [
  "agentId",
  "workspaceId",
  "name",
  "role",
  "model",
  "status",
  "updatedAt"
] as const;

export const SELECTABLE_AGENT_STATUSES = ["enabled"] as const;

export type SelectableAgentStatus = (typeof SELECTABLE_AGENT_STATUSES)[number];

export const AGENT_SKILL_MARKDOWN_SECTIONS = [
  "Role",
  "Model",
  "Responsibilities",
  "Operating Context",
  "Instructions",
  "Requested Tools",
  "Requested Knowledge",
  "Constraints",
  "Escalation Rules",
  "Example Tasks"
] as const;

export const AGENT_DRAFT_WARNING_SEVERITIES = ["blocking", "advisory"] as const;

export type AgentDraftWarningSeverity = (typeof AGENT_DRAFT_WARNING_SEVERITIES)[number];

export type AgentPublicSummary = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  status: AgentStatus;
  updatedAt: string;
};

export type AgentSkillToolReference = {
  toolId?: EntityId<"toolId">;
  name: string;
  reason?: string;
};

export type AgentSkillKnowledgeReference = {
  documentId?: EntityId<"documentId">;
  title: string;
  reason?: string;
};

export type AgentSkillDraftInput = {
  name: string;
  role: string;
  model: string;
  instructions: string;
  responsibilities?: string[];
  operatingContext?: string;
  requestedTools?: AgentSkillToolReference[];
  requestedKnowledge?: AgentSkillKnowledgeReference[];
  constraints?: string[];
  escalationRules?: string[];
  exampleTasks?: string[];
};

export type AgentSkillPreviewRequest = AgentSkillDraftInput;

export type AgentSkillPreviewResponse = {
  markdown: string;
  fileName: "skill.md";
};

export type AgentSkillImportAnalysisRequest = {
  markdown: string;
  fileName?: string;
};

export type AgentSkillImportValidationResponse = {
  accepted: true;
  fileName: "skill.md";
};

export type AgentModelCatalogEntry = {
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  tier: "free" | "demo" | "paid";
  enabled: boolean;
};

export type AgentDraftProviderMetadata = {
  providerId: "gemini" | "openrouter" | "mock";
  modelId: string;
  fallbackUsed: boolean;
};

export type AgentDraftValidationWarning = {
  code: string;
  message: string;
  severity: AgentDraftWarningSeverity;
  field?: string;
};

export type AgentCreationAssistantDraft = AgentSkillDraftInput & {
  warnings: AgentDraftValidationWarning[];
  clarifyingQuestions: string[];
  provider?: AgentDraftProviderMetadata;
};

export type AgentCreationAssistantDraftRequest = {
  prompt: string;
};

export type CreateAgentRequest = {
  name: string;
  role: string;
  model: string;
  instructions: string;
  requestedTools?: AgentSkillToolReference[];
  requestedKnowledge?: AgentSkillKnowledgeReference[];
};

export type AgentCreationAssistantDraftResponse = {
  draft: AgentCreationAssistantDraft | null;
  warnings: AgentDraftValidationWarning[];
  clarifyingQuestions: string[];
  provider?: AgentDraftProviderMetadata;
};
