import type {
  AgentSkillDraftInput,
  AgentSkillKnowledgeReference,
  AgentRuntimeConfiguration,
  AgentSkillToolReference
} from "@vcp/shared/contracts/agent-management.ts";
import type { Agent } from "../domain/agent.ts";

export type AgentSkillConfigurationInput = Pick<
  Agent | AgentSkillDraftInput,
  "name" | "role" | "model" | "instructions"
> &
  Partial<
    Pick<
      AgentSkillDraftInput,
      | "responsibilities"
      | "operatingContext"
      | "requestedTools"
      | "requestedKnowledge"
      | "constraints"
      | "escalationRules"
      | "exampleTasks"
    >
  > & {
    runtimeConfiguration?: Partial<AgentRuntimeConfiguration>;
  };

export function generateAgentSkillConfiguration(input: AgentSkillConfigurationInput): string {
  const runtimeConfiguration = input.runtimeConfiguration;

  return [
    `# ${input.name}`,
    "",
    "## Role",
    input.role,
    "",
    "## Model",
    input.model,
    "",
    "## Responsibilities",
    renderTextList(input.responsibilities ?? runtimeConfiguration?.responsibilities),
    "",
    "## Operating Context",
    renderText(input.operatingContext ?? runtimeConfiguration?.operatingContext),
    "",
    "## Instructions",
    input.instructions,
    "",
    "## Requested Tools",
    renderToolList(input.requestedTools ?? runtimeConfiguration?.requestedTools),
    "",
    "## Requested Knowledge",
    renderKnowledgeList(input.requestedKnowledge ?? runtimeConfiguration?.requestedKnowledge),
    "",
    "## Constraints",
    renderTextList(input.constraints ?? runtimeConfiguration?.constraints),
    "",
    "## Escalation Rules",
    renderTextList(input.escalationRules ?? runtimeConfiguration?.escalationRules),
    "",
    "## Example Tasks",
    renderTextList(input.exampleTasks ?? runtimeConfiguration?.exampleTasks),
    ""
  ].join("\n");
}

function renderText(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "_Not specified._";
}

function renderTextList(values: readonly string[] | undefined): string {
  const rendered = values?.map((value) => value.trim()).filter(Boolean) ?? [];

  if (rendered.length === 0) {
    return "_Not specified._";
  }

  return rendered.map((value) => `- ${value}`).join("\n");
}

function renderToolList(values: readonly AgentSkillToolReference[] | undefined): string {
  const rendered = values
    ?.map((tool) => ({
      name: tool.name.trim(),
      reason: tool.reason?.trim()
    }))
    .filter((tool) => tool.name) ?? [];

  if (rendered.length === 0) {
    return "_Not specified._";
  }

  return rendered
    .map((tool) => (tool.reason ? `- ${tool.name}: ${tool.reason}` : `- ${tool.name}`))
    .join("\n");
}

function renderKnowledgeList(values: readonly AgentSkillKnowledgeReference[] | undefined): string {
  const rendered = values
    ?.map((document) => ({
      title: document.title.trim(),
      reason: document.reason?.trim()
    }))
    .filter((document) => document.title) ?? [];

  if (rendered.length === 0) {
    return "_Not specified._";
  }

  return rendered
    .map((document) =>
      document.reason ? `- ${document.title}: ${document.reason}` : `- ${document.title}`
    )
    .join("\n");
}
