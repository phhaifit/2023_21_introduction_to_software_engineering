import type { Request } from "express";

import type { RequestedWorkspaceProfileDto } from "@vcp/shared/contracts/workspace-management.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";
import { validateRequestedWorkspaceIntent } from "../../domain/workspace-profile.ts";
import { decodeWorkspaceCursor } from "./workspace-cursor.ts";
import {
  unauthorizedError,
  validationError
} from "./workspace-http-errors.ts";

export const WORKSPACE_LIST_DEFAULT_LIMIT = 20;
export const WORKSPACE_LIST_MAX_LIMIT = 100;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/u;
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const CREATE_BODY_FIELDS = new Set(["name", "requestedProfile"]);
const LIST_QUERY_FIELDS = new Set(["cursor", "limit"]);

export type AuthenticatedWorkspaceActor = {
  readonly userId: string;
  readonly requestId: string;
};

export function requireWorkspaceActor(request: Request): AuthenticatedWorkspaceActor {
  const context = ((request as { context?: RequestContext }).context ?? {
    requestId: request.header("x-request-id") ?? "workspace-request"
  }) as RequestContext;

  if (!context.user) {
    throw unauthorizedError();
  }

  return {
    userId: context.user.userId,
    requestId: context.requestId
  };
}

export function parseCreateWorkspaceRequestBody(body: unknown): {
  readonly name: string;
  readonly requestedProfile: RequestedWorkspaceProfileDto;
} {
  if (!isPlainRecord(body)) {
    throw validationError("Workspace create body is invalid.", [
      {
        path: "",
        message: "Request body must be a JSON object.",
        code: "workspace_body_not_object"
      }
    ]);
  }

  const issues = Object.keys(body)
    .filter((key) => !CREATE_BODY_FIELDS.has(key))
    .map((key) => ({
      path: key,
      message: "Client-controlled server-owned Workspace field is not accepted.",
      code: "workspace_forbidden_body_field"
    }));

  const intent = validateRequestedWorkspaceIntent(body);
  if (!intent.ok) {
    issues.push(...(intent.error.issues ?? []));
  }

  if (issues.length > 0) {
    throw validationError("Workspace create body is invalid.", issues);
  }

  return intent.ok ? intent.value : { name: "", requestedProfile: "standard" };
}

export function parseWorkspaceId(value: unknown): string {
  if (typeof value !== "string" || !WORKSPACE_ID_PATTERN.test(value)) {
    throw validationError("Workspace ID is invalid.", [
      {
        path: "workspaceId",
        message: "Workspace ID is malformed.",
        code: "workspace_id_invalid"
      }
    ]);
  }

  return value;
}

export function parseIdempotencyKey(request: Request): string {
  const value = request.header("Idempotency-Key");
  if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw validationError("Idempotency-Key header is invalid.", [
      {
        path: "Idempotency-Key",
        message: "Idempotency-Key must be 8-128 opaque ASCII characters.",
        code: "idempotency_key_invalid"
      }
    ]);
  }

  return value;
}

export function parseListWorkspacesQuery(query: Request["query"]): {
  readonly cursor: ReturnType<typeof decodeWorkspaceCursor>;
  readonly limit: number;
} {
  for (const key of Object.keys(query)) {
    if (!LIST_QUERY_FIELDS.has(key)) {
      throw validationError("Workspace list query is invalid.", [
        {
          path: key,
          message: "Unsupported Workspace list query parameter.",
          code: "workspace_query_unsupported"
        }
      ]);
    }
  }

  const cursor = readOptionalSingleQueryValue(query.cursor, "cursor");
  const limitRaw = readOptionalSingleQueryValue(query.limit, "limit");
  const limit = limitRaw === undefined
    ? WORKSPACE_LIST_DEFAULT_LIMIT
    : parseLimit(limitRaw);

  return {
    cursor: decodeWorkspaceCursor(cursor),
    limit
  };
}

export function rejectWorkspaceDeleteBody(body: unknown): void {
  if (body === undefined || body === null) {
    return;
  }

  if (isPlainRecord(body) && Object.keys(body).length === 0) {
    return;
  }

  throw validationError("Workspace delete body is not accepted.", [
    {
      path: "",
      message: "DELETE does not accept body-controlled retry, runtime, or force-delete fields.",
      code: "workspace_delete_body_forbidden"
    }
  ]);
}

export function rejectDetailQuery(query: Request["query"]): void {
  const keys = Object.keys(query);
  if (keys.length > 0) {
    throw validationError("Workspace detail query is invalid.", [
      {
        path: keys[0] ?? "",
        message: "Workspace detail does not accept query parameters.",
        code: "workspace_query_unsupported"
      }
    ]);
  }
}

function parseLimit(value: string): number {
  if (!/^[0-9]+$/u.test(value)) {
    throw validationError("Workspace list limit is invalid.", [
      {
        path: "limit",
        message: "Limit must be a positive integer.",
        code: "workspace_limit_invalid"
      }
    ]);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > WORKSPACE_LIST_MAX_LIMIT) {
    throw validationError("Workspace list limit is invalid.", [
      {
        path: "limit",
        message: `Limit must be between 1 and ${WORKSPACE_LIST_MAX_LIMIT}.`,
        code: "workspace_limit_invalid"
      }
    ]);
  }

  return parsed;
}

function readOptionalSingleQueryValue(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  throw validationError("Workspace query is invalid.", [
    {
      path,
      message: "Query parameter must appear at most once.",
      code: "workspace_query_repeated"
    }
  ]);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
