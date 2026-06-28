import type {
  AgentCreationAssistantDraft,
  AgentCreationAssistantDraftResponse,
  AgentDraftProviderMetadata,
  AgentDraftValidationWarning,
  AgentDraftWarningSeverity,
  AgentSkillKnowledgeReference,
  AgentSkillToolReference
} from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type LlmAgentDraftingPromptInput = {
  workspaceId: EntityId<"workspaceId">;
  prompt: string;
};

export type LlmAgentDraftingSkillImportInput = {
  workspaceId: EntityId<"workspaceId">;
  markdown: string;
  fileName?: string;
};

export type LlmAgentDraftingProviderInput =
  | (LlmAgentDraftingPromptInput & { source: "prompt" })
  | (LlmAgentDraftingSkillImportInput & { source: "skill-import" });

export type LlmAgentDraftProviderId = AgentDraftProviderMetadata["providerId"];

export type LlmAgentDraftProvider = {
  providerId: LlmAgentDraftProviderId;
  modelId: string;
  generateStructuredDraft(input: LlmAgentDraftingProviderInput): Promise<unknown>;
};

export type LlmAgentDraftingPort = {
  createDraft(input: LlmAgentDraftingPromptInput): Promise<AgentCreationAssistantDraftResponse>;
  extractDraftFromSkillMarkdown(
    input: LlmAgentDraftingSkillImportInput
  ): Promise<AgentCreationAssistantDraftResponse>;
};

export class LlmProviderFailure extends Error {
  readonly safeReason: string;

  constructor(safeReason: string) {
    super(`LLM provider failed: ${safeReason}`);
    this.name = "LlmProviderFailure";
    this.safeReason = safeReason;
  }
}

export class LlmDraftingUnavailableError extends Error {
  readonly failures: readonly { providerId: LlmAgentDraftProviderId; reason: string }[];

  constructor(failures: readonly { providerId: LlmAgentDraftProviderId; reason: string }[]) {
    super("Agent draft generation is temporarily unavailable. Please try again.");
    this.name = "LlmDraftingUnavailableError";
    this.failures = failures;
  }
}

export class LlmAgentDraftingService implements LlmAgentDraftingPort {
  private readonly providers: readonly LlmAgentDraftProvider[];

  constructor(providers: readonly LlmAgentDraftProvider[]) {
    if (providers.length === 0) {
      throw new Error("At least one LLM draft provider is required");
    }
    this.providers = providers;
  }

  async createDraft(
    input: LlmAgentDraftingPromptInput
  ): Promise<AgentCreationAssistantDraftResponse> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new LlmProviderFailure("prompt_required");
    }

    return this.generateWithFallback({
      workspaceId: input.workspaceId,
      prompt,
      source: "prompt"
    });
  }

  async extractDraftFromSkillMarkdown(
    input: LlmAgentDraftingSkillImportInput
  ): Promise<AgentCreationAssistantDraftResponse> {
    const markdown = input.markdown.trim();
    if (!markdown) {
      throw new LlmProviderFailure("markdown_required");
    }

    return this.generateWithFallback({
      workspaceId: input.workspaceId,
      markdown,
      fileName: input.fileName?.trim() || undefined,
      source: "skill-import"
    });
  }

  private async generateWithFallback(
    input: LlmAgentDraftingProviderInput
  ): Promise<AgentCreationAssistantDraftResponse> {
    const failures: { providerId: LlmAgentDraftProviderId; reason: string }[] = [];

    for (const provider of this.providers) {
      try {
        const structuredOutput = await provider.generateStructuredDraft(input);
        const providerMetadata: AgentDraftProviderMetadata = {
          providerId: provider.providerId,
          modelId: provider.modelId,
          fallbackUsed: failures.length > 0
        };

        return validateStructuredAgentDraftOutput(structuredOutput, providerMetadata);
      } catch (error) {
        failures.push({
          providerId: provider.providerId,
          reason: toSafeProviderFailureReason(error)
        });
      }
    }

    throw new LlmDraftingUnavailableError(failures);
  }
}

export class MockLlmAgentDraftProvider implements LlmAgentDraftProvider {
  readonly providerId = "mock";
  readonly modelId: string;
  private readonly output: unknown;

  constructor(output: unknown = createDefaultMockStructuredDraft(), modelId = "mock-agent-draft-model") {
    this.output = output;
    this.modelId = modelId;
  }

  async generateStructuredDraft(_input: LlmAgentDraftingProviderInput): Promise<unknown> {
    return cloneJson(this.output);
  }
}

export function validateStructuredAgentDraftOutput(
  output: unknown,
  provider: AgentDraftProviderMetadata
): AgentCreationAssistantDraftResponse {
  const object = readObject(output, "structured output");
  const draftValue = "draft" in object ? object.draft : object;
  const warnings = readWarnings(object.warnings, "warnings");
  const clarifyingQuestions = readStringArray(object.clarifyingQuestions, "clarifyingQuestions");

  if (draftValue === null) {
    if (clarifyingQuestions.length === 0) {
      throw new LlmProviderFailure("structured_output_missing_draft");
    }

    return {
      draft: null,
      warnings,
      clarifyingQuestions,
      provider
    };
  }

  const draftObject = readObject(draftValue, "draft");
  const draftWarnings = readWarnings(draftObject.warnings, "draft.warnings");
  const mergedWarnings = [...warnings, ...draftWarnings];
  const draftQuestions = readStringArray(
    draftObject.clarifyingQuestions,
    "draft.clarifyingQuestions"
  );
  const mergedQuestions = [...clarifyingQuestions, ...draftQuestions];

  const draft: AgentCreationAssistantDraft = {
    name: readRequiredString(draftObject.name, "draft.name"),
    role: readRequiredString(draftObject.role, "draft.role"),
    model: readRequiredString(draftObject.model, "draft.model"),
    instructions: readRequiredString(draftObject.instructions, "draft.instructions"),
    responsibilities: readOptionalStringArray(draftObject.responsibilities, "draft.responsibilities"),
    operatingContext: readOptionalString(draftObject.operatingContext, "draft.operatingContext"),
    requestedTools: readToolReferences(draftObject.requestedTools, "draft.requestedTools"),
    requestedKnowledge: readKnowledgeReferences(
      draftObject.requestedKnowledge,
      "draft.requestedKnowledge"
    ),
    constraints: readOptionalStringArray(draftObject.constraints, "draft.constraints"),
    escalationRules: readOptionalStringArray(draftObject.escalationRules, "draft.escalationRules"),
    exampleTasks: readOptionalStringArray(draftObject.exampleTasks, "draft.exampleTasks"),
    warnings: mergedWarnings,
    clarifyingQuestions: mergedQuestions,
    provider
  };

  return {
    draft,
    warnings: mergedWarnings,
    clarifyingQuestions: mergedQuestions,
    provider
  };
}

function createDefaultMockStructuredDraft(): unknown {
  return {
    draft: {
      name: "Mock Assistant",
      role: "Workspace assistant",
      model: "gemini-2.5-flash",
      instructions: "Help workspace members draft and review operational work.",
      responsibilities: ["Summarize user intent", "Prepare a safe agent draft"],
      requestedTools: [],
      requestedKnowledge: [],
      warnings: [],
      clarifyingQuestions: []
    },
    warnings: [],
    clarifyingQuestions: []
  };
}

function toSafeProviderFailureReason(error: unknown): string {
  if (error instanceof LlmProviderFailure) {
    return error.safeReason;
  }

  return "provider_unavailable";
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LlmProviderFailure(`${field}_must_be_object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, field: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new LlmProviderFailure(`${field}_required`);
  }

  return normalized;
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new LlmProviderFailure(`${field}_must_be_string`);
  }

  return value.trim() || undefined;
}

function readStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  return readOptionalStringArray(value, field);
}

function readOptionalStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new LlmProviderFailure(`${field}_must_be_array`);
  }

  return value.map((item, index) => readRequiredString(item, `${field}.${index}`));
}

function readWarnings(value: unknown, field: string): AgentDraftValidationWarning[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new LlmProviderFailure(`${field}_must_be_array`);
  }

  return value.map((item, index) => {
    const warning = readObject(item, `${field}.${index}`);
    return {
      code: readRequiredString(warning.code, `${field}.${index}.code`),
      message: readRequiredString(warning.message, `${field}.${index}.message`),
      severity: readWarningSeverity(warning.severity, `${field}.${index}.severity`),
      field: readOptionalString(warning.field, `${field}.${index}.field`)
    };
  });
}

function readWarningSeverity(value: unknown, field: string): AgentDraftWarningSeverity {
  if (value === "blocking" || value === "advisory") {
    return value;
  }

  throw new LlmProviderFailure(`${field}_invalid`);
}

function readToolReferences(value: unknown, field: string): AgentSkillToolReference[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new LlmProviderFailure(`${field}_must_be_array`);
  }

  return value.map((item, index) => {
    const reference = readObject(item, `${field}.${index}`);
    return {
      toolId:
        typeof reference.toolId === "string" && reference.toolId.trim()
          ? (reference.toolId.trim() as EntityId<"toolId">)
          : undefined,
      name: readRequiredString(reference.name, `${field}.${index}.name`),
      reason: readOptionalString(reference.reason, `${field}.${index}.reason`)
    };
  });
}

function readKnowledgeReferences(value: unknown, field: string): AgentSkillKnowledgeReference[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new LlmProviderFailure(`${field}_must_be_array`);
  }

  return value.map((item, index) => {
    const reference = readObject(item, `${field}.${index}`);
    return {
      documentId:
        typeof reference.documentId === "string" && reference.documentId.trim()
          ? (reference.documentId.trim() as EntityId<"documentId">)
          : undefined,
      title: readRequiredString(reference.title, `${field}.${index}.title`),
      reason: readOptionalString(reference.reason, `${field}.${index}.reason`)
    };
  });
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
