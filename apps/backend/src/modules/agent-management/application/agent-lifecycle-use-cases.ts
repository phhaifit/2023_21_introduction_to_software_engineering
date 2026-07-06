import type {
  AgentCreationAssistantDraftResponse,
  AgentDraftValidationWarning,
  AgentModelCatalogEntry,
  AgentPublicSummary,
  AgentRuntimeConfiguration,
  AgentRuntimeProfile,
  AgentSkillKnowledgeReference,
  AgentSkillImportAnalysisRequest,
  AgentSkillPreviewRequest,
  AgentSkillPreviewResponse,
  AgentSkillToolReference
} from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";
import type { ApiPaginationMeta } from "@vcp/shared/contracts/api.ts";
import { createAgent, isAgentSelectable, toAgentPublicSummary, type Agent } from "../domain/agent.ts";
import type { AgentRepository } from "./agent-repository.ts";
import {
  MockConnectedToolCatalog,
  MockKnowledgeDocumentCatalog,
  validateRequestedCapabilities,
  type ConnectedToolCatalogPort,
  type KnowledgeDocumentCatalogPort
} from "./agent-capability-catalog.ts";
import { StaticAgentModelCatalog, type AgentModelCatalogPort } from "./agent-model-catalog.ts";
import { generateAgentSkillConfiguration } from "./agent-skill-configuration.ts";
import type { AgentSkillWriter } from "./agent-skill-writer.ts";
import type { LlmAgentDraftingPort, LlmDraftingUnavailableError } from "./llm-agent-drafting-port.ts";

export type AgentListItem = AgentPublicSummary & {
  createdAt: string;
};

export type AgentMutationResult = {
  agent: Agent;
  publicSummary: AgentPublicSummary;
  skillConfiguration: string;
};

export type AgentEditableConfiguration = {
  agentId: EntityId<"agentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  role: string;
  model: string;
  instructions: string;
  status: Exclude<AgentStatus, "deleted">;
  updatedAt: string;
};

export type AgentSkillMarkdownArtifact = {
  markdown: string;
  fileName: "skill.md";
  agent: Agent;
};

export type CreateAgentInput = {
  workspaceId: EntityId<"workspaceId">;
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

export type UpdateAgentInput = {
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
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

export type AgentRuntimeProfileReader = {
  getAgentRuntimeProfile(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentRuntimeProfile>;
};

export type AgentLifecycleDependencies = {
  repository: AgentRepository;
  modelCatalog?: AgentModelCatalogPort;
  connectedToolCatalog?: ConnectedToolCatalogPort;
  knowledgeDocumentCatalog?: KnowledgeDocumentCatalogPort;
  skillWriter?: AgentSkillWriter;
  draftingPort?: LlmAgentDraftingPort;
  now: () => string;
  generateAgentId: () => EntityId<"agentId">;
};

export class AgentValidationError extends Error {
  readonly issues: readonly string[];
  readonly warnings: readonly AgentDraftValidationWarning[];

  constructor(issues: readonly string[], warnings: readonly AgentDraftValidationWarning[] = []) {
    super(`Invalid agent configuration: ${issues.join(", ")}`);
    this.name = "AgentValidationError";
    this.issues = issues;
    this.warnings = warnings;
  }
}

export class AgentNotFoundError extends Error {
  constructor(agentId: EntityId<"agentId">) {
    super(`Agent not found: ${agentId}`);
    this.name = "AgentNotFoundError";
  }
}

export class AgentLifecycleUseCases {
  private readonly dependencies: AgentLifecycleDependencies;
  private readonly modelCatalog: AgentModelCatalogPort;
  private readonly connectedToolCatalog: ConnectedToolCatalogPort;
  private readonly knowledgeDocumentCatalog: KnowledgeDocumentCatalogPort;

  constructor(dependencies: AgentLifecycleDependencies) {
    this.dependencies = dependencies;
    this.modelCatalog = dependencies.modelCatalog ?? new StaticAgentModelCatalog();
    this.connectedToolCatalog = dependencies.connectedToolCatalog ?? new MockConnectedToolCatalog();
    this.knowledgeDocumentCatalog =
      dependencies.knowledgeDocumentCatalog ?? new MockKnowledgeDocumentCatalog();
  }

  async listAgents(
    workspaceId: EntityId<"workspaceId">,
    options: {
      search?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ items: AgentListItem[]; pagination: ApiPaginationMeta }> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;

    let statuses: readonly AgentStatus[] = ["enabled", "disabled"];
    if (options.status) {
      statuses = options.status.split(",") as AgentStatus[];
    }

    let sortBy = options.sortBy || "createdAt";
    const allowedSortBy = ["name", "createdAt", "updatedAt", "status"];
    if (!allowedSortBy.includes(sortBy)) {
      throw new AgentValidationError([`invalid sortBy field: ${sortBy}`]);
    }

    const sortOrder = options.sortOrder || "asc";

    const result = await this.dependencies.repository.listByWorkspace(workspaceId, {
      search: options.search,
      statuses,
      sortBy,
      sortOrder,
      page,
      pageSize
    });

    const items = result.agents.map((agent) => ({
      ...toAgentPublicSummary(agent),
      createdAt: agent.createdAt
    }));

    const totalPages = Math.ceil(result.total / pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  async getAgentConfiguration(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentEditableConfiguration> {
    const agent = await this.requireAgent(workspaceId, agentId);

    if (agent.status === "deleted") {
      throw new AgentNotFoundError(agentId);
    }

    return {
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      name: agent.name,
      role: agent.role,
      model: agent.model,
      instructions: agent.instructions,
      status: agent.status,
      updatedAt: agent.updatedAt
    };
  }

  async listAgentModels(
    workspaceId: EntityId<"workspaceId">
  ): Promise<AgentModelCatalogEntry[]> {
    const entries = await this.modelCatalog.listModels(workspaceId);
    return entries
      .filter((entry) => entry.enabled)
      .map((entry) => ({
        ...entry,
        capabilities: [...entry.capabilities]
      }));
  }

  previewSkillMarkdown(input: AgentSkillPreviewRequest): AgentSkillPreviewResponse {
    const normalized = this.validateAgentSkillDraft(input);

    return {
      markdown: generateAgentSkillConfiguration(normalized),
      fileName: "skill.md"
    };
  }

  async downloadAgentSkillMarkdown(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentSkillMarkdownArtifact> {
    const agent = await this.requireAgent(workspaceId, agentId);

    if (agent.status === "deleted") {
      throw new AgentNotFoundError(agentId);
    }

    return {
      markdown: generateAgentSkillConfiguration(agent),
      fileName: "skill.md",
      agent
    };
  }

  async getAgentRuntimeProfile(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentRuntimeProfile> {
    const agent = await this.requireAgent(workspaceId, agentId);

    if (agent.status !== "enabled") {
      throw new AgentNotFoundError(agentId);
    }

    const skillMarkdown = generateAgentSkillConfiguration(agent);
    const runtimeConfiguration = this.cloneRuntimeConfiguration(agent.runtimeConfiguration);

    return {
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      name: agent.name,
      role: agent.role,
      model: agent.model,
      instructions: agent.instructions,
      status: "enabled",
      runnable: true,
      updatedAt: agent.updatedAt,
      runtimeConfiguration,
      skillMarkdown,
      materializationHints: {
        profileVersion: "agent-runtime-profile.v1",
        runtimeOwner: "task-orchestration-openclaw",
        agentDirectoryName: this.toRuntimeAgentDirectoryName(agent),
        skillFileName: "skill.md",
        requiresCurrentToolResolution: runtimeConfiguration.requestedTools.length > 0,
        requiresCurrentKnowledgeResolution: runtimeConfiguration.requestedKnowledge.length > 0
      }
    };
  }

  async generateAssistantDraft(
    workspaceId: EntityId<"workspaceId">,
    prompt: string
  ): Promise<AgentCreationAssistantDraftResponse> {
    if (!this.dependencies.draftingPort) {
      throw new Error("LlmAgentDraftingPort is not configured");
    }

    if (!prompt.trim()) {
      throw new AgentValidationError(["prompt is required"]);
    }

    return this.dependencies.draftingPort.createDraft({
      workspaceId,
      prompt
    });
  }

  validateSkillMarkdownImport(
    input: AgentSkillImportAnalysisRequest
  ): { markdown: string; fileName?: string } {
    const markdown = typeof input.markdown === "string" ? input.markdown.trim() : "";
    const fileName = input.fileName?.trim();
    const issues: string[] = [];

    if (!markdown) {
      issues.push("markdown is required");
    }

    if (fileName && !/\.(md|markdown)$/i.test(fileName)) {
      issues.push("fileName must reference a Markdown file");
    }

    if (markdown && !this.looksLikeMarkdown(markdown, fileName)) {
      issues.push("markdown content must look like Markdown");
    }

    if (issues.length > 0) {
      throw new AgentValidationError(issues);
    }

    return {
      markdown,
      fileName: fileName || undefined
    };
  }

  async analyzeSkillMarkdownImport(
    workspaceId: EntityId<"workspaceId">,
    input: AgentSkillImportAnalysisRequest
  ): Promise<AgentCreationAssistantDraftResponse> {
    if (!this.dependencies.draftingPort) {
      throw new Error("LlmAgentDraftingPort is not configured");
    }

    const validated = this.validateSkillMarkdownImport(input);

    return this.dependencies.draftingPort.extractDraftFromSkillMarkdown({
      workspaceId,
      markdown: validated.markdown,
      fileName: validated.fileName
    });
  }

  async createAgent(input: CreateAgentInput): Promise<AgentMutationResult> {
    const normalized = this.validateCreateInput(input);
    await this.assertSelectableModel(input.workspaceId, normalized.model);
    await this.assertRequestedCapabilities({
      workspaceId: input.workspaceId,
      requestedTools: normalized.requestedTools,
      requestedKnowledge: normalized.requestedKnowledge
    });
    const nameAlreadyUsed = await this.dependencies.repository.existsByName(
      input.workspaceId,
      normalized.name
    );

    if (nameAlreadyUsed) {
      throw new AgentValidationError(["name must be unique within the workspace"]);
    }

    const timestamp = this.dependencies.now();
    const agent = createAgent({
      agentId: this.dependencies.generateAgentId(),
      workspaceId: input.workspaceId,
      name: normalized.name,
      role: normalized.role,
      model: normalized.model,
      instructions: normalized.instructions,
      responsibilities: normalized.responsibilities,
      operatingContext: normalized.operatingContext,
      requestedTools: normalized.requestedTools,
      requestedKnowledge: normalized.requestedKnowledge,
      constraints: normalized.constraints,
      escalationRules: normalized.escalationRules,
      exampleTasks: normalized.exampleTasks,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return this.saveMutation(agent);
  }

  async updateAgent(input: UpdateAgentInput): Promise<AgentMutationResult> {
    const normalized = this.validateUpdateInput(input);
    await this.assertSelectableModel(input.workspaceId, normalized.model);
    const agent = await this.requireAgent(input.workspaceId, input.agentId);
    this.assertAgentCanBeChanged(agent);

    return this.saveMutation({
      ...agent,
      role: normalized.role,
      model: normalized.model,
      instructions: normalized.instructions,
      runtimeConfiguration: this.mergeRuntimeConfiguration(agent.runtimeConfiguration, normalized),
      updatedAt: this.dependencies.now()
    });
  }

  async renameAgent(input: {
    workspaceId: EntityId<"workspaceId">;
    agentId: EntityId<"agentId">;
    name: string;
  }): Promise<AgentMutationResult> {
    const name = input.name.trim();
    if (!name) {
      throw new AgentValidationError(["name is required"]);
    }

    const agent = await this.requireAgent(input.workspaceId, input.agentId);

    if (agent.status === "deleted") {
      throw new AgentValidationError(["deleted agents cannot be changed"]);
    }

    if (agent.name.toLowerCase() === name.toLowerCase()) {
      return this.saveMutation(agent);
    }

    const nameAlreadyUsed = await this.dependencies.repository.existsByName(
      input.workspaceId,
      name
    );

    if (nameAlreadyUsed) {
      throw new AgentValidationError(["name must be unique within the workspace"]);
    }

    return this.saveMutation({
      ...agent,
      name,
      updatedAt: this.dependencies.now()
    });
  }

  async duplicateAgent(input: {
    workspaceId: EntityId<"workspaceId">;
    agentId: EntityId<"agentId">;
  }): Promise<AgentMutationResult> {
    const sourceAgent = await this.requireAgent(input.workspaceId, input.agentId);

    if (sourceAgent.status === "deleted") {
      throw new AgentValidationError(["deleted agents cannot be duplicated"]);
    }

    const newName = await this.generateUniqueCopyName(input.workspaceId, sourceAgent.name);
    const timestamp = this.dependencies.now();

    const newAgent = createAgent({
      agentId: this.dependencies.generateAgentId(),
      workspaceId: input.workspaceId,
      name: newName,
      role: sourceAgent.role,
      model: sourceAgent.model,
      instructions: sourceAgent.instructions,
      runtimeConfiguration: sourceAgent.runtimeConfiguration,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "enabled"
    });

    return this.saveMutation(newAgent);
  }

  private async generateUniqueCopyName(
    workspaceId: EntityId<"workspaceId">,
    baseName: string
  ): Promise<string> {
    const maxIterations = 50;

    for (let i = 1; i <= maxIterations; i++) {
      const suffix = i === 1 ? " (Copy)" : ` (Copy ${i})`;
      const candidateName = `${baseName}${suffix}`;

      const exists = await this.dependencies.repository.existsByName(workspaceId, candidateName);
      if (!exists) {
        return candidateName;
      }
    }

    return `${baseName} (Copy ${Date.now()})`;
  }

  async enableAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary> {
    return this.setAgentStatus(workspaceId, agentId, "enabled");
  }

  async disableAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary> {
    return this.setAgentStatus(workspaceId, agentId, "disabled");
  }

  async deleteAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<AgentPublicSummary> {
    return this.setAgentStatus(workspaceId, agentId, "deleted");
  }

  private async setAgentStatus(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    status: AgentStatus
  ): Promise<AgentPublicSummary> {
    const agent = await this.requireAgent(workspaceId, agentId);

    if (agent.status === "deleted" && status !== "deleted") {
      throw new AgentValidationError(["deleted agents cannot be re-enabled"]);
    }

    const saved = await this.dependencies.repository.save({
      ...agent,
      status,
      updatedAt: this.dependencies.now()
    });

    return toAgentPublicSummary(saved);
  }

  private async saveMutation(agent: Agent): Promise<AgentMutationResult> {
    const saved = await this.dependencies.repository.save(agent);
    const skillConfiguration = generateAgentSkillConfiguration(saved);

    try {
      await this.dependencies.skillWriter?.writeSkillConfiguration(saved, skillConfiguration);
    } catch (err) {
      console.error(`Failed to write skill configuration for agent ${saved.agentId}:`, err);
    }

    return {
      agent: saved,
      publicSummary: toAgentPublicSummary(saved),
      skillConfiguration
    };
  }

  private async requireAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<Agent> {
    const agent = await this.dependencies.repository.findById(workspaceId, agentId);

    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    return agent;
  }

  private assertAgentCanBeChanged(agent: Agent): void {
    if (!isAgentSelectable(agent) && agent.status === "deleted") {
      throw new AgentValidationError(["deleted agents cannot be changed"]);
    }
  }

  private validateCreateInput(input: CreateAgentInput): CreateAgentInput {
    return this.validateAgentConfiguration(input);
  }

  private validateUpdateInput(input: UpdateAgentInput): UpdateAgentInput {
    return this.validateAgentConfiguration(input);
  }

  private validateAgentSkillDraft(input: AgentSkillPreviewRequest): AgentSkillPreviewRequest {
    return this.validateAgentConfiguration(input);
  }

  private validateAgentConfiguration<T extends { name?: string; role: string; model: string; instructions: string }>(
    input: T
  ): T {
    const normalized = {
      ...input,
      name: "name" in input ? input.name.trim() : undefined,
      role: input.role.trim(),
      model: input.model.trim(),
      instructions: input.instructions.trim(),
      responsibilities: this.normalizeStringArray((input as any).responsibilities),
      operatingContext: this.normalizeOptionalString((input as any).operatingContext),
      requestedTools: this.normalizeToolReferences((input as any).requestedTools),
      requestedKnowledge: this.normalizeKnowledgeReferences((input as any).requestedKnowledge),
      constraints: this.normalizeStringArray((input as any).constraints),
      escalationRules: this.normalizeStringArray((input as any).escalationRules),
      exampleTasks: this.normalizeStringArray((input as any).exampleTasks)
    };
    const issues: string[] = [];

    if ("name" in input && !normalized.name) {
      issues.push("name is required");
    }

    if (!normalized.role) {
      issues.push("role is required");
    }

    if (!normalized.model) {
      issues.push("model is required");
    }

    if (!normalized.instructions) {
      issues.push("instructions are required");
    }

    if (issues.length > 0) {
      throw new AgentValidationError(issues);
    }

    return normalized as T;
  }

  private async assertSelectableModel(
    workspaceId: EntityId<"workspaceId">,
    modelId: string
  ): Promise<void> {
    const catalog = await this.modelCatalog.listModels(workspaceId);
    const matchingModel = catalog.find((entry) => entry.modelId === modelId);

    if (!matchingModel || !matchingModel.enabled) {
      throw new AgentValidationError(["model must match an enabled catalog model"]);
    }
  }

  private async assertRequestedCapabilities(input: {
    workspaceId: EntityId<"workspaceId">;
    requestedTools?: readonly AgentSkillToolReference[];
    requestedKnowledge?: readonly AgentSkillKnowledgeReference[];
  }): Promise<void> {
    const warnings = await validateRequestedCapabilities(input, {
      tools: this.connectedToolCatalog,
      knowledge: this.knowledgeDocumentCatalog
    });

    const blockingWarnings = warnings.filter((warning) => warning.severity === "blocking");
    if (blockingWarnings.length > 0) {
      throw new AgentValidationError(
        blockingWarnings.map((warning) => `${warning.field}: ${warning.message}`),
        blockingWarnings
      );
    }
  }

  private looksLikeMarkdown(markdown: string, fileName: string | undefined): boolean {
    if (fileName && /\.(md|markdown)$/i.test(fileName)) {
      return true;
    }

    return /(^|\n)#{1,6}\s+\S/.test(markdown) || /(^|\n)(-|\*)\s+\S/.test(markdown);
  }

  private mergeRuntimeConfiguration(
    current: AgentRuntimeConfiguration,
    next: Partial<AgentRuntimeConfiguration>
  ): AgentRuntimeConfiguration {
    return {
      responsibilities: next.responsibilities ?? current.responsibilities,
      operatingContext: next.operatingContext ?? current.operatingContext,
      requestedTools: next.requestedTools ?? current.requestedTools,
      requestedKnowledge: next.requestedKnowledge ?? current.requestedKnowledge,
      constraints: next.constraints ?? current.constraints,
      escalationRules: next.escalationRules ?? current.escalationRules,
      exampleTasks: next.exampleTasks ?? current.exampleTasks
    };
  }

  private cloneRuntimeConfiguration(
    runtimeConfiguration: AgentRuntimeConfiguration
  ): AgentRuntimeConfiguration {
    return {
      responsibilities: [...runtimeConfiguration.responsibilities],
      operatingContext: runtimeConfiguration.operatingContext,
      requestedTools: runtimeConfiguration.requestedTools.map((tool) => ({ ...tool })),
      requestedKnowledge: runtimeConfiguration.requestedKnowledge.map((document) => ({ ...document })),
      constraints: [...runtimeConfiguration.constraints],
      escalationRules: [...runtimeConfiguration.escalationRules],
      exampleTasks: [...runtimeConfiguration.exampleTasks]
    };
  }

  private normalizeStringArray(values: unknown): string[] | undefined {
    if (!Array.isArray(values)) {
      return undefined;
    }

    return values.filter((value): value is string => typeof value === "string");
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private normalizeToolReferences(values: unknown): AgentSkillToolReference[] | undefined {
    return Array.isArray(values)
      ? values
          .filter((value): value is AgentSkillToolReference =>
            typeof value === "object" &&
            value !== null &&
            "name" in value &&
            typeof (value as { name?: unknown }).name === "string"
          )
          .map((value) => ({
            ...("toolId" in value && typeof value.toolId === "string" ? { toolId: value.toolId } : {}),
            name: value.name,
            ...(typeof value.reason === "string" ? { reason: value.reason } : {})
          }))
      : undefined;
  }

  private normalizeKnowledgeReferences(values: unknown): AgentSkillKnowledgeReference[] | undefined {
    return Array.isArray(values)
      ? values
          .filter((value): value is AgentSkillKnowledgeReference =>
            typeof value === "object" &&
            value !== null &&
            "title" in value &&
            typeof (value as { title?: unknown }).title === "string"
          )
          .map((value) => ({
            ...("documentId" in value && typeof value.documentId === "string" ? { documentId: value.documentId } : {}),
            title: value.title,
            ...(typeof value.reason === "string" ? { reason: value.reason } : {})
          }))
      : undefined;
  }

  private toRuntimeAgentDirectoryName(agent: Pick<Agent, "agentId" | "name">): string {
    const slug = agent.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    return `${slug || "agent"}-${agent.agentId}`;
  }
}
