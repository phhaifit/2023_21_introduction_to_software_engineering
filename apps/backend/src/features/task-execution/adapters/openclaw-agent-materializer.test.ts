import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AgentRuntimeProfile } from "@vcp/shared/contracts/agent-management.ts";
import {
  FileSystemOpenClawAgentMaterializer,
  NoOpOpenClawAgentMaterializer,
  type OpenClawAgentArtifactMirror
} from "./openclaw-agent-materializer.ts";

describe("OpenClawAgentMaterializer", () => {
  it("materializes an enabled runtime profile into OpenClaw-facing agent artifacts", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-agent-materializer-"));
    const materializer = new FileSystemOpenClawAgentMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z");

    try {
      const materialized = await materializer.materializeAgent(createRuntimeProfile());

      expect(materialized).toEqual({
        agentId: "agent-research",
        workspaceId: "workspace-1",
        openClawAgentId: "agent-research",
        providerAgentMapping: "openclaw/agent/agent-research",
        artifactDirectoryName: "agent-research",
        materializedAt: "2026-06-30T00:00:00.000Z",
        profileUpdatedAt: "2026-06-29T00:00:00.000Z"
      });

      await expect(readFile(join(baseDir, "workspace-1", "agent-research", "skill.md"), "utf-8"))
        .resolves
        .toBe("# Research Agent\n\nUse verified sources.");

      const metadata = JSON.parse(
        await readFile(join(baseDir, "workspace-1", "agent-research", "agent.json"), "utf-8")
      );
      expect(metadata).toMatchObject({
        id: "agent-research",
        platformAgentId: "agent-research",
        name: "Research Agent",
        skillFile: "skill.md"
      });

      const agentsList = JSON.parse(await readFile(join(baseDir, "workspace-1", "agents.list.json"), "utf-8"));
      expect(agentsList).toEqual([
        expect.objectContaining({
          id: "agent-research",
          platformAgentId: "agent-research",
          providerAgentMapping: "openclaw/agent/agent-research",
          skillFile: "agent-research/skill.md"
        })
      ]);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("does not provide native OpenClaw IDs when materialization is not configured", async () => {
    const materializer = new NoOpOpenClawAgentMaterializer();

    await expect(materializer.materializeAgent(createRuntimeProfile())).resolves.toBeNull();
    await expect(materializer.getMaterializedAgent("workspace-1" as any, "agent-research")).resolves.toBeNull();
  });

  it("mirrors workspace artifacts after filesystem materialization succeeds", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-agent-materializer-"));
    const calls: Array<{ workspaceDir: string; workspaceId: string }> = [];
    const materializer = new FileSystemOpenClawAgentMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z", {
      async mirrorWorkspace(workspaceDir, workspaceId) {
        calls.push({ workspaceDir, workspaceId });
        return null;
      }
    });

    try {
      await materializer.materializeAgent(createRuntimeProfile());

      expect(calls).toEqual([
        {
          workspaceDir: join(baseDir, "workspace-1"),
          workspaceId: "workspace-1"
        }
      ]);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("uses the registered native OpenClaw agent ID returned by the mirror", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-agent-materializer-"));
    const calls: string[] = [];
    const materializer = new FileSystemOpenClawAgentMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z", {
      async mirrorWorkspace(_workspaceDir, workspaceId) {
        calls.push(workspaceId);
        return {
          openClawAgentId: "research-agent",
          providerAgentMapping: "openclaw/agent/research-agent"
        };
      }
    });

    try {
      const materialized = await materializer.materializeAgent(createRuntimeProfile());

      expect(materialized.openClawAgentId).toBe("research-agent");
      expect(materialized.providerAgentMapping).toBe("openclaw/agent/research-agent");
      expect(calls).toEqual(["workspace-1"]);
      const agentsList = JSON.parse(await readFile(join(baseDir, "workspace-1", "agents.list.json"), "utf-8"));
      expect(agentsList).toEqual([
        expect.objectContaining({
          id: "research-agent",
          providerAgentMapping: "openclaw/agent/research-agent"
        })
      ]);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("reuses materialized mappings when the runtime profile is unchanged", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-agent-materializer-"));
    let calls = 0;
    const materializer = new FileSystemOpenClawAgentMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z", {
      async mirrorWorkspace() {
        calls += 1;
        return {
          openClawAgentId: "research-agent",
          providerAgentMapping: "openclaw/agent/research-agent"
        };
      }
    });

    try {
      const first = await materializer.materializeAgent(createRuntimeProfile());
      const second = await materializer.materializeAgent(createRuntimeProfile());

      expect(second).toBe(first);
      expect(calls).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("coalesces concurrent materialization requests for the same profile", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-agent-materializer-"));
    let calls = 0;
    let releaseMirror!: () => void;
    const mirrorGate = new Promise<void>((resolve) => {
      releaseMirror = resolve;
    });
    const materializer = new FileSystemOpenClawAgentMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z", {
      async mirrorWorkspace() {
        calls += 1;
        await mirrorGate;
        return {
          openClawAgentId: "research-agent",
          providerAgentMapping: "openclaw/agent/research-agent"
        };
      }
    });

    try {
      const profile = createRuntimeProfile();
      const first = materializer.materializeAgent(profile);
      const second = materializer.materializeAgent(profile);
      releaseMirror();
      const results = await Promise.all([first, second]);

      expect(results[1]).toBe(results[0]);
      expect(calls).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("retries materialization after a mirror failure", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-agent-materializer-"));
    let calls = 0;
    const mirror: OpenClawAgentArtifactMirror = {
      async mirrorWorkspace() {
        calls += 1;
        if (calls === 1) {
          throw new Error("mirror failed");
        }
        return {
          openClawAgentId: "research-agent",
          providerAgentMapping: "openclaw/agent/research-agent"
        };
      }
    };
    const materializer = new FileSystemOpenClawAgentMaterializer(
      baseDir,
      () => "2026-06-30T00:00:00.000Z",
      mirror
    );

    try {
      await expect(materializer.materializeAgent(createRuntimeProfile())).rejects.toThrow("mirror failed");
      await expect(materializer.getMaterializedAgent("workspace-1" as any, "agent-research")).resolves.toBeNull();

      const materialized = await materializer.materializeAgent(createRuntimeProfile());

      expect(materialized.openClawAgentId).toBe("research-agent");
      expect(calls).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});

function createRuntimeProfile(): AgentRuntimeProfile {
  return {
    agentId: "agent-research" as any,
    workspaceId: "workspace-1" as any,
    name: "Research Agent",
    role: "Research",
    model: "google/gemini-3.1-flash-lite",
    instructions: "Use verified sources.",
    status: "enabled",
    runnable: true,
    updatedAt: "2026-06-29T00:00:00.000Z",
    runtimeConfiguration: {
      responsibilities: [],
      requestedTools: [],
      requestedKnowledge: [],
      constraints: [],
      escalationRules: [],
      exampleTasks: []
    },
    skillMarkdown: "# Research Agent\n\nUse verified sources.",
    materializationHints: {
      profileVersion: "agent-runtime-profile.v1",
      runtimeOwner: "task-orchestration-openclaw",
      agentDirectoryName: "agent-research",
      skillFileName: "skill.md",
      requiresCurrentToolResolution: false,
      requiresCurrentKnowledgeResolution: false
    }
  };
}
