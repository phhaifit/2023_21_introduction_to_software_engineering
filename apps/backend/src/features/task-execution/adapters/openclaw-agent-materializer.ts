import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentRuntimeProfile } from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type OpenClawMaterializedAgent = {
  agentId: string;
  workspaceId: string;
  openClawAgentId: string;
  providerAgentMapping: string;
  materializedAt: string;
  profileUpdatedAt: string;
};

export interface OpenClawAgentMaterializer {
  materializeAgent(profile: AgentRuntimeProfile): Promise<OpenClawMaterializedAgent | null>;
  getMaterializedAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId"> | string
  ): Promise<OpenClawMaterializedAgent | null>;
}

export class NoOpOpenClawAgentMaterializer implements OpenClawAgentMaterializer {
  async materializeAgent(): Promise<OpenClawMaterializedAgent | null> {
    return null;
  }

  async getMaterializedAgent(): Promise<OpenClawMaterializedAgent | null> {
    return null;
  }
}

export class FileSystemOpenClawAgentMaterializer implements OpenClawAgentMaterializer {
  private readonly baseDir: string;
  private readonly now: () => string;
  private readonly materialized = new Map<string, OpenClawMaterializedAgent>();

  constructor(baseDir: string, now: () => string = () => new Date().toISOString()) {
    this.baseDir = baseDir;
    this.now = now;
  }

  async materializeAgent(profile: AgentRuntimeProfile): Promise<OpenClawMaterializedAgent> {
    const openClawAgentId = profile.materializationHints.agentDirectoryName;
    const workspaceDir = join(this.baseDir, profile.workspaceId);
    const agentDir = join(workspaceDir, openClawAgentId);
    const materialized: OpenClawMaterializedAgent = {
      agentId: profile.agentId,
      workspaceId: profile.workspaceId,
      openClawAgentId,
      providerAgentMapping: `openclaw/agent/${openClawAgentId}`,
      materializedAt: this.now(),
      profileUpdatedAt: profile.updatedAt
    };

    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, profile.materializationHints.skillFileName), profile.skillMarkdown, "utf-8");
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify(
        {
          id: openClawAgentId,
          platformAgentId: profile.agentId,
          workspaceId: profile.workspaceId,
          name: profile.name,
          role: profile.role,
          model: profile.model,
          status: profile.status,
          skillFile: profile.materializationHints.skillFileName,
          profileVersion: profile.materializationHints.profileVersion,
          profileUpdatedAt: profile.updatedAt,
          materializedAt: materialized.materializedAt
        },
        null,
        2
      ),
      "utf-8"
    );

    this.materialized.set(this.key(profile.workspaceId, profile.agentId), materialized);
    await this.writeAgentsList(workspaceDir, profile.workspaceId);
    return materialized;
  }

  async getMaterializedAgent(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId"> | string
  ): Promise<OpenClawMaterializedAgent | null> {
    return this.materialized.get(this.key(workspaceId, agentId)) ?? null;
  }

  private async writeAgentsList(workspaceDir: string, workspaceId: string): Promise<void> {
    const existing = await this.readAgentsList(workspaceDir);
    const current = Array.from(this.materialized.values()).filter((agent) => agent.workspaceId === workspaceId);
    const merged = new Map<string, Record<string, unknown>>();

    for (const item of existing) {
      if (typeof item.id === "string") {
        merged.set(item.id, item);
      }
    }

    for (const agent of current) {
      merged.set(agent.openClawAgentId, {
        id: agent.openClawAgentId,
        platformAgentId: agent.agentId,
        providerAgentMapping: agent.providerAgentMapping,
        status: "enabled",
        skillFile: `${agent.openClawAgentId}/skill.md`,
        profileUpdatedAt: agent.profileUpdatedAt,
        materializedAt: agent.materializedAt
      });
    }

    await writeFile(
      join(workspaceDir, "agents.list.json"),
      JSON.stringify(Array.from(merged.values()), null, 2),
      "utf-8"
    );
  }

  private async readAgentsList(workspaceDir: string): Promise<Array<Record<string, unknown>>> {
    try {
      const raw = await readFile(join(workspaceDir, "agents.list.json"), "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  }

  private key(workspaceId: EntityId<"workspaceId"> | string, agentId: EntityId<"agentId"> | string): string {
    return `${workspaceId}:${agentId}`;
  }
}
