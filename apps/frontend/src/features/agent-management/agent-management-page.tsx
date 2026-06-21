import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  AgentApiClientError,
  createAgentManagementApiClient,
  type AgentListItem,
  type AgentManagementApiClient
} from "./agent-management-api-client.ts";
import {
  createAgentManagementViewModel,
  type AgentFormField,
  type AgentFormState,
  type AgentRowAction,
  type AgentRowViewModel
} from "./agent-management-view.ts";
import "./agent-management-view.css";

type AgentManagementPageProps = {
  workspaceId: EntityId<"workspaceId">;
  apiClient?: AgentManagementApiClient;
};

const defaultApiClient = createAgentManagementApiClient();

const createFormValues: AgentFormState["values"] = {
  name: "",
  role: "",
  model: "gpt-4.1-mini",
  instructions: ""
};

export function AgentManagementPage({
  workspaceId,
  apiClient = defaultApiClient
}: AgentManagementPageProps) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<EntityId<"agentId"> | null>(null);
  const [form, setForm] = useState<AgentFormState>(createForm());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isEditReady, setIsEditReady] = useState(false);
  const pendingActionRef = useRef<string | null>(null);

  const replaceAgents = useCallback(async () => {
    const nextAgents = await apiClient.listAgents(workspaceId);
    setAgents(nextAgents);
  }, [apiClient, workspaceId]);

  const loadInitialAgents = useCallback(async () => {
    setIsInitialLoading(true);
    setInitialLoadError(null);

    try {
      await replaceAgents();
    } catch (error) {
      setInitialLoadError(messageFor(error, "Unable to load workspace agents."));
    } finally {
      setIsInitialLoading(false);
    }
  }, [replaceAgents]);

  useEffect(() => {
    void loadInitialAgents();
  }, [loadInitialAgents]);

  const viewModel = useMemo(
    () =>
      createAgentManagementViewModel({
        agents,
        selectedAgentId,
        form
      }),
    [agents, form, selectedAgentId]
  );

  const enabledCount = viewModel.list.rows.filter((row) => row.status === "enabled").length;
  const disabledCount = viewModel.list.rows.filter((row) => row.status === "disabled").length;
  const isBusy = pendingAction !== null || isEditLoading;

  function showCreateForm() {
    if (isBusy) {
      return;
    }

    setSelectedAgentId(null);
    setIsEditReady(false);
    setPageError(null);
    setForm(createForm());
  }

  async function showEditForm(row: AgentRowViewModel) {
    if (isBusy) {
      return;
    }

    const agentId = row.agentId as EntityId<"agentId">;
    setSelectedAgentId(agentId);
    setIsEditReady(false);
    setIsEditLoading(true);
    setPageError(null);
    setForm({
      mode: "edit",
      values: {
        name: row.name,
        role: row.role,
        model: row.model,
        instructions: ""
      }
    });

    try {
      const configuration = await apiClient.getAgentConfiguration(workspaceId, agentId);
      setForm({
        mode: "edit",
        values: {
          name: configuration.name,
          role: configuration.role,
          model: configuration.model,
          instructions: configuration.instructions
        }
      });
      setIsEditReady(true);
    } catch (error) {
      setForm((current) => ({
        ...current,
        errors: { form: messageFor(error, "Unable to load agent configuration.") }
      }));
    } finally {
      setIsEditLoading(false);
    }
  }

  function updateFormField(field: AgentFormField, value: string) {
    setForm((current) => ({
      ...current,
      values: {
        ...current.values,
        [field]: value
      },
      errors: {
        ...current.errors,
        [field]: undefined,
        form: undefined
      }
    }));
  }

  async function submitForm() {
    if (pendingActionRef.current || (form.mode === "edit" && !isEditReady)) {
      return;
    }

    const actionKey = form.mode === "create" ? "create" : `update:${selectedAgentId}`;
    await runMutation(actionKey, async () => {
      if (form.mode === "create") {
        await apiClient.createAgent(workspaceId, form.values);
      } else if (selectedAgentId) {
        await apiClient.updateAgent(workspaceId, selectedAgentId, {
          role: form.values.role,
          model: form.values.model,
          instructions: form.values.instructions
        });
      }

      await replaceAgents();

      if (form.mode === "create") {
        setForm(createForm());
      }
    }, (error) => {
      setForm((current) => ({
        ...current,
        errors: formErrorsFor(error)
      }));
    });
  }

  async function performLifecycleAction(row: AgentRowViewModel, action: AgentRowAction) {
    if (pendingActionRef.current) {
      return;
    }

    if (action.kind === "delete" && !window.confirm("Delete this agent?")) {
      return;
    }

    const agentId = row.agentId as EntityId<"agentId">;
    await runMutation(`${action.kind}:${agentId}`, async () => {
      if (action.kind === "enable") {
        await apiClient.enableAgent(workspaceId, agentId);
      } else if (action.kind === "disable") {
        await apiClient.disableAgent(workspaceId, agentId);
      } else {
        await apiClient.deleteAgent(workspaceId, agentId);
      }

      await replaceAgents();
      if (action.kind === "delete" && selectedAgentId === agentId) {
        setSelectedAgentId(null);
        setIsEditReady(false);
        setForm(createForm());
      }
    }, (error) => {
      setPageError(messageFor(error, "Unable to update the agent."));
    });
  }

  async function runMutation(
    actionKey: string,
    operation: () => Promise<void>,
    onError: (error: unknown) => void
  ) {
    if (pendingActionRef.current) {
      return;
    }

    pendingActionRef.current = actionKey;
    setPendingAction(actionKey);
    setPageError(null);
    setForm((current) => ({ ...current, errors: undefined }));

    try {
      await operation();
    } catch (error) {
      onError(error);
    } finally {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  }

  return (
    <section className="agent-management-page" aria-labelledby="agent-management-title">
      <div className="agent-management-page__header">
        <div>
          <h2 id="agent-management-title">Agents</h2>
          <p>{viewModel.list.rows.length} workspace agents</p>
        </div>
        <dl className="agent-management-page__stats" aria-label="Agent status summary">
          <div>
            <dt>Enabled</dt>
            <dd>{enabledCount}</dd>
          </div>
          <div>
            <dt>Disabled</dt>
            <dd>{disabledCount}</dd>
          </div>
        </dl>
      </div>

      {pageError ? <p className="agent-management-page__error" role="alert">{pageError}</p> : null}

      <div className="agent-management">
        <section className="agent-list" aria-labelledby="agent-list-title" aria-busy={isBusy}>
          <div className="agent-list__header">
            <h2 id="agent-list-title">Agent list</h2>
            <button
              type="button"
              className="agent-list__new"
              onClick={showCreateForm}
              disabled={isBusy}
            >
              New agent
            </button>
          </div>

          {isInitialLoading ? <p role="status">Loading agents...</p> : null}
          {!isInitialLoading && initialLoadError ? (
            <div className="agent-list__error" role="alert">
              <p>{initialLoadError}</p>
              <button type="button" onClick={() => void loadInitialAgents()}>
                Retry
              </button>
            </div>
          ) : null}
          {!isInitialLoading && !initialLoadError && viewModel.list.isEmpty ? (
            <p className="agent-list__empty">No active agents yet.</p>
          ) : null}
          {!isInitialLoading && !initialLoadError
            ? viewModel.list.rows.map((row) => (
                <AgentRow
                  key={row.agentId}
                  row={row}
                  disabled={isBusy}
                  onEdit={showEditForm}
                  onLifecycleAction={performLifecycleAction}
                />
              ))
            : null}
        </section>

        <AgentForm
          form={viewModel.form}
          disabled={pendingAction !== null || isEditLoading || (form.mode === "edit" && !isEditReady)}
          isEditLoading={isEditLoading}
          onFieldChange={updateFormField}
          onSubmit={submitForm}
        />
      </div>
    </section>
  );
}

type AgentRowProps = {
  row: AgentRowViewModel;
  disabled: boolean;
  onEdit: (row: AgentRowViewModel) => void;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function AgentRow({ row, disabled, onEdit, onLifecycleAction }: AgentRowProps) {
  const selectableLabel = row.canBeSelectedForNewWork
    ? "Selectable for new work"
    : "Unavailable for new work";

  return (
    <article
      className={`agent-row agent-row--${row.statusTone}`}
      data-agent-id={row.agentId}
      aria-current={row.isSelected ? "true" : undefined}
    >
      <div className="agent-row__summary">
        <h3>{row.name}</h3>
        <span className={`agent-row__status agent-row__status--${row.statusTone}`}>
          {row.statusLabel}
        </span>
      </div>
      <dl className="agent-row__meta">
        <div><dt>Role</dt><dd>{row.role}</dd></div>
        <div><dt>Model</dt><dd>{row.model}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(row.createdAt)}</dd></div>
        <div><dt>Updated</dt><dd>{formatDate(row.updatedAt)}</dd></div>
        <div><dt>Availability</dt><dd>{selectableLabel}</dd></div>
      </dl>
      <div className="agent-row__actions" aria-label={`Actions for ${row.name}`}>
        <button type="button" onClick={() => void onEdit(row)} disabled={disabled}>Edit</button>
        {row.actions.map((action) => (
          <button
            key={action.kind}
            type="button"
            data-action={action.kind}
            data-agent-id={row.agentId}
            data-confirmation={
              action.requiresConfirmation ? "Deleting an agent prevents future selection." : undefined
            }
            onClick={() => void onLifecycleAction(row, action)}
            disabled={disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}

type AgentFormProps = {
  form: ReturnType<typeof createAgentManagementViewModel>["form"];
  disabled: boolean;
  isEditLoading: boolean;
  onFieldChange: (field: AgentFormField, value: string) => void;
  onSubmit: () => void;
};

function AgentForm({ form, disabled, isEditLoading, onFieldChange, onSubmit }: AgentFormProps) {
  return (
    <form
      className="agent-form"
      data-mode={form.mode}
      noValidate
      aria-busy={disabled}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <h2>{form.title}</h2>
      {isEditLoading ? <p role="status">Loading configuration...</p> : null}
      {form.errors.form ? <p className="agent-form__error" role="alert">{form.errors.form}</p> : null}
      <FormField field="name" label="Name" value={form.values.name} error={form.errors.name}
        readOnly={form.mode === "edit"} disabled={disabled} onFieldChange={onFieldChange} />
      <FormField field="role" label="Role" value={form.values.role} error={form.errors.role}
        disabled={disabled} onFieldChange={onFieldChange} />
      <FormField field="model" label="Model" value={form.values.model} error={form.errors.model}
        disabled={disabled} onFieldChange={onFieldChange} />
      <FormField field="instructions" label="Instructions" value={form.values.instructions}
        error={form.errors.instructions} disabled={disabled} onFieldChange={onFieldChange} />
      <button type="submit" disabled={disabled}>
        {disabled ? (isEditLoading ? "Loading..." : "Saving...") : form.submitLabel}
      </button>
    </form>
  );
}

type FormFieldProps = {
  field: AgentFormField;
  label: string;
  value: string;
  error?: string;
  readOnly?: boolean;
  disabled?: boolean;
  onFieldChange: (field: AgentFormField, value: string) => void;
};

function FormField({
  field,
  label,
  value,
  error,
  readOnly = false,
  disabled = false,
  onFieldChange
}: FormFieldProps) {
  const fieldId = `agent-${field}`;
  const errorId = `${fieldId}-error`;
  const invalidProps = error ? { "aria-invalid": true, "aria-describedby": errorId } : {};
  const commonProps = {
    id: fieldId,
    name: field,
    value,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onFieldChange(field, event.target.value),
    ...invalidProps
  };

  return (
    <label className="agent-form__field" htmlFor={fieldId}>
      <span>{label}</span>
      {field === "instructions" ? (
        <textarea {...commonProps} />
      ) : (
        <input {...commonProps} readOnly={readOnly} />
      )}
      {error ? <span id={errorId} className="agent-form__error" role="alert">{error}</span> : null}
    </label>
  );
}

function createForm(): AgentFormState {
  return { mode: "create", values: { ...createFormValues } };
}

function formErrorsFor(error: unknown): AgentFormState["errors"] {
  if (error instanceof AgentApiClientError && error.code === "validation.invalid_input") {
    const issues = Array.isArray(error.details?.issues) ? error.details.issues : [];
    const errors: AgentFormState["errors"] = {};

    for (const issue of issues) {
      if (typeof issue !== "string") {
        continue;
      }

      const field = (["name", "role", "model", "instructions"] as const).find((candidate) =>
        issue.startsWith(candidate)
      );
      if (field) {
        errors[field] = issue;
      }
    }

    return Object.keys(errors).length > 0 ? errors : { form: error.message };
  }

  return { form: messageFor(error, "Unable to save the agent.") };
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof AgentApiClientError ? error.message : fallback;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
