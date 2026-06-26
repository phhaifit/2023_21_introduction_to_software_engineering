import type { AgentModelCatalogEntry } from "@vcp/shared/contracts/agent-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type AgentModelCatalogPort = {
  listModels(workspaceId: EntityId<"workspaceId">): Promise<AgentModelCatalogEntry[]>;
};

export const DEMO_AGENT_MODEL_CATALOG: readonly AgentModelCatalogEntry[] = [
  {
    providerId: "gemini",
    modelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    capabilities: ["text-generation", "structured-output", "tool-use"],
    tier: "demo",
    enabled: true
  },
  {
    providerId: "gemini",
    modelId: "gemini-2.5-flash-lite",
    displayName: "Gemini 2.5 Flash Lite",
    capabilities: ["text-generation", "low-latency"],
    tier: "demo",
    enabled: true
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/owl-alpha",
    displayName: "OpenRouter Owl Alpha",
    capabilities: ["text-generation", "fallback"],
    tier: "free",
    enabled: true
  }
] as const;

export class StaticAgentModelCatalog implements AgentModelCatalogPort {
  private readonly entries: readonly AgentModelCatalogEntry[];

  constructor(entries: readonly AgentModelCatalogEntry[] = DEMO_AGENT_MODEL_CATALOG) {
    this.entries = entries.map((entry) => ({
      ...entry,
      capabilities: [...entry.capabilities]
    }));
  }

  async listModels(_workspaceId: EntityId<"workspaceId">): Promise<AgentModelCatalogEntry[]> {
    return this.entries.map((entry) => ({
      ...entry,
      capabilities: [...entry.capabilities]
    }));
  }
}
