import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createWorkflow, createWorkflowStep } from "../../../modules/workflow-management/domain/workflow.ts";
import {
  FileSystemOpenClawWorkflowMaterializer,
  NoOpOpenClawWorkflowMaterializer
} from "./openclaw-workflow-materializer.ts";

describe("OpenClawWorkflowMaterializer", () => {
  it("materializes published workflow artifacts for container execution", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-workflow-materializer-"));
    const materializer = new FileSystemOpenClawWorkflowMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z");

    try {
      const workflow = createWorkflow(
        "wf-research" as any,
        "workspace-1" as any,
        "Research Pipeline",
        "Run research then write",
        "manual",
        null,
        [
          createWorkflowStep("wfs-1" as any, "workspace-1" as any, "wf-research" as any, "agent-research" as any, "agent", 1),
          createWorkflowStep("wfs-2" as any, "workspace-1" as any, "wf-research" as any, "agent-writer" as any, "agent", 2)
        ]
      );
      workflow.status = "published";

      const agentRefs = new Map([
        ["agent-research", { agentId: "agent-research", openClawAgentId: "research-agent", providerAgentMapping: "openclaw/agent/research-agent" }],
        ["agent-writer", { agentId: "agent-writer", openClawAgentId: "writer-agent", providerAgentMapping: "openclaw/agent/writer-agent" }]
      ]);

      const materialized = await materializer.materializeWorkflow(workflow, agentRefs);

      expect(materialized.providerWorkflowMapping).toBe("openclaw/workflow/wf-research");
      expect(materialized.steps).toHaveLength(2);
      expect(materialized.steps[0]?.openClawAgentId).toBe("research-agent");

      const workflowMetadata = JSON.parse(
        await readFile(join(baseDir, "workspace-1", "wf-research", "workflow.json"), "utf-8")
      );
      expect(workflowMetadata.name).toBe("Research Pipeline");

      const steps = JSON.parse(await readFile(join(baseDir, "workspace-1", "wf-research", "steps.json"), "utf-8"));
      expect(steps[1].openClawAgentId).toBe("writer-agent");

      const workflowsList = JSON.parse(await readFile(join(baseDir, "workspace-1", "workflows.list.json"), "utf-8"));
      expect(workflowsList).toEqual([
        expect.objectContaining({
          id: "wf-research",
          providerWorkflowMapping: "openclaw/workflow/wf-research",
          stepCount: 2
        })
      ]);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("reads materialized workflow back from filesystem", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-workflow-materializer-"));
    const materializer = new FileSystemOpenClawWorkflowMaterializer(baseDir, () => "2026-06-30T00:00:00.000Z");

    try {
      const workflow = createWorkflow(
        "wf-read" as any,
        "workspace-1" as any,
        "Readable Workflow",
        null,
        "manual",
        null,
        [createWorkflowStep("wfs-1" as any, "workspace-1" as any, "wf-read" as any, "agent-research" as any, "agent", 1)]
      );

      await materializer.materializeWorkflow(workflow, new Map([
        ["agent-research", { agentId: "agent-research", openClawAgentId: "research-agent" }]
      ]));

      const loaded = await materializer.getMaterializedWorkflow("workspace-1" as any, "wf-read");
      expect(loaded?.steps).toHaveLength(1);
      expect(loaded?.name).toBe("Readable Workflow");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("performs in-memory materialization successfully without throw", async () => {
    const materializer = new NoOpOpenClawWorkflowMaterializer();
    const workflow = createWorkflow("wf-1" as any, "workspace-1" as any, "X", null);

    const materialized = await materializer.materializeWorkflow(workflow, new Map());
    expect(materialized.workflowId).toBe("wf-1");
    expect(materialized.providerWorkflowMapping).toBe("openclaw/workflow/wf-1");
  });
});
