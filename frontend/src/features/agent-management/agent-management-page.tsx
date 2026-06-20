import { useMemo, useState } from "react";

import {
  createAgentManagementViewModel,
  type AgentFormField,
  type AgentFormState,
  type AgentManagementViewInput,
  type AgentRowAction,
  type AgentRowViewModel
} from "./agent-management-view.ts";
import {
  agentManagementMockInput,
  agentManagementMockInstructions
} from "./agent-management-mock-data.ts";
import "./agent-management-view.css";

type AgentManagementPageProps = {
  initialInput?: AgentManagementViewInput;
};

const createFormValues: AgentFormState["values"] = {
  name: "",
  role: "",
  model: "gpt-4.1-mini",
  instructions: ""
};

export function AgentManagementPage({
  initialInput = agentManagementMockInput
}: AgentManagementPageProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialInput.selectedAgentId ?? null
  );
  const [form, setForm] = useState<AgentFormState>(initialInput.form);

  const viewModel = useMemo(
    () =>
      createAgentManagementViewModel({
        ...initialInput,
        selectedAgentId,
        form
      }),
    [form, initialInput, selectedAgentId]
  );

  const enabledCount = viewModel.list.rows.filter((row) => row.status === "enabled").length;
  const disabledCount = viewModel.list.rows.filter((row) => row.status === "disabled").length;

  function showCreateForm() {
    setSelectedAgentId(null);
    setForm({
      mode: "create",
      values: createFormValues
    });
  }

  function showEditForm(row: AgentRowViewModel) {
    setSelectedAgentId(row.agentId);
    setForm({
      mode: "edit",
      values: {
        name: row.name,
        role: row.role,
        model: row.model,
        instructions: agentManagementMockInstructions[row.agentId] ?? ""
      }
    });
  }

  function updateFormField(field: AgentFormField, value: string) {
    setForm((current) => ({
      ...current,
      values: {
        ...current.values,
        [field]: value
      }
    }));
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

      <div className="agent-management">
        <section className="agent-list" aria-labelledby="agent-list-title">
          <div className="agent-list__header">
            <h2 id="agent-list-title">Agent list</h2>
            <button type="button" className="agent-list__new" onClick={showCreateForm}>
              New agent
            </button>
          </div>

          {viewModel.list.isEmpty ? (
            <p className="agent-list__empty">No active agents yet.</p>
          ) : (
            viewModel.list.rows.map((row) => (
              <AgentRow key={row.agentId} row={row} onEdit={showEditForm} />
            ))
          )}
        </section>

        <AgentForm
          form={viewModel.form}
          onFieldChange={updateFormField}
        />
      </div>
    </section>
  );
}

type AgentRowProps = {
  row: AgentRowViewModel;
  onEdit: (row: AgentRowViewModel) => void;
};

function AgentRow({ row, onEdit }: AgentRowProps) {
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
        <div>
          <dt>Role</dt>
          <dd>{row.role}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{row.model}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(row.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDate(row.updatedAt)}</dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd>{selectableLabel}</dd>
        </div>
      </dl>
      <div className="agent-row__actions" aria-label={`Actions for ${row.name}`}>
        <button type="button" onClick={() => onEdit(row)}>
          Edit
        </button>
        {row.actions.map((action) => (
          <LifecycleActionButton key={action.kind} row={row} action={action} />
        ))}
      </div>
    </article>
  );
}

type LifecycleActionButtonProps = {
  row: AgentRowViewModel;
  action: AgentRowAction;
};

function LifecycleActionButton({ row, action }: LifecycleActionButtonProps) {
  return (
    <button
      type="button"
      data-action={action.kind}
      data-agent-id={row.agentId}
      data-confirmation={
        action.requiresConfirmation ? "Deleting an agent prevents future selection." : undefined
      }
      onClick={(event) => event.preventDefault()}
    >
      {action.label}
    </button>
  );
}

type AgentFormProps = {
  form: ReturnType<typeof createAgentManagementViewModel>["form"];
  onFieldChange: (field: AgentFormField, value: string) => void;
};

function AgentForm({ form, onFieldChange }: AgentFormProps) {
  return (
    <form
      className="agent-form"
      data-mode={form.mode}
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <h2>{form.title}</h2>
      {form.errors.form ? (
        <p className="agent-form__error" role="alert">
          {form.errors.form}
        </p>
      ) : null}
      <FormField
        field="name"
        label="Name"
        value={form.values.name}
        error={form.errors.name}
        readOnly={form.mode === "edit"}
        onFieldChange={onFieldChange}
      />
      <FormField
        field="role"
        label="Role"
        value={form.values.role}
        error={form.errors.role}
        onFieldChange={onFieldChange}
      />
      <FormField
        field="model"
        label="Model"
        value={form.values.model}
        error={form.errors.model}
        onFieldChange={onFieldChange}
      />
      <FormField
        field="instructions"
        label="Instructions"
        value={form.values.instructions}
        error={form.errors.instructions}
        onFieldChange={onFieldChange}
      />
      <button type="submit">{form.submitLabel}</button>
    </form>
  );
}

type FormFieldProps = {
  field: AgentFormField;
  label: string;
  value: string;
  error?: string;
  readOnly?: boolean;
  onFieldChange: (field: AgentFormField, value: string) => void;
};

function FormField({
  field,
  label,
  value,
  error,
  readOnly = false,
  onFieldChange
}: FormFieldProps) {
  const fieldId = `agent-${field}`;
  const errorId = `${fieldId}-error`;
  const invalidProps = error
    ? {
        "aria-invalid": true,
        "aria-describedby": errorId
      }
    : {};

  return (
    <label className="agent-form__field" htmlFor={fieldId}>
      <span>{label}</span>
      {field === "instructions" ? (
        <textarea
          id={fieldId}
          name={field}
          value={value}
          onChange={(event) => onFieldChange(field, event.target.value)}
          {...invalidProps}
        />
      ) : (
        <input
          id={fieldId}
          name={field}
          value={value}
          readOnly={readOnly}
          onChange={(event) => onFieldChange(field, event.target.value)}
          {...invalidProps}
        />
      )}
      {error ? (
        <span id={errorId} className="agent-form__error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
