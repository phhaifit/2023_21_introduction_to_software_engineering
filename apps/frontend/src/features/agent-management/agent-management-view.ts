import type { AgentPublicSummary } from "@vcp/shared/contracts/agent-management.ts";
import type { AgentStatus } from "@vcp/shared/contracts/statuses.ts";

export type AgentFormMode = "create" | "edit";
export type AgentFormField = "name" | "role" | "model" | "instructions";
export type AgentListItem = AgentPublicSummary & {
  createdAt: string;
};

export type AgentFormState = {
  mode: AgentFormMode;
  values: Record<AgentFormField, string>;
  errors?: Partial<Record<AgentFormField | "form", string>>;
};

export type AgentManagementViewInput = {
  agents: readonly AgentListItem[];
  selectedAgentId?: string | null;
  form: AgentFormState;
};

export type AgentRowAction = {
  kind: "enable" | "disable" | "delete";
  label: string;
  requiresConfirmation: boolean;
};

export type AgentRowViewModel = {
  agentId: string;
  name: string;
  role: string;
  model: string;
  status: AgentStatus;
  statusLabel: string;
  statusTone: "ready" | "paused" | "removed";
  createdAt: string;
  updatedAt: string;
  isSelected: boolean;
  canBeSelectedForNewWork: boolean;
  actions: readonly AgentRowAction[];
};

export type AgentManagementViewModel = {
  list: {
    isEmpty: boolean;
    rows: readonly AgentRowViewModel[];
  };
  form: {
    mode: AgentFormMode;
    title: string;
    submitLabel: string;
    values: Record<AgentFormField, string>;
    errors: Partial<Record<AgentFormField | "form", string>>;
  };
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  enabled: "Enabled",
  disabled: "Disabled",
  deleted: "Deleted"
};

const STATUS_TONES: Record<AgentStatus, AgentRowViewModel["statusTone"]> = {
  enabled: "ready",
  disabled: "paused",
  deleted: "removed"
};

export function createAgentManagementViewModel(
  input: AgentManagementViewInput
): AgentManagementViewModel {
  const rows = input.agents.map((agent) => ({
    agentId: agent.agentId,
    name: agent.name,
    role: agent.role,
    model: agent.model,
    status: agent.status,
    statusLabel: STATUS_LABELS[agent.status],
    statusTone: STATUS_TONES[agent.status],
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    isSelected: input.selectedAgentId === agent.agentId,
    canBeSelectedForNewWork: agent.status === "enabled",
    actions: actionsForStatus(agent.status)
  }));

  return {
    list: {
      isEmpty: rows.length === 0,
      rows
    },
    form: {
      mode: input.form.mode,
      title: input.form.mode === "create" ? "Create agent" : "Edit agent",
      submitLabel: input.form.mode === "create" ? "Create agent" : "Save changes",
      values: input.form.values,
      errors: input.form.errors ?? {}
    }
  };
}

export function renderAgentManagementView(input: AgentManagementViewInput): string {
  const viewModel = createAgentManagementViewModel(input);

  return [
    '<section class="agent-management" aria-label="Agent management">',
    renderAgentList(viewModel.list.rows),
    renderAgentForm(viewModel.form),
    "</section>"
  ].join("\n");
}

function actionsForStatus(status: AgentStatus): readonly AgentRowAction[] {
  if (status === "enabled") {
    return [
      { kind: "disable", label: "Disable", requiresConfirmation: false },
      { kind: "delete", label: "Delete", requiresConfirmation: true }
    ];
  }

  if (status === "disabled") {
    return [
      { kind: "enable", label: "Enable", requiresConfirmation: false },
      { kind: "delete", label: "Delete", requiresConfirmation: true }
    ];
  }

  return [];
}

function renderAgentList(rows: readonly AgentRowViewModel[]): string {
  const body =
    rows.length > 0
      ? [
          '<div class="agent-table-wrap">',
          '<table class="agent-table" aria-label="Agents table">',
          "<thead>",
          "<tr>",
          '<th scope="col">Agent</th>',
          '<th scope="col">Role</th>',
          '<th scope="col">Model</th>',
          '<th scope="col">Status</th>',
          '<th scope="col">Updated</th>',
          '<th scope="col">Availability</th>',
          '<th scope="col">Actions</th>',
          "</tr>",
          "</thead>",
          "<tbody>",
          rows.map((row) => renderAgentRow(row)).join("\n"),
          "</tbody>",
          "</table>",
          "</div>"
        ].join("\n")
      : '<div class="agent-empty-state"><p class="empty-label">No active agents yet.</p><h3>Build your first virtual teammate</h3></div>';

  return [
    '<section class="agent-list" aria-labelledby="agent-list-title">',
    '<div class="agent-list__header">',
    '<h2 id="agent-list-title">Agents</h2>',
    '<span class="agent-list__count">' + rows.length.toString() + "</span>",
    "</div>",
    body,
    "</section>"
  ].join("\n");
}

function renderAgentRow(row: AgentRowViewModel): string {
  const selectedAttribute = row.isSelected ? ' aria-current="true"' : "";
  const selectableLabel = row.canBeSelectedForNewWork
    ? "Selectable for new work"
    : "Unavailable for new work";

  return [
    `<tr class="agent-row agent-row--${row.statusTone}" data-agent-id="${escapeHtml(
      row.agentId
    )}"${selectedAttribute}>`,
    '<td><div class="agent-row__identity">',
    `<h3>${escapeHtml(row.name)}</h3>`,
    "</div></td>",
    `<td>${escapeHtml(row.role)}</td>`,
    `<td>${escapeHtml(row.model)}</td>`,
    `<td><span class="agent-row__status agent-row__status--${row.statusTone}">${escapeHtml(
      row.statusLabel
    )}</span></td>`,
    `<td>${escapeHtml(row.updatedAt)}</td>`,
    `<td>${selectableLabel}</td>`,
    `<td><div class="agent-row__actions" aria-label="Actions for ${escapeHtml(row.name)}">`,
    `<button type="button" class="agent-menu-trigger" aria-label="Open actions for ${escapeHtml(
      row.name
    )}" aria-haspopup="true">...</button>`,
    `<div class="agent-action-menu" role="menu" aria-label="Actions for ${escapeHtml(row.name)}">`,
    "<button type=\"button\">Configure</button>",
    row.actions.filter((action) => action.kind !== "delete").map((action) => renderRowAction(row.agentId, action)).join("\n"),
    `<button type="button" disabled aria-disabled="true" aria-label="Rename ${escapeHtml(row.name)}">Rename</button>`,
    `<button type="button" disabled aria-disabled="true" aria-label="Duplicate ${escapeHtml(row.name)}">Duplicate</button>`,
    row.actions.filter((action) => action.kind === "delete").map((action) => renderRowAction(row.agentId, action)).join("\n"),
    "</div>",
    "</div></td>",
    "</tr>"
  ].join("\n");
}

function renderRowAction(agentId: string, action: AgentRowAction): string {
  const confirmation = action.requiresConfirmation
    ? ' data-confirmation="Deleting an agent prevents future selection."'
    : "";

  return `<button type="button" data-action="${action.kind}" data-agent-id="${escapeHtml(
    agentId
  )}"${confirmation}>${escapeHtml(action.label)}</button>`;
}

function renderAgentForm(form: AgentManagementViewModel["form"]): string {
  return [
    '<form class="agent-form" data-mode="' + form.mode + '" novalidate>',
    `<h2>${escapeHtml(form.title)}</h2>`,
    form.errors.form ? `<p class="agent-form__error" role="alert">${escapeHtml(form.errors.form)}</p>` : "",
    renderField("name", "Name", form.values.name, form.errors.name, form.mode === "edit"),
    renderField("role", "Role", form.values.role, form.errors.role),
    renderField("model", "Model", form.values.model, form.errors.model),
    renderField("instructions", "Instructions", form.values.instructions, form.errors.instructions),
    `<button type="submit">${escapeHtml(form.submitLabel)}</button>`,
    "</form>"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderField(
  field: AgentFormField,
  label: string,
  value: string,
  error?: string,
  readonly = false
): string {
  const fieldId = `agent-${field}`;
  const errorId = `${fieldId}-error`;
  const invalidAttributes = error ? ` aria-invalid="true" aria-describedby="${errorId}"` : "";
  const readonlyAttribute = readonly ? " readonly" : "";
  const control =
    field === "instructions"
      ? `<textarea id="${fieldId}" name="${field}"${invalidAttributes}>${escapeHtml(
          value
        )}</textarea>`
      : `<input id="${fieldId}" name="${field}" value="${escapeHtml(
          value
        )}"${invalidAttributes}${readonlyAttribute}>`;

  return [
    '<label class="agent-form__field" for="' + fieldId + '">',
    `<span>${escapeHtml(label)}</span>`,
    control,
    error ? `<span id="${errorId}" class="agent-form__error" role="alert">${escapeHtml(error)}</span>` : "",
    "</label>"
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
