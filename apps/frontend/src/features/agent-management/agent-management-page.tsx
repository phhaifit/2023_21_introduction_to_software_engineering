import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Bot,
  Copy,
  Filter,
  Grid3X3,
  List,
  MoreVertical,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  SquarePen,
  Sparkles,
  Trash2,
  X,
  XCircle,
  ChevronDown,
  UserRoundCheck,
} from "lucide-react";

import { useToast } from "../../components/shared/Toast.tsx";
import { Pagination } from "../../components/shared/Pagination.tsx";
import { RenameDialog } from "./components/RenameDialog.tsx";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog.tsx";

import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import agentsHeroUrl from "../../assets/agent-management/agents-hero.png";
import {
  AgentApiClientError,
  createAgentManagementApiClient,
  type AgentListItem,
  type AgentManagementApiClient,
} from "./agent-management-api-client.ts";
import {
  createAgentManagementViewModel,
  type AgentFormField,
  type AgentFormState,
  type AgentRowAction,
  type AgentRowViewModel,
} from "./agent-management-view.ts";
import "./agent-management-view.css";

type AgentManagementAccessMode = "manager" | "viewer";

type AgentManagementPageProps = {
  workspaceId: EntityId<"workspaceId">;
  apiClient?: AgentManagementApiClient;
  accessMode?: AgentManagementAccessMode;
};

const defaultApiClient = createAgentManagementApiClient();

const createFormValues: AgentFormState["values"] = {
  name: "",
  role: "",
  model: "gpt-4.1-mini",
  instructions: "",
};

export function AgentManagementPage({
  workspaceId,
  apiClient = defaultApiClient,
  accessMode = "manager",
}: AgentManagementPageProps) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] =
    useState<EntityId<"agentId"> | null>(null);
  const [form, setForm] = useState<AgentFormState>(createForm());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isEditReady, setIsEditReady] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const pendingActionRef = useRef<string | null>(null);
  const canManageAgents = accessMode === "manager";
  const { showSuccess, showError } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [renameAgentObj, setRenameAgentObj] =
    useState<AgentRowViewModel | null>(null);
  const [deleteAgentObj, setDeleteAgentObj] =
    useState<AgentRowViewModel | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const replaceAgents = useCallback(async () => {
    const statuses =
      statusFilter === "All" ? undefined : [statusFilter.toLowerCase()];
    const result = await apiClient.listAgents(workspaceId, {
      search: debouncedSearch || undefined,
      status: statuses,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });
    setAgents(result.items);
    setTotalPages(result.pagination.totalPages);
  }, [
    apiClient,
    workspaceId,
    debouncedSearch,
    statusFilter,
    sortBy,
    sortOrder,
    page,
    pageSize,
  ]);

  const loadInitialAgents = useCallback(async () => {
    setIsInitialLoading(true);
    setInitialLoadError(null);

    try {
      await replaceAgents();
    } catch (error) {
      setInitialLoadError(
        messageFor(error, "Unable to load workspace agents."),
      );
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
        form,
      }),
    [agents, form, selectedAgentId],
  );

  const enabledCount = viewModel.list.rows.filter(
    (row) => row.status === "enabled",
  ).length;
  const disabledCount = viewModel.list.rows.filter(
    (row) => row.status === "disabled",
  ).length;
  const isBusy = pendingAction !== null || isEditLoading;

  function showCreateForm() {
    if (isBusy || !canManageAgents) {
      return;
    }

    setSelectedAgentId(null);
    setIsEditReady(false);
    setPageError(null);
    setForm(createForm());
    setIsFormOpen(true);
  }

  async function showEditForm(row: AgentRowViewModel) {
    if (isBusy || !canManageAgents) {
      return;
    }

    const agentId = row.agentId as EntityId<"agentId">;
    setSelectedAgentId(agentId);
    setIsEditReady(false);
    setIsEditLoading(true);
    setIsFormOpen(true);
    setPageError(null);
    setForm({
      mode: "edit",
      values: {
        name: row.name,
        role: row.role,
        model: row.model,
        instructions: "",
      },
    });

    try {
      const configuration = await apiClient.getAgentConfiguration(
        workspaceId,
        agentId,
      );
      setForm({
        mode: "edit",
        values: {
          name: configuration.name,
          role: configuration.role,
          model: configuration.model,
          instructions: configuration.instructions,
        },
      });
      setIsEditReady(true);
    } catch (error) {
      setForm((current) => ({
        ...current,
        errors: {
          form: messageFor(error, "Unable to load agent configuration."),
        },
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
        [field]: value,
      },
      errors: {
        ...current.errors,
        [field]: undefined,
        form: undefined,
      },
    }));
  }

  async function submitForm() {
    if (
      !canManageAgents ||
      pendingActionRef.current ||
      (form.mode === "edit" && !isEditReady)
    ) {
      return;
    }

    const actionKey =
      form.mode === "create" ? "create" : `update:${selectedAgentId}`;
    await runMutation(
      actionKey,
      async () => {
        if (form.mode === "create") {
          await apiClient.createAgent(workspaceId, form.values);
        } else if (selectedAgentId) {
          await apiClient.updateAgent(workspaceId, selectedAgentId, {
            role: form.values.role,
            model: form.values.model,
            instructions: form.values.instructions,
          });
        }

        await replaceAgents();
        closeForm(true);
        showSuccess(
          form.mode === "create"
            ? "Agent created successfully"
            : "Agent configured successfully",
        );
      },
      (error) => {
        showError(messageFor(error, "Unable to update the agent."));
        setForm((current) => ({
          ...current,
          errors: formErrorsFor(error),
        }));
      },
    );
  }

  async function handleDuplicate(row: AgentRowViewModel) {
    if (!canManageAgents || pendingActionRef.current) return;
    const agentId = row.agentId as EntityId<"agentId">;
    await runMutation(
      `duplicate:${agentId}`,
      async () => {
        await apiClient.duplicateAgent(workspaceId, agentId);
        await replaceAgents();
        showSuccess("Agent duplicated successfully");
      },
      (error) => showError(messageFor(error, "Unable to duplicate the agent.")),
    );
  }

  async function handleRenameSubmit(newName: string) {
    if (!renameAgentObj) return;
    const agentId = renameAgentObj.agentId as EntityId<"agentId">;
    try {
      await apiClient.renameAgent(workspaceId, agentId, newName);
      setRenameAgentObj(null);
      await replaceAgents();
      showSuccess("Agent renamed successfully");
    } catch (error) {
      setRenameError(messageFor(error, "Unable to rename agent."));
    }
  }

  async function performLifecycleAction(
    row: AgentRowViewModel,
    action: AgentRowAction,
  ) {
    if (!canManageAgents || pendingActionRef.current) return;

    if (action.kind === "delete") {
      setDeleteAgentObj(row);
      return;
    }

    const agentId = row.agentId as EntityId<"agentId">;
    await runMutation(
      `${action.kind}:${agentId}`,
      async () => {
        if (action.kind === "enable") {
          await apiClient.enableAgent(workspaceId, agentId);
          showSuccess("Agent enabled successfully");
        } else if (action.kind === "disable") {
          await apiClient.disableAgent(workspaceId, agentId);
          showSuccess("Agent disabled successfully");
        }
        await replaceAgents();
      },
      (error) => showError(messageFor(error, "Unable to update the agent.")),
    );
  }

  async function performDelete() {
    if (!deleteAgentObj) return;
    const agentId = deleteAgentObj.agentId as EntityId<"agentId">;
    await runMutation(
      `delete:${agentId}`,
      async () => {
        await apiClient.deleteAgent(workspaceId, agentId);
        await replaceAgents();
        showSuccess("Agent deleted successfully");
        setDeleteAgentObj(null);
        if (selectedAgentId === agentId) {
          setSelectedAgentId(null);
          setIsEditReady(false);
          setForm(createForm());
          setIsFormOpen(false);
        }
      },
      (error) => showError(messageFor(error, "Unable to delete the agent.")),
    );
  }

  function closeForm(force = false) {
    if (!force && pendingActionRef.current) {
      return;
    }

    setIsFormOpen(false);
    setSelectedAgentId(null);
    setIsEditReady(false);
    setIsEditLoading(false);
    setForm(createForm());
  }

  async function runMutation(
    actionKey: string,
    operation: () => Promise<void>,
    onError: (error: unknown) => void,
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
    <section
      className="agent-management-page"
      aria-labelledby="agent-management-title"
    >
      <header className="agent-topbar">
        <div className="agent-topbar__title">
          <Bot size={24} aria-hidden="true" />
          <div>
            <h1 id="agent-management-title">Agents</h1>
            <p>Configure the virtual workforce available in this workspace.</p>
          </div>
        </div>
        <div className="agent-topbar__actions">
          {canManageAgents ? (
            <button
              type="button"
              className="agent-primary-button"
              onClick={showCreateForm}
              disabled={isBusy}
            >
              <Plus size={18} aria-hidden="true" />
              New Agent
            </button>
          ) : (
            <span className="agent-viewer-pill" role="status">
              <UserRoundCheck size={16} aria-hidden="true" />
              Viewer
            </span>
          )}
        </div>
      </header>

      <section className="agent-hero" aria-label="Agent automation overview">
        <div
          className="agent-hero__image"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(21, 28, 39, 0.72), rgba(21, 28, 39, 0.32)), url(${agentsHeroUrl})`,
          }}
          aria-hidden="true"
        />
        <div className="agent-hero__content">
          <span className="agent-hero__eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            Agent Management
          </span>
          <h2>Let's automate with Agents</h2>
          <p>
            Track enabled and disabled agents, inspect configuration, and
            control lifecycle actions from one workspace dashboard.
          </p>
        </div>
      </section>

      <section className="agent-toolbar" aria-label="Agent list controls">
        <label className="agent-toolbar__search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search agents</span>
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search agents"
          />
        </label>
        <div className="agent-toolbar__actions">
          <div className="agent-toolbar__select-wrapper">
            <Filter
              size={17}
              aria-hidden="true"
              className="agent-toolbar__select-icon"
            />
            <select
              className="agent-toolbar__select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter agents"
            >
              <option value="All">All Statuses</option>
              <option value="Enabled">Enabled</option>
              <option value="Disabled">Disabled</option>
            </select>
            <ChevronDown size={14} className="agent-toolbar__select-chevron" />
          </div>

          <div className="agent-toolbar__select-wrapper">
            <ArrowUpDown
              size={17}
              aria-hidden="true"
              className="agent-toolbar__select-icon"
            />
            <select
              className="agent-toolbar__select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split("-") as [
                  string,
                  "asc" | "desc",
                ];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
              aria-label="Sort agents"
            >
              <option value="updatedAt-desc">Last modified</option>
              <option value="createdAt-desc">Created date</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
            <ChevronDown size={14} className="agent-toolbar__select-chevron" />
          </div>

          <div className="agent-view-toggle" aria-label="View mode">
            <button
              type="button"
              aria-label="List view"
              className="agent-view-toggle__btn active"
            >
              <List size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled
              aria-label="Grid view"
              className="agent-view-toggle__btn"
            >
              <Grid3X3 size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {pageError ? (
        <p className="agent-management-page__error" role="alert">
          {pageError}
        </p>
      ) : null}

      <div
        className={`agent-management${canManageAgents ? " agent-management--manager" : ""}`}
      >
        <section
          className="agent-list"
          aria-labelledby="agent-list-title"
          aria-busy={isBusy}
        >
          <div className="agent-list__header">
            <div>
              <h2 id="agent-list-title">Agent list</h2>
              <p>{viewModel.list.rows.length} workspace agents</p>
            </div>
            <dl
              className="agent-management-page__stats"
              aria-label="Agent status summary"
            >
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

          {isInitialLoading ? <AgentListSkeleton /> : null}
          {!isInitialLoading && initialLoadError ? (
            <div className="agent-list__error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <p>{initialLoadError}</p>
                <button type="button" onClick={() => void loadInitialAgents()}>
                  Retry
                </button>
              </div>
            </div>
          ) : null}
          {!isInitialLoading && !initialLoadError && viewModel.list.isEmpty ? (
            <AgentEmptyState
              canManageAgents={canManageAgents}
              onCreate={showCreateForm}
              hasFilters={search.length > 0 || statusFilter !== "All"}
              onClearFilters={() => {
                setSearch("");
                setStatusFilter("All");
              }}
            />
          ) : null}
          {!isInitialLoading && !initialLoadError && !viewModel.list.isEmpty ? (
            <>
              <AgentTable
                rows={viewModel.list.rows}
                disabled={isBusy}
                canManageAgents={canManageAgents}
                onEdit={showEditForm}
                onRename={(row) => {
                  setRenameAgentObj(row);
                  setRenameError(null);
                }}
                onDuplicate={handleDuplicate}
                onLifecycleAction={performLifecycleAction}
              />
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            </>
          ) : null}
        </section>

        {renameAgentObj && (
          <RenameDialog
            row={renameAgentObj}
            disabled={isBusy}
            error={renameError}
            onClose={() => setRenameAgentObj(null)}
            onSubmit={handleRenameSubmit}
          />
        )}

        {deleteAgentObj && (
          <ConfirmDeleteDialog
            row={deleteAgentObj}
            disabled={isBusy}
            onClose={() => setDeleteAgentObj(null)}
            onConfirm={performDelete}
          />
        )}

        {canManageAgents && isFormOpen ? (
          <AgentFormDialog
            form={viewModel.form}
            disabled={
              pendingAction !== null ||
              isEditLoading ||
              (form.mode === "edit" && !isEditReady)
            }
            isEditLoading={isEditLoading}
            onClose={() => closeForm()}
            onFieldChange={updateFormField}
            onSubmit={submitForm}
          />
        ) : null}

        {!canManageAgents ? (
          <aside
            className="agent-readonly-panel"
            aria-label="Viewer permissions"
          >
            <ShieldCheck size={22} aria-hidden="true" />
            <h2>Read-only access</h2>
            <p>
              Viewer mode can inspect agent metadata, status, and update
              history. Mutation actions are hidden until Workspace User
              Management supplies a role that can manage agents.
            </p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

type AgentFormDialogProps = AgentFormProps & {
  onClose: () => void;
};

function AgentFormDialog({
  form,
  disabled,
  isEditLoading,
  onClose,
  onFieldChange,
  onSubmit,
}: AgentFormDialogProps) {
  const dialogTitle =
    form.mode === "create" ? "Create agent" : "Configure agent";

  return (
    <div className="agent-modal-backdrop" role="presentation">
      <div
        className="agent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-form-title"
      >
        <button
          type="button"
          className="agent-modal__close"
          aria-label="Close agent form"
          onClick={onClose}
          disabled={disabled}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <AgentForm
          title={dialogTitle}
          form={form}
          disabled={disabled}
          isEditLoading={isEditLoading}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

type AgentTableProps = {
  rows: readonly AgentRowViewModel[];
  disabled: boolean;
  canManageAgents: boolean;
  onEdit: (row: AgentRowViewModel) => void;
  onRename: (row: AgentRowViewModel) => void;
  onDuplicate: (row: AgentRowViewModel) => void;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function AgentTable({
  rows,
  disabled,
  canManageAgents,
  onEdit,
  onRename,
  onDuplicate,
  onLifecycleAction,
}: AgentTableProps) {
  return (
    <div className="agent-table-wrap">
      <table className="agent-table" aria-label="Agents table">
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th scope="col">Role</th>
            <th scope="col">Model</th>
            <th scope="col">Status</th>
            <th scope="col">Updated</th>
            <th scope="col">Availability</th>
            {canManageAgents ? <th scope="col">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AgentRow
              key={row.agentId}
              row={row}
              disabled={disabled}
              canManageAgents={canManageAgents}
              onEdit={onEdit}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onLifecycleAction={onLifecycleAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AgentRowProps = {
  row: AgentRowViewModel;
  disabled: boolean;
  canManageAgents: boolean;
  onEdit: (row: AgentRowViewModel) => void;
  onRename: (row: AgentRowViewModel) => void;
  onDuplicate: (row: AgentRowViewModel) => void;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function AgentRow({
  row,
  disabled,
  canManageAgents,
  onEdit,
  onRename,
  onDuplicate,
  onLifecycleAction,
}: AgentRowProps) {
  const selectableLabel = row.canBeSelectedForNewWork
    ? "Selectable for new work"
    : "Unavailable for new work";

  return (
    <tr
      className={`agent-row agent-row--${row.statusTone}`}
      aria-current={row.isSelected ? "true" : undefined}
    >
      <td>
        <div className="agent-row__identity">
          <span className="agent-avatar" aria-hidden="true">
            <Bot size={17} />
          </span>
          <div>
            <h3>{row.name}</h3>
            <span>{formatDate(row.createdAt)}</span>
          </div>
        </div>
      </td>
      <td>{row.role}</td>
      <td>{row.model}</td>
      <td>
        <span
          className={`agent-row__status agent-row__status--${row.statusTone}`}
        >
          {row.statusLabel}
        </span>
      </td>
      <td>{formatDate(row.updatedAt)}</td>
      <td>{selectableLabel}</td>
      {canManageAgents ? (
        <td>
          <div
            className="agent-row__actions"
            aria-label={`Actions for ${row.name}`}
          >
            <button
              type="button"
              className="agent-menu-trigger"
              disabled={disabled}
              aria-label={`Open actions for ${row.name}`}
              aria-haspopup="true"
            >
              <MoreVertical size={20} aria-hidden="true" />
            </button>
            <div
              className="agent-action-menu"
              role="menu"
              aria-label={`Actions for ${row.name}`}
            >
              <button
                type="button"
                onClick={() => void onEdit(row)}
                disabled={disabled}
              >
                <Pencil size={17} aria-hidden="true" />
                Configure
              </button>
              {row.actions
                .filter((action) => action.kind !== "delete")
                .map((action) => (
                  <LifecycleButton
                    key={action.kind}
                    row={row}
                    action={action}
                    disabled={disabled}
                    onLifecycleAction={onLifecycleAction}
                  />
                ))}
              <button
                type="button"
                onClick={() => onRename(row)}
                disabled={disabled || !canManageAgents}
                aria-label={`Rename ${row.name}`}
              >
                <SquarePen size={17} aria-hidden="true" />
                Rename
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(row)}
                disabled={disabled || !canManageAgents}
                aria-label={`Duplicate ${row.name}`}
              >
                <Copy size={17} aria-hidden="true" />
                Duplicate
              </button>
              {row.actions
                .filter((action) => action.kind === "delete")
                .map((action) => (
                  <LifecycleButton
                    key={action.kind}
                    row={row}
                    action={action}
                    disabled={disabled}
                    onLifecycleAction={onLifecycleAction}
                  />
                ))}
            </div>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

type LifecycleButtonProps = {
  row: AgentRowViewModel;
  action: AgentRowAction;
  disabled: boolean;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function LifecycleButton({
  row,
  action,
  disabled,
  onLifecycleAction,
}: LifecycleButtonProps) {
  const Icon =
    action.kind === "enable"
      ? PlayCircle
      : action.kind === "disable"
        ? XCircle
        : Trash2;

  return (
    <button
      type="button"
      className={action.kind === "delete" ? "agent-menu-danger" : undefined}
      data-action={action.kind}
      data-agent-id={row.agentId}
      data-confirmation={
        action.requiresConfirmation
          ? "Deleting an agent prevents future selection."
          : undefined
      }
      onClick={() => void onLifecycleAction(row, action)}
      disabled={disabled}
      aria-label={`${action.label} ${row.name}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{action.label}</span>
    </button>
  );
}

type AgentEmptyStateProps = {
  canManageAgents: boolean;
  onCreate: () => void;
  hasFilters?: boolean;
  onClearFilters?: () => void;
};

function AgentEmptyState({
  canManageAgents,
  onCreate,
  hasFilters,
  onClearFilters,
}: AgentEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="agent-empty-state">
        <div className="agent-empty-state__icon" aria-hidden="true">
          <Search size={28} />
        </div>
        <p className="empty-label">No results found</p>
        <h3>No agents match your filters</h3>
        <p>
          Try adjusting your search query or status filter to find what you're
          looking for.
        </p>
        <button
          type="button"
          className="agent-secondary-button"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="agent-empty-state">
      <div className="agent-empty-state__icon" aria-hidden="true">
        <Bot size={28} />
      </div>
      <p className="empty-label">No active agents yet.</p>
      <h3>Build your first virtual teammate</h3>
      <p>
        Agents hold role, model, and instruction settings for work inside this
        workspace.
      </p>
      {canManageAgents ? (
        <button
          type="button"
          className="agent-primary-button"
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Create first agent
        </button>
      ) : (
        <span className="agent-viewer-pill">
          <UserRoundCheck size={16} aria-hidden="true" />
          Viewer access
        </span>
      )}
    </div>
  );
}

function AgentListSkeleton() {
  return (
    <div className="agent-skeleton">
      <p className="sr-only" role="status">
        Loading agents...
      </p>
      <div aria-hidden="true">
        <div className="agent-skeleton__hero" />
        <div className="agent-skeleton__toolbar">
          <span />
          <span />
          <span />
        </div>
        {[0, 1, 2].map((item) => (
          <div className="agent-skeleton__row" key={item}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

type AgentFormProps = {
  title?: string;
  form: ReturnType<typeof createAgentManagementViewModel>["form"];
  disabled: boolean;
  isEditLoading: boolean;
  onFieldChange: (field: AgentFormField, value: string) => void;
  onSubmit: () => void;
};

function AgentForm({
  title,
  form,
  disabled,
  isEditLoading,
  onFieldChange,
  onSubmit,
}: AgentFormProps) {
  const formTitleId = "agent-form-title";

  return (
    <form
      className="agent-form"
      data-mode={form.mode}
      noValidate
      aria-busy={disabled}
      aria-labelledby={formTitleId}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="agent-form__header">
        <span className="agent-form__icon" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div>
          <h2 id={formTitleId}>{title ?? form.title}</h2>
          <p>
            {form.mode === "create"
              ? "Define a new workspace agent."
              : "Update agent behavior."}
          </p>
        </div>
      </div>
      {isEditLoading ? <p role="status">Loading configuration...</p> : null}
      {form.errors.form ? (
        <p className="agent-form__error" role="alert">
          {form.errors.form}
        </p>
      ) : null}
      <FormField
        field="name"
        label="Name"
        hint="Give your agent a unique, descriptive name."
        value={form.values.name}
        error={form.errors.name}
        readOnly={form.mode === "edit"}
        disabled={disabled}
        onFieldChange={onFieldChange}
      />
      <FormField
        field="role"
        label="Role"
        hint="What is this agent's primary function? (e.g. Data Analyst, UX Researcher)"
        value={form.values.role}
        error={form.errors.role}
        disabled={disabled}
        onFieldChange={onFieldChange}
      />
      <FormField
        field="model"
        label="Model"
        hint="Which LLM should power this agent? (e.g. gpt-4o, claude-3-5-sonnet)"
        value={form.values.model}
        error={form.errors.model}
        disabled={disabled}
        onFieldChange={onFieldChange}
      />
      <FormField
        field="instructions"
        label="Instructions"
        hint="Provide a detailed system prompt and behavioral guidelines for the agent."
        value={form.values.instructions}
        error={form.errors.instructions}
        disabled={disabled}
        onFieldChange={onFieldChange}
      />
      <button
        type="submit"
        className="agent-primary-button"
        disabled={disabled}
      >
        {disabled
          ? isEditLoading
            ? "Loading..."
            : "Saving..."
          : form.submitLabel}
      </button>
    </form>
  );
}

type FormFieldProps = {
  field: keyof AgentFormState["values"];
  label: string;
  value: string;
  error?: string;
  hint?: string;
  readOnly?: boolean;
  disabled?: boolean;
  onFieldChange: (field: string, value: string) => void;
};

function FormField({
  field,
  label,
  value,
  error,
  hint,
  readOnly = false,
  disabled = false,
  onFieldChange,
}: FormFieldProps) {
  const fieldId = `agent-${field}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const invalidProps = error
    ? { "aria-invalid": true, "aria-describedby": describedBy }
    : hint
      ? { "aria-describedby": describedBy }
      : {};

  const commonProps = {
    id: fieldId,
    name: field,
    value,
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onFieldChange(field, event.target.value),
    ...invalidProps,
  };

  return (
    <div className="agent-form__field">
      <label htmlFor={fieldId}>{label}</label>
      {hint ? (
        <p className="agent-form__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {field === "instructions" ? (
        <textarea {...commonProps} />
      ) : (
        <input {...commonProps} readOnly={readOnly} />
      )}
      {error ? (
        <span id={errorId} className="agent-form__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function createForm(): AgentFormState {
  return { mode: "create", values: { ...createFormValues } };
}

function formErrorsFor(error: unknown): AgentFormState["errors"] {
  if (
    error instanceof AgentApiClientError &&
    error.code === "validation.invalid_input"
  ) {
    const issues = Array.isArray(error.details?.issues)
      ? error.details.issues
      : [];
    const errors: AgentFormState["errors"] = {};

    for (const issue of issues) {
      if (typeof issue !== "string") {
        continue;
      }

      const field = (["name", "role", "model", "instructions"] as const).find(
        (candidate) => issue.startsWith(candidate),
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
    timeStyle: "short",
  }).format(new Date(value));
}
