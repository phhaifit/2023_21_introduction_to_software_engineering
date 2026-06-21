import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";
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

  async listAgents(workspaceId: EntityId<"workspaceId">): Promise<AgentListItem[]> {
    const agents = await this.dependencies.repository.listByWorkspace(workspaceId, {
      statuses: ["enabled", "disabled"]
    });

    return agents.map((agent) => ({
      ...toAgentPublicSummary(agent),
      createdAt: agent.createdAt
    }));
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

  private validateAgentConfiguration<T extends CreateAgentInput | UpdateAgentInput>(input: T): T {
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
}
