import { useEffect, useRef, useState } from "react";
import type { DeleteWorkspaceAcceptedResponse } from "@vcp/shared/contracts/workspace-management.ts";

import {
  createWorkspaceIdempotencyKey,
  type WorkspaceIdempotencyKeyFactory
} from "../api/workspace-api-client.ts";

export type WorkspaceDeleteDialogProps = {
  isOpen: boolean;
  isDeleting?: boolean;
  workspaceName: string;
  keyFactory?: WorkspaceIdempotencyKeyFactory;
  onClose(): void;
  onDelete(idempotencyKey: string): Promise<DeleteWorkspaceAcceptedResponse>;
  onAccepted?(response: DeleteWorkspaceAcceptedResponse): void;
};

export function WorkspaceDeleteDialog({
  isOpen,
  isDeleting = false,
  workspaceName,
  keyFactory = createWorkspaceIdempotencyKey,
  onClose,
  onDelete,
  onAccepted
}: WorkspaceDeleteDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      setError(null);
      confirmButtonRef.current?.focus();
    } else {
      idempotencyKeyRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleDelete() {
    if (!confirmed || isSubmitting || isDeleting) {
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = keyFactory();
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await onDelete(idempotencyKeyRef.current);
      onAccepted?.(response);
    } catch (caught) {
      setError(messageForDeleteError(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="workspace-dialog-backdrop" role="presentation">
      <section
        aria-describedby="workspace-delete-description"
        aria-labelledby="workspace-delete-title"
        aria-modal="true"
        className="workspace-delete-dialog"
        role="dialog"
        data-testid="workspace-delete-confirm-dialog"
      >
        <header className="workspace-delete-dialog__header">
          <h2 id="workspace-delete-title">Delete workspace?</h2>
          <button
            aria-label="Close delete confirmation"
            className="workspace-management-icon-button"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </header>

        <p id="workspace-delete-description">
          This requests deletion for <strong>{workspaceName}</strong>. Runtime
          cleanup may still be in progress after the request is accepted.
        </p>

        <label className="workspace-delete-dialog__confirm">
          <input
            checked={confirmed}
            disabled={isSubmitting || isDeleting}
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span>I understand this starts workspace deletion.</span>
        </label>

        {error ? (
          <p className="workspace-management-alert workspace-management-alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="workspace-delete-dialog__actions">
          <button
            className="workspace-management-secondary-button"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Keep workspace
          </button>
          <button
            className="workspace-management-danger-button"
            disabled={!confirmed || isSubmitting || isDeleting}
            onClick={handleDelete}
            ref={confirmButtonRef}
            type="button"
            data-testid="workspace-delete-confirm-button"
          >
            {isSubmitting || isDeleting ? "Requesting deletion..." : "Request deletion"}
          </button>
        </div>
      </section>
    </div>
  );
}

function messageForDeleteError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);

    if (code === "workspace.lifecycle_conflict") {
      return "This workspace cannot be deleted in its current state.";
    }

    if (code === "workspace.idempotency_conflict") {
      return "This delete request conflicts with a previous request. Start a new delete request.";
    }

    if (code === "auth.forbidden") {
      return "You do not have permission to delete this workspace.";
    }

    if (code === "workspace.not_found") {
      return "Workspace was not found or is no longer available.";
    }
  }

  return "Unable to request workspace deletion. Try again later.";
}
