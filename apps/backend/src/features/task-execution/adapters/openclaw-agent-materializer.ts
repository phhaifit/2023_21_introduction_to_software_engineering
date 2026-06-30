import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AgentRuntimeProfile } from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

const execFileAsync = promisify(execFile);

export type OpenClawMaterializedAgent = {
  agentId: string;
  workspaceId: string;
  openClawAgentId: string;
  providerAgentMapping: string;
  artifactDirectoryName: string;
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

export interface OpenClawAgentArtifactMirror {
  mirrorWorkspace(
    workspaceDir: string,
    workspaceId: string,
    profile: AgentRuntimeProfile
  ): Promise<Pick<OpenClawMaterializedAgent, "openClawAgentId" | "providerAgentMapping"> | null>;
}

export class NoOpOpenClawAgentArtifactMirror implements OpenClawAgentArtifactMirror {
  async mirrorWorkspace(): Promise<Pick<OpenClawMaterializedAgent, "openClawAgentId" | "providerAgentMapping"> | null> {
    return null;
  }
}

export class DockerOpenClawAgentArtifactMirror implements OpenClawAgentArtifactMirror {
  private readonly containerName: string;
  private readonly destinationDir: string;

  constructor(containerName: string, destinationDir: string) {
    this.containerName = containerName;
    this.destinationDir = destinationDir.replace(/\/+$/, "");
  }

  async mirrorWorkspace(
    workspaceDir: string,
    workspaceId: string,
    profile: AgentRuntimeProfile
  ): Promise<Pick<OpenClawMaterializedAgent, "openClawAgentId" | "providerAgentMapping"> | null> {
    const workspaceDestination = `${this.destinationDir}/${workspaceId}`;
    const agentWorkspaceDestination = `${workspaceDestination}/${profile.materializationHints.agentDirectoryName}`;
    await execFileAsync("docker", ["exec", this.containerName, "mkdir", "-p", workspaceDestination]);
    await execFileAsync("docker", ["cp", `${workspaceDir}/.`, `${this.containerName}:${workspaceDestination}`]);

    const registered = await this.findRegisteredAgent(agentWorkspaceDestination);
    if (registered) {
      await this.updateIdentity(registered.id, profile);
      return {
        openClawAgentId: registered.id,
        providerAgentMapping: `openclaw/agent/${registered.id}`
      };
    }

    const add = await execFileAsync("docker", [
      "exec",
      this.containerName,
      "openclaw",
      "agents",
      "add",
      profile.materializationHints.agentDirectoryName,
      "--workspace",
      agentWorkspaceDestination,
      "--agent-dir",
      `/home/node/.openclaw/agents/${profile.materializationHints.agentDirectoryName}/agent`,
      "--model",
      profile.model,
      "--non-interactive",
      "--json"
    ]);
    const parsed = JSON.parse(add.stdout);
    const openClawAgentId = String(parsed.agentId || profile.materializationHints.agentDirectoryName);
    await this.updateIdentity(openClawAgentId, profile);
    return {
      openClawAgentId,
      providerAgentMapping: `openclaw/agent/${openClawAgentId}`
    };
  }

  private async findRegisteredAgent(workspacePath: string): Promise<{ id: string } | null> {
    const list = await execFileAsync("docker", ["exec", this.containerName, "openclaw", "agents", "list", "--json"]);
    const parsed = JSON.parse(list.stdout);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const normalizedWorkspace = normalizeContainerPath(workspacePath);
    const match = parsed.find((agent) => normalizeContainerPath(agent?.workspace) === normalizedWorkspace);
    return match?.id ? { id: String(match.id) } : null;
  }

  private async updateIdentity(agentId: string, profile: AgentRuntimeProfile): Promise<void> {
    await execFileAsync("docker", [
      "exec",
      this.containerName,
      "openclaw",
      "agents",
      "set-identity",
      "--agent",
      agentId,
      "--name",
      profile.name,
      "--json"
    ]);
  }
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
  private readonly mirror: OpenClawAgentArtifactMirror;
  private readonly materialized = new Map<string, OpenClawMaterializedAgent>();

  constructor(
    baseDir: string,
    now: () => string = () => new Date().toISOString(),
    mirror: OpenClawAgentArtifactMirror = new NoOpOpenClawAgentArtifactMirror()
  ) {
    this.baseDir = baseDir;
    this.now = now;
    this.mirror = mirror;
  }

  async materializeAgent(profile: AgentRuntimeProfile): Promise<OpenClawMaterializedAgent> {
    const openClawAgentId = profile.materializationHints.agentDirectoryName;
    const workspaceDir = join(this.baseDir, profile.workspaceId);
    const agentDir = join(workspaceDir, openClawAgentId);
    let materialized: OpenClawMaterializedAgent = {
      agentId: profile.agentId,
      workspaceId: profile.workspaceId,
      openClawAgentId,
      providerAgentMapping: `openclaw/agent/${openClawAgentId}`,
      artifactDirectoryName: openClawAgentId,
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
    const registered = await this.mirror.mirrorWorkspace(workspaceDir, profile.workspaceId, profile);
    if (registered) {
      materialized = {
        ...materialized,
        openClawAgentId: registered.openClawAgentId,
        providerAgentMapping: registered.providerAgentMapping,
        artifactDirectoryName: profile.materializationHints.agentDirectoryName
      };
      this.materialized.set(this.key(profile.workspaceId, profile.agentId), materialized);
      await this.writeAgentsList(workspaceDir, profile.workspaceId);
      await this.mirror.mirrorWorkspace(workspaceDir, profile.workspaceId, profile);
    }
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
    const currentPlatformAgentIds = new Set(current.map((agent) => agent.agentId));
    const merged = new Map<string, Record<string, unknown>>();

    for (const item of existing) {
      if (
        typeof item.id === "string" &&
        !currentPlatformAgentIds.has(String(item.platformAgentId || ""))
      ) {
        merged.set(item.id, item);
      }
    }

    for (const agent of current) {
      merged.set(agent.openClawAgentId, {
        id: agent.openClawAgentId,
        platformAgentId: agent.agentId,
        providerAgentMapping: agent.providerAgentMapping,
        status: "enabled",
        skillFile: `${agent.artifactDirectoryName}/skill.md`,
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

function normalizeContainerPath(value: unknown): string {
  return String(value || "").replace(/\/+$/, "");
}
