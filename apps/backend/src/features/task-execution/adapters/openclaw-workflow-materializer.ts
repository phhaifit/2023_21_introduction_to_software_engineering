import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Workflow } from "../../../modules/workflow-management/domain/workflow.ts";

const execFileAsync = promisify(execFile);

export type MaterializedWorkflowStep = {
  workflowStepId: string;
  stepOrder: number;
  stepType: "agent" | "approval";
  agentId: string | null;
  openClawAgentId?: string;
  providerAgentMapping?: string;
  nextSteps?: Array<{ targetStepId: string; condition?: string | null }> | null;
  inputMapping?: Record<string, string> | null;
};

export type OpenClawMaterializedWorkflow = {
  workflowId: string;
  workspaceId: string;
  openClawWorkflowId: string;
  providerWorkflowMapping: string;
  name: string;
  description: string | null;
  steps: MaterializedWorkflowStep[];
  materializedAt: string;
};

export type WorkflowStepAgentRef = {
  agentId: string;
  openClawAgentId?: string;
  providerAgentMapping?: string;
};

export interface OpenClawWorkflowArtifactMirror {
  mirrorWorkflowWorkspace(workspaceDir: string, workspaceId: string): Promise<void>;
}

export class NoOpOpenClawWorkflowArtifactMirror implements OpenClawWorkflowArtifactMirror {
  async mirrorWorkflowWorkspace(): Promise<void> {}
}

export class DockerOpenClawWorkflowArtifactMirror implements OpenClawWorkflowArtifactMirror {
  private readonly containerName: string;
  private readonly destinationDir: string;

  constructor(containerName: string, destinationDir: string) {
    this.containerName = containerName;
    this.destinationDir = destinationDir.replace(/\/+$/, "");
  }

  async mirrorWorkflowWorkspace(workspaceDir: string, workspaceId: string): Promise<void> {
    const workspaceDestination = `${this.destinationDir}/${workspaceId}`;
    await execFileAsync("docker", ["exec", this.containerName, "mkdir", "-p", workspaceDestination]);
    await execFileAsync("docker", ["cp", `${workspaceDir}/.`, `${this.containerName}:${workspaceDestination}`]);
  }
}

export interface OpenClawWorkflowMaterializer {
  materializeWorkflow(
    workflow: Workflow,
    agentRefs: Map<string, WorkflowStepAgentRef>
  ): Promise<OpenClawMaterializedWorkflow>;
  getMaterializedWorkflow(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId"> | string
  ): Promise<OpenClawMaterializedWorkflow | null>;
}

export class NoOpOpenClawWorkflowMaterializer implements OpenClawWorkflowMaterializer {
  async materializeWorkflow(
    workflow: Workflow,
    agentRefs: Map<string, WorkflowStepAgentRef>
  ): Promise<OpenClawMaterializedWorkflow> {
    // In-memory materialization — no filesystem or Docker required.
    // Used in dev environments without OPENCLAW_WORKFLOW_WORKSPACE_DIR configured.
    const sortedSteps = [...(workflow.steps ?? [])].sort(
      (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
    );
    const steps: MaterializedWorkflowStep[] = sortedSteps.map((step) => {
      const agentRef = step.agentId ? agentRefs.get(step.agentId as string) : undefined;
      return {
        workflowStepId: step.workflowStepId as string,
        stepOrder: step.stepOrder,
        stepType: step.stepType,
        agentId: step.agentId as string | null,
        openClawAgentId: agentRef?.openClawAgentId,
        providerAgentMapping: agentRef?.providerAgentMapping,
        nextSteps: step.nextSteps ?? null,
        inputMapping: step.inputMapping ?? null
      };
    });
    return {
      workflowId: workflow.workflowId as string,
      workspaceId: workflow.workspaceId as string,
      openClawWorkflowId: workflow.workflowId as string,
      providerWorkflowMapping: `openclaw/workflow/${workflow.workflowId}`,
      name: workflow.name,
      description: workflow.description,
      steps,
      materializedAt: new Date().toISOString()
    };
  }

  async getMaterializedWorkflow(): Promise<OpenClawMaterializedWorkflow | null> {
    return null;
  }
}

export class FileSystemOpenClawWorkflowMaterializer implements OpenClawWorkflowMaterializer {
  private readonly baseDir: string;
  private readonly now: () => string;
  private readonly mirror: OpenClawWorkflowArtifactMirror;

  constructor(
    baseDir: string,
    now: () => string = () => new Date().toISOString(),
    mirror: OpenClawWorkflowArtifactMirror = new NoOpOpenClawWorkflowArtifactMirror()
  ) {
    this.baseDir = baseDir;
    this.now = now;
    this.mirror = mirror;
  }

  async materializeWorkflow(
    workflow: Workflow,
    agentRefs: Map<string, WorkflowStepAgentRef>
  ): Promise<OpenClawMaterializedWorkflow> {
    const openClawWorkflowId = workflow.workflowId as string;
    const workspaceDir = join(this.baseDir, workflow.workspaceId as string);
    const workflowDir = join(workspaceDir, openClawWorkflowId);
    const materializedAt = this.now();

    const sortedSteps = [...(workflow.steps ?? [])].sort(
      (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
    );

    const steps: MaterializedWorkflowStep[] = sortedSteps.map((step) => {
      const agentRef = step.agentId ? agentRefs.get(step.agentId as string) : undefined;
      return {
        workflowStepId: step.workflowStepId as string,
        stepOrder: step.stepOrder,
        stepType: step.stepType,
        agentId: step.agentId as string | null,
        openClawAgentId: agentRef?.openClawAgentId,
        providerAgentMapping: agentRef?.providerAgentMapping,
        nextSteps: step.nextSteps ?? null,
        inputMapping: step.inputMapping ?? null
      };
    });

    const materialized: OpenClawMaterializedWorkflow = {
      workflowId: workflow.workflowId as string,
      workspaceId: workflow.workspaceId as string,
      openClawWorkflowId,
      providerWorkflowMapping: `openclaw/workflow/${openClawWorkflowId}`,
      name: workflow.name,
      description: workflow.description,
      steps,
      materializedAt
    };

    await mkdir(workflowDir, { recursive: true });
    await writeFile(
      join(workflowDir, "workflow.json"),
      JSON.stringify(
        {
          id: openClawWorkflowId,
          platformWorkflowId: workflow.workflowId,
          workspaceId: workflow.workspaceId,
          name: workflow.name,
          description: workflow.description,
          triggerType: workflow.triggerType,
          materializedAt
        },
        null,
        2
      ),
      "utf-8"
    );
    await writeFile(join(workflowDir, "steps.json"), JSON.stringify(steps, null, 2), "utf-8");

    await this.writeWorkflowsList(workspaceDir, workflow.workspaceId as string, materialized);
    await this.mirror.mirrorWorkflowWorkspace(workspaceDir, workflow.workspaceId as string);

    return materialized;
  }

  async getMaterializedWorkflow(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId"> | string
  ): Promise<OpenClawMaterializedWorkflow | null> {
    const workflowDir = join(this.baseDir, workspaceId as string, workflowId as string);

    try {
      const workflowMetadata = JSON.parse(await readFile(join(workflowDir, "workflow.json"), "utf-8"));
      const steps = JSON.parse(await readFile(join(workflowDir, "steps.json"), "utf-8")) as MaterializedWorkflowStep[];
      const openClawWorkflowId = String(workflowMetadata.id || workflowId);

      return {
        workflowId: String(workflowMetadata.platformWorkflowId || workflowId),
        workspaceId: String(workflowMetadata.workspaceId || workspaceId),
        openClawWorkflowId,
        providerWorkflowMapping: `openclaw/workflow/${openClawWorkflowId}`,
        name: String(workflowMetadata.name || workflowId),
        description: workflowMetadata.description ?? null,
        steps: Array.isArray(steps) ? steps : [],
        materializedAt: String(workflowMetadata.materializedAt || this.now())
      };
    } catch {
      return null;
    }
  }

  private async writeWorkflowsList(
    workspaceDir: string,
    workspaceId: string,
    workflow: OpenClawMaterializedWorkflow
  ): Promise<void> {
    const existing = await this.readWorkflowsList(workspaceDir);
    const merged = new Map<string, Record<string, unknown>>();

    for (const item of existing) {
      if (typeof item.id === "string" && item.id !== workflow.openClawWorkflowId) {
        merged.set(item.id, item);
      }
    }

    merged.set(workflow.openClawWorkflowId, {
      id: workflow.openClawWorkflowId,
      platformWorkflowId: workflow.workflowId,
      providerWorkflowMapping: workflow.providerWorkflowMapping,
      name: workflow.name,
      description: workflow.description,
      stepCount: workflow.steps.length,
      materializedAt: workflow.materializedAt
    });

    await writeFile(
      join(workspaceDir, "workflows.list.json"),
      JSON.stringify(Array.from(merged.values()), null, 2),
      "utf-8"
    );
  }

  private async readWorkflowsList(workspaceDir: string): Promise<Array<Record<string, unknown>>> {
    try {
      const raw = await readFile(join(workspaceDir, "workflows.list.json"), "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  }
}
