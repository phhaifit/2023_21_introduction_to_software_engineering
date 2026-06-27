export const WORKSPACE_COMMAND_TYPES = [
  "workspace.create",
  "workspace.delete"
] as const;

export type WorkspaceCommandType = (typeof WORKSPACE_COMMAND_TYPES)[number];

export type WorkspaceCommandIdempotencyScope = {
  readonly actorUserId: string;
  readonly commandType: WorkspaceCommandType;
  readonly commandTarget: string;
  readonly idempotencyKey: string;
};

export type WorkspaceCommandIdempotencyInput =
  WorkspaceCommandIdempotencyScope & {
    readonly requestFingerprint: string;
  };

export type WorkspaceCommandIdempotencyOutcome =
  | "new_command"
  | "replay_existing_response"
  | "idempotency_conflict";

export function compareWorkspaceCommandIdempotency(
  command: WorkspaceCommandIdempotencyInput,
  existingReceipt: WorkspaceCommandIdempotencyInput | null | undefined
): WorkspaceCommandIdempotencyOutcome {
  if (!existingReceipt) {
    return "new_command";
  }

  if (!sameScope(command, existingReceipt)) {
    return "new_command";
  }

  if (command.requestFingerprint === existingReceipt.requestFingerprint) {
    return "replay_existing_response";
  }

  return "idempotency_conflict";
}

function sameScope(
  left: WorkspaceCommandIdempotencyScope,
  right: WorkspaceCommandIdempotencyScope
): boolean {
  return (
    left.actorUserId === right.actorUserId &&
    left.commandType === right.commandType &&
    left.commandTarget === right.commandTarget &&
    left.idempotencyKey === right.idempotencyKey
  );
}
