import type { WorkspaceKeysetCursor } from "../../application/ports/workspace-persistence-types.ts";
import { validationError } from "./workspace-http-errors.ts";

const CURSOR_VERSION = 1;

export function encodeWorkspaceCursor(cursor: WorkspaceKeysetCursor | null): string | null {
  if (!cursor) {
    return null;
  }

  const json = JSON.stringify({
    v: CURSOR_VERSION,
    updatedAt: cursor.updatedAt,
    workspaceId: cursor.workspaceId
  });

  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeWorkspaceCursor(value: string | undefined): WorkspaceKeysetCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("cursor object required");
    }

    const record = parsed as Record<string, unknown>;
    if (
      record.v !== CURSOR_VERSION ||
      typeof record.updatedAt !== "string" ||
      typeof record.workspaceId !== "string" ||
      record.updatedAt.length === 0 ||
      record.workspaceId.length === 0
    ) {
      throw new Error("cursor fields invalid");
    }

    return {
      updatedAt: record.updatedAt,
      workspaceId: record.workspaceId
    };
  } catch {
    throw validationError("Workspace cursor is invalid.", [
      {
        path: "cursor",
        message: "Cursor is malformed or unsupported.",
        code: "workspace_cursor_invalid"
      }
    ]);
  }
}
