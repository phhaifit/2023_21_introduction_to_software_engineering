import type { Request, Response } from "express";

import { encodeWorkspaceCursor } from "./workspace-cursor.ts";
import {
  entitlementDeniedError,
  forbiddenError,
  idempotencyConflictError,
  lifecycleConflictError,
  notFoundError,
  unavailableError,
  validationError
} from "./workspace-http-errors.ts";
import type { WorkspaceHttpDependencies } from "./workspace-http-dependencies.ts";
import {
  parseCreateWorkspaceRequestBody,
  parseIdempotencyKey,
  parseListWorkspacesQuery,
  parseWorkspaceId,
  rejectDetailQuery,
  rejectWorkspaceDeleteBody,
  requireWorkspaceActor
} from "./workspace-request-validation.ts";
import {
  mapWorkspaceDetail,
  mapWorkspaceSummary,
  sendWorkspaceApiFailure,
  sendWorkspaceApiSuccess,
  sendWorkspaceCursorApiSuccess
} from "./workspace-response-mapper.ts";

export class WorkspaceController {
  private readonly dependencies: WorkspaceHttpDependencies;

  constructor(dependencies: WorkspaceHttpDependencies) {
    this.dependencies = dependencies;
  }

  async list(request: Request, response: Response): Promise<void> {
    await this.handle(request, response, async () => {
      const actor = requireWorkspaceActor(request);
      const query = parseListWorkspacesQuery(request.query);
      const result = await this.dependencies.listWorkspaces.execute({
        actorUserId: actor.userId,
        cursor: query.cursor,
        limit: query.limit
      });

      sendWorkspaceCursorApiSuccess(
        request,
        response,
        result.workspaces.map(mapWorkspaceSummary),
        {
          nextCursor: encodeWorkspaceCursor(result.nextCursor),
          hasMore: result.hasMore
        }
      );
    });
  }

  async create(request: Request, response: Response): Promise<void> {
    await this.handle(request, response, async () => {
      const actor = requireWorkspaceActor(request);
      const idempotencyKey = parseIdempotencyKey(request);
      const body = parseCreateWorkspaceRequestBody(request.body);
      const result = await this.dependencies.createWorkspace.execute({
        actorUserId: actor.userId,
        idempotencyKey,
        name: body.name,
        requestedProfile: body.requestedProfile,
        bootstrapTtlSeconds: this.dependencies.bootstrapTtlSeconds
      });

      switch (result.kind) {
        case "accepted":
          sendWorkspaceApiSuccess(request, response, 202, result.response);
          return;
        case "replayed":
          sendWorkspaceApiSuccess(request, response, 202, result.response);
          return;
        case "idempotency_conflict":
          throw idempotencyConflictError();
        case "entitlement_denied":
          throw entitlementDeniedError(result.message);
        case "entitlement_unavailable":
          throw unavailableError();
        case "validation_failed":
          throw validationError(result.message);
      }
    });
  }

  async detail(request: Request, response: Response): Promise<void> {
    await this.handle(request, response, async () => {
      const actor = requireWorkspaceActor(request);
      rejectDetailQuery(request.query);
      const workspaceId = parseWorkspaceId(request.params.workspaceId);
      const result = await this.dependencies.getWorkspaceDetail.execute({
        actorUserId: actor.userId,
        workspaceId
      });

      switch (result.kind) {
        case "found":
          sendWorkspaceApiSuccess(request, response, 200, mapWorkspaceDetail(result.workspace));
          return;
        case "forbidden":
          throw forbiddenError();
        case "unavailable":
          throw unavailableError();
        case "not_found":
          throw notFoundError();
      }
    });
  }

  async delete(request: Request, response: Response): Promise<void> {
    await this.handle(request, response, async () => {
      const actor = requireWorkspaceActor(request);
      const idempotencyKey = parseIdempotencyKey(request);
      const workspaceId = parseWorkspaceId(request.params.workspaceId);
      rejectDetailQuery(request.query);
      rejectWorkspaceDeleteBody(request.body);

      const result = await this.dependencies.deleteWorkspace.execute({
        actorUserId: actor.userId,
        workspaceId,
        idempotencyKey,
        priorRuntimeOutcomeReconciled:
          this.dependencies.deleteFailedRetryReconciled === true
      });

      switch (result.kind) {
        case "accepted":
          sendWorkspaceApiSuccess(request, response, 202, result.response);
          return;
        case "replayed":
          sendWorkspaceApiSuccess(request, response, 202, result.response);
          return;
        case "idempotency_conflict":
          throw idempotencyConflictError();
        case "lifecycle_conflict":
          throw lifecycleConflictError();
        case "access_denied":
          throw forbiddenError();
        case "unavailable":
          throw unavailableError();
        case "not_found":
          throw notFoundError();
      }
    });
  }

  private async handle(
    request: Request,
    response: Response,
    action: () => Promise<void>
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      sendWorkspaceApiFailure(request, response, error);
    }
  }
}
