import type {
  AgentPublicSummary,
  AgentSkillImportAnalysisRequest,
  AgentSkillImportValidationResponse,
  AgentSkillPreviewRequest,
  AgentSkillPreviewResponse
} from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";
import type { ApiPaginationMeta } from "@vcp/shared/contracts/api.ts";
import { createAgent, isAgentSelectable, toAgentPublicSummary, type Agent } from "../domain/agent.ts";
import type { AgentRepository } from "./agent-repository.ts";
import { generateAgentSkillConfiguration } from "./agent-skill-configuration.ts";
import type { AgentSkillWriter } from "./agent-skill-writer.ts";

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
};

export type UpdateAgentInput = {
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
  role: string;
  model: string;
  instructions: string;
};

export type AgentLifecycleDependencies = {
  repository: AgentRepository;
  skillWriter?: AgentSkillWriter;
  now: () => string;
  generateAgentId: () => EntityId<"agentId">;
};

export class AgentValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid agent configuration: ${issues.join(", ")}`);
    this.name = "AgentValidationError";
    this.issues = issues;
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

  constructor(dependencies: AgentLifecycleDependencies) {
    this.dependencies = dependencies;
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

  validateSkillMarkdownImport(
    input: AgentSkillImportAnalysisRequest
  ): AgentSkillImportValidationResponse {
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
      accepted: true,
      fileName: "skill.md"
    };
  }

  async createAgent(input: CreateAgentInput): Promise<AgentMutationResult> {
    const normalized = this.validateCreateInput(input);
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
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return this.saveMutation(agent);
  }

  async updateAgent(input: UpdateAgentInput): Promise<AgentMutationResult> {
    const normalized = this.validateUpdateInput(input);
    const agent = await this.requireAgent(input.workspaceId, input.agentId);
    this.assertAgentCanBeChanged(agent);

    return this.saveMutation({
      ...agent,
      role: normalized.role,
      model: normalized.model,
      instructions: normalized.instructions,
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
      instructions: input.instructions.trim()
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

  private looksLikeMarkdown(markdown: string, fileName: string | undefined): boolean {
    if (fileName && /\.(md|markdown)$/i.test(fileName)) {
      return true;
    }

    return /(^|\n)#{1,6}\s+\S/.test(markdown) || /(^|\n)(-|\*)\s+\S/.test(markdown);
  }
}
