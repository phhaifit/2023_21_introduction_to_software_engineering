import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  CreateWorkspaceAcceptedResponse,
  RequestedWorkspaceProfileDto
} from "@vcp/shared/contracts/workspace-management.ts";

import type { WorkspaceIdempotencyKeyFactory } from "../api/workspace-api-client.ts";
import { createWorkspaceIdempotencyKey } from "../api/workspace-api-client.ts";

export type WorkspaceCreateSubmitInput = {
  name: string;
  requestedProfile: RequestedWorkspaceProfileDto;
  idempotencyKey: string;
};

export type WorkspaceCreateFormProps = {
  onCreate(input: WorkspaceCreateSubmitInput): Promise<CreateWorkspaceAcceptedResponse>;
  keyFactory?: WorkspaceIdempotencyKeyFactory;
  onAccepted?: (response: CreateWorkspaceAcceptedResponse) => void;
};

type FormError = {
  field?: "name" | "requestedProfile";
  message: string;
};

const PROFILE_OPTIONS: { label: string; value: RequestedWorkspaceProfileDto }[] = [
  { label: "Standard", value: "standard" },
  { label: "Premium", value: "premium" }
];

export function WorkspaceCreateForm({
  onCreate,
  keyFactory = createWorkspaceIdempotencyKey,
  onAccepted
}: WorkspaceCreateFormProps) {
  const [name, setName] = useState("");
  const [requestedProfile, setRequestedProfile] =
    useState<RequestedWorkspaceProfileDto>("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [accepted, setAccepted] =
    useState<CreateWorkspaceAcceptedResponse | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const fingerprintRef = useRef<string | null>(null);

  const fingerprint = useMemo(
    () => JSON.stringify({ name: normalizeDisplayName(name), requestedProfile }),
    [name, requestedProfile]
  );

  useEffect(() => {
    if (fingerprintRef.current && fingerprintRef.current !== fingerprint) {
      idempotencyKeyRef.current = null;
      fingerprintRef.current = null;
      setAccepted(null);
    }
  }, [fingerprint]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateWorkspaceCreateForm(name, requestedProfile);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    if (!idempotencyKeyRef.current || fingerprintRef.current !== fingerprint) {
      idempotencyKeyRef.current = keyFactory();
      fingerprintRef.current = fingerprint;
    }

    try {
      const response = await onCreate({
        name: normalizeDisplayName(name),
        requestedProfile,
        idempotencyKey: idempotencyKeyRef.current
      });
      setAccepted(response);
      onAccepted?.(response);
    } catch (caught) {
      const safeMessage = messageForCreateError(caught);
      setError({ message: safeMessage });

      if (isIdempotencyConflict(caught)) {
        idempotencyKeyRef.current = null;
        fingerprintRef.current = null;
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="workspace-create-form" onSubmit={handleSubmit} aria-label="Create workspace">
      <div className="workspace-create-form__fields">
        <label className="workspace-field">
          <span>Name</span>
          <input
            aria-describedby={error?.field === "name" ? "workspace-name-error" : undefined}
            aria-invalid={error?.field === "name" ? "true" : undefined}
            disabled={isSubmitting}
            maxLength={80}
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Workspace name"
            value={name}
            data-testid="workspace-name-input"
          />
        </label>
        <label className="workspace-field">
          <span>Requested profile</span>
          <select
            disabled={isSubmitting}
            name="requestedProfile"
            onChange={(event) =>
              setRequestedProfile(event.target.value as RequestedWorkspaceProfileDto)
            }
            value={requestedProfile}
            data-testid="workspace-profile-select"
          >
            {PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p
          className="workspace-management-alert workspace-management-alert--error"
          id={error.field === "name" ? "workspace-name-error" : undefined}
          role="alert"
        >
          {error.message}
        </p>
      ) : null}

      {accepted ? (
        <p className="workspace-management-alert workspace-management-alert--success" role="status">
          Workspace request accepted for {accepted.workspace.name}. Current status:
          {" "}
          {accepted.workspace.status}.
        </p>
      ) : null}

      <button className="primary-action" disabled={isSubmitting} type="submit" data-testid="workspace-submit-button">
        {isSubmitting ? "Creating..." : "Create workspace"}
      </button>
    </form>
  );
}

export function validateWorkspaceCreateForm(
  name: string,
  requestedProfile: string
): FormError | null {
  const normalized = normalizeDisplayName(name);

  if (!normalized) {
    return { field: "name", message: "Enter a workspace name." };
  }

  if (normalized.length > 80) {
    return { field: "name", message: "Workspace name must be 80 characters or fewer." };
  }

  if (requestedProfile !== "standard" && requestedProfile !== "premium") {
    return { field: "requestedProfile", message: "Choose a supported workspace profile." };
  }

  return null;
}

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isIdempotencyConflict(error: unknown): boolean {
  return isObjectWithCode(error) && error.code === "workspace.idempotency_conflict";
}

function messageForCreateError(error: unknown): string {
  if (isObjectWithCode(error)) {
    if (error.code === "workspace.idempotency_conflict") {
      return "This request conflicts with a previous submission. Change the form or retry with a new request.";
    }

    if (error.code === "workspace.entitlement_denied") {
      return "Your current subscription does not allow this workspace profile.";
    }

    if (error.code === "system.unavailable") {
      return "Workspace creation is temporarily unavailable. Try again later.";
    }

    if (error.code === "validation.invalid_input") {
      return error.message || "Check the workspace name and requested profile.";
    }
  }

  return "Unable to create the workspace. Try again later.";
}

function isObjectWithCode(value: unknown): value is { code: string; message?: string } {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return false;
  }

  const record = value as { code?: unknown };
  return typeof record.code === "string";
}
