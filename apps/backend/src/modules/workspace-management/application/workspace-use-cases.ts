import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type {
  WorkspaceSummaryDto,
  WorkspaceDetailDto,
  WorkspaceDeleteAckDto
} from "@vcp/shared/contracts/workspace-management.ts";
import type { DomainEvent } from "@vcp/shared/contracts/events.ts";
import type { EventBus } from "../../../shared/events/event-bus.ts";
import type { WorkspaceRepository } from "./workspace-repository.ts";
import {
  createWorkspace,
  isWorkspaceDeletable,
  isWorkspaceAccessible,
  toWorkspaceSummaryDto,
  toWorkspaceDetailDto
} from "../domain/workspace.ts";

// ---------------------------------------------------------------------------
// Error types — owned by this module
// ---------------------------------------------------------------------------

export class WorkspaceNotFoundError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`);
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspaceAccessDeniedError extends Error {
  constructor() {
    super("Access to this workspace is not permitted");
    this.name = "WorkspaceAccessDeniedError";
  }
}

export class WorkspaceValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: string[]) {
    super(`Workspace validation failed: ${issues.join(", ")}`);
    this.name = "WorkspaceValidationError";
    this.issues = issues;
  }
}

export class WorkspaceCannotBeDeletedError extends Error {
  constructor(status: string) {
    super(`Cannot delete workspace with status: ${status}`);
    this.name = "WorkspaceCannotBeDeletedError";
  }
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type WorkspaceUseCaseDeps = {
  repository: WorkspaceRepository;
  // Used only for aggregate read-model counts (agent/workflow/tool counts).
  // This is an acceptable cross-table read in a modular monolith via the shared
  // @vcp/database client — no private module code is imported.
  prisma: PrismaClient;
  eventBus: EventBus;
  now: () => string;
  generateWorkspaceId: () => EntityId<"workspaceId">;
  generateEventId: () => EntityId<"eventId">;
};

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

export class WorkspaceUseCases {
  private readonly deps: WorkspaceUseCaseDeps;

  constructor(deps: WorkspaceUseCaseDeps) {
    this.deps = deps;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listWorkspaces(userId: EntityId<"userId">): Promise<WorkspaceSummaryDto[]> {
    const workspaces = await this.deps.repository.listAllActive();
    return Promise.all(workspaces.map(async (workspace) => {
      const isOwner = workspace.userId === userId;
      const member = isOwner
        ? null
        : await this.deps.prisma.workspaceMember.findFirst({
            where: { workspaceId: workspace.workspaceId, userId, status: "active" }
          });

      return {
        ...toWorkspaceSummaryDto(workspace),
        accessRestricted: !isOwner && !member,
        membershipRole: isOwner ? "host" : member?.role
      };
    }));
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  async getWorkspaceDetail(
    workspaceId: EntityId<"workspaceId">,
    userId: EntityId<"userId">
  ): Promise<WorkspaceDetailDto> {
    const workspace = await this.requireAccessibleWorkspace(workspaceId, userId);

    // Read-model aggregate counts. We query @vcp/database directly (shared DB
    // layer) — we do NOT import any other module's private service or repository.
    const [agentCount, workflowCount, toolCount] = await Promise.all([
      this.deps.prisma.agent.count({
        where: { workspaceId, status: { not: "deleted" } }
      }),
      this.deps.prisma.workflow.count({
        where: { workspaceId, status: { not: "archived" } }
      }),
      this.deps.prisma.toolConnection.count({
        where: { workspaceId, status: "connected" }
      })
    ]);

    return toWorkspaceDetailDto(workspace, { agentCount, workflowCount, toolCount });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createWorkspace(input: {
    userId: EntityId<"userId">;
    name: string;
    plan: SubscriptionPlan;
    subscriptionId?: EntityId<"subscriptionId">;
  }): Promise<WorkspaceSummaryDto> {
    const name = input.name.trim();
    const issues: string[] = [];
    if (!name) issues.push("name is required");
    if (name.length > 100) issues.push("name must be 100 characters or fewer");
    if (issues.length > 0) throw new WorkspaceValidationError(issues);

    const timestamp = this.deps.now();
    const workspace = createWorkspace({
      workspaceId: this.deps.generateWorkspaceId(),
      userId: input.userId,
      name,
      plan: input.plan,
      subscriptionId: input.subscriptionId,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const saved = await this.deps.repository.save(workspace);

    // Emit event — worker subscribes and provisions OpenClaw async.
    // HTTP returns immediately with status "pending".
    const event: DomainEvent<"workspace.provisioning_requested"> = {
      name: "workspace.provisioning_requested",
      eventId: this.deps.generateEventId(),
      occurredAt: timestamp,
      payload: {
        workspaceId: saved.workspaceId,
        subscriptionId: (saved.subscriptionId ?? "") as EntityId<"subscriptionId">,
        plan: saved.plan
      }
    };
    await this.deps.eventBus.publish(event);

    return toWorkspaceSummaryDto(saved);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteWorkspace(
    workspaceId: EntityId<"workspaceId">,
    userId: EntityId<"userId">
  ): Promise<WorkspaceDeleteAckDto> {
    const workspace = await this.requireAccessibleWorkspace(workspaceId, userId);

    if (!isWorkspaceDeletable(workspace)) {
      throw new WorkspaceCannotBeDeletedError(workspace.status);
    }

    const timestamp = this.deps.now();
    await this.deps.repository.updateStatus(workspaceId, { status: "stopping" }, timestamp);

    // Emit event — worker subscribes and cleans up OpenClaw runtime async.
    const event: DomainEvent<"workspace.deleted"> = {
      name: "workspace.deleted",
      eventId: this.deps.generateEventId(),
      occurredAt: timestamp,
      payload: {
        workspaceId,
        deletedBy: userId
      }
    };
    await this.deps.eventBus.publish(event);

    return { workspaceId, status: "stopping" };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async requireAccessibleWorkspace(
    workspaceId: EntityId<"workspaceId">,
    userId: EntityId<"userId">
  ) {
    const workspace = await this.deps.repository.findById(workspaceId);
    if (!workspace || !isWorkspaceAccessible(workspace)) {
      throw new WorkspaceNotFoundError(workspaceId);
    }

    const isOwner = workspace.userId === userId;
    if (!isOwner) {
      // Check membership via shared @vcp/database (not a private module import)
      const member = await this.deps.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId, status: "active" }
      });
      if (!member) throw new WorkspaceAccessDeniedError();
    }

    return workspace;
  }
}
