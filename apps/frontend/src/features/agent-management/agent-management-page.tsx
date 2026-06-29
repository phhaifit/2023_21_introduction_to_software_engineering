import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Bot,
  Brain,
  Copy,
  FileText,
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
  Upload,
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
import type {
  AgentCreationAssistantDraft,
  AgentCreationAssistantDraftResponse,
  AgentModelCatalogEntry,
  AgentPublicSummary,
} from "@vcp/shared/contracts/agent-management.ts";
import agentsHeroUrl from "../../assets/agent-management/agents-hero.png";
import {
  AgentApiClientError,
  createAgentManagementApiClient,
  type AgentEditableConfiguration,
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
  model: "gemini-2.5-flash",
  instructions: "",
};

type GuidedCreateMode = "template" | "prompt" | "import";

type TemplateDraftField =
  | "name"
  | "role"
  | "model"
  | "responsibilities"
  | "operatingContext"
  | "instructions"
  | "requestedTools"
  | "requestedKnowledge"
  | "constraints"
  | "escalationRules"
  | "exampleTasks";

type TemplateDraftState = Record<TemplateDraftField, string>;

type TemplateDraftErrors = Partial<
  Record<
    "name" | "role" | "model" | "instructions" | "requestedTools" | "requestedKnowledge" | "form",
    string
  >
>;

const templateDraftValues: TemplateDraftState = {
  name: "",
  role: "",
  model: "gemini-2.5-flash",
  responsibilities: "",
  operatingContext: "",
  instructions: "",
  requestedTools: "",
  requestedKnowledge: "",
  constraints: "",
  escalationRules: "",
  exampleTasks: "",
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
  const [guidedCreateMode, setGuidedCreateMode] =
    useState<GuidedCreateMode>("template");
  const [templateDraft, setTemplateDraft] =
    useState<TemplateDraftState>(createTemplateDraft());
  const [templateDraftErrors, setTemplateDraftErrors] =
    useState<TemplateDraftErrors>({});
  const [modelCatalog, setModelCatalog] = useState<AgentModelCatalogEntry[]>(
    [],
  );
  const [modelCatalogError, setModelCatalogError] = useState<string | null>(
    null,
  );
  const [isModelCatalogLoading, setIsModelCatalogLoading] = useState(false);
  const [skillPreviewMarkdown, setSkillPreviewMarkdown] = useState("");
  const [skillPreviewError, setSkillPreviewError] = useState<string | null>(
    null,
  );
  const [isSkillPreviewLoading, setIsSkillPreviewLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isEditReady, setIsEditReady] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [infoAgentId, setInfoAgentId] =
    useState<EntityId<"agentId"> | null>(null);
  const [infoConfiguration, setInfoConfiguration] =
    useState<AgentEditableConfiguration | null>(null);
  const [infoConfigurationError, setInfoConfigurationError] =
    useState<string | null>(null);
  const [isInfoConfigurationLoading, setIsInfoConfigurationLoading] =
    useState(false);
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
  const skillPreviewRequestId = useRef(0);

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

  useEffect(() => {
    if (!isFormOpen || form.mode !== "create") {
      return;
    }

    let cancelled = false;
    setIsModelCatalogLoading(true);
    setModelCatalogError(null);

    apiClient
      .listAgentModels(workspaceId)
      .then((models) => {
        if (cancelled) {
          return;
        }

        setModelCatalog(models);
        setTemplateDraft((current) =>
          models.some((model) => model.modelId === current.model) || !models[0]
            ? current
            : { ...current, model: models[0].modelId },
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setModelCatalog([]);
          setModelCatalogError(
            messageFor(error, "Unable to load available models."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsModelCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, form.mode, isFormOpen, workspaceId]);

  useEffect(() => {
    if (!isFormOpen || form.mode !== "create") {
      return;
    }

    const previewInput = templateDraftToSkillPreviewInput(templateDraft);
    const requiredErrors = validateTemplateDraft(templateDraft);
    const hasRequiredErrors = Object.keys(requiredErrors).length > 0;

    if (hasRequiredErrors || modelCatalogError) {
      skillPreviewRequestId.current += 1;
      setSkillPreviewMarkdown("");
      setIsSkillPreviewLoading(false);
      setSkillPreviewError(null);
      return;
    }

    const requestId = skillPreviewRequestId.current + 1;
    skillPreviewRequestId.current = requestId;
    setIsSkillPreviewLoading(true);
    setSkillPreviewError(null);

    const timeoutId = window.setTimeout(() => {
      apiClient
        .previewSkillMarkdown(workspaceId, previewInput)
        .then((preview) => {
          if (skillPreviewRequestId.current === requestId) {
            setSkillPreviewMarkdown(preview.markdown);
          }
        })
        .catch((error) => {
          if (skillPreviewRequestId.current === requestId) {
            setSkillPreviewMarkdown("");
            setSkillPreviewError(
              messageFor(error, "Unable to render skill.md preview."),
            );
          }
        })
        .finally(() => {
          if (skillPreviewRequestId.current === requestId) {
            setIsSkillPreviewLoading(false);
          }
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [apiClient, form.mode, isFormOpen, modelCatalogError, templateDraft, workspaceId]);

  const viewModel = useMemo(
    () =>
      createAgentManagementViewModel({
        agents,
        selectedAgentId: infoAgentId ?? selectedAgentId,
        form,
      }),
    [agents, form, infoAgentId, selectedAgentId],
  );

  const enabledCount = viewModel.list.rows.filter(
    (row) => row.status === "enabled",
  ).length;
  const disabledCount = viewModel.list.rows.filter(
    (row) => row.status === "disabled",
  ).length;
  const totalCount = viewModel.list.rows.length;
  const selectedInfoRow = useMemo(
    () => viewModel.list.rows.find((row) => row.agentId === infoAgentId) ?? null,
    [infoAgentId, viewModel.list.rows],
  );
  const isBusy = pendingAction !== null || isEditLoading;

  function showCreateForm() {
    if (isBusy || !canManageAgents) {
      return;
    }

    setSelectedAgentId(null);
    setIsEditReady(false);
    setPageError(null);
    setForm(createForm());
    setGuidedCreateMode("template");
    setTemplateDraft(createTemplateDraft());
    setTemplateDraftErrors({});
    setModelCatalog([]);
    setModelCatalogError(null);
    setSkillPreviewMarkdown("");
    setSkillPreviewError(null);
    setIsSkillPreviewLoading(false);
    setIsFormOpen(true);
  }

  const loadInfoConfiguration = useCallback(
    async (agentId: EntityId<"agentId">) => {
      setIsInfoConfigurationLoading(true);
      setInfoConfigurationError(null);

      try {
        const configuration = await apiClient.getAgentConfiguration(
          workspaceId,
          agentId,
        );
        setInfoConfiguration(configuration);
      } catch (error) {
        setInfoConfiguration(null);
        setInfoConfigurationError(
          messageFor(error, "Unable to load agent configuration."),
        );
      } finally {
        setIsInfoConfigurationLoading(false);
      }
    },
    [apiClient, workspaceId],
  );

  function showAgentInfo(row: AgentRowViewModel) {
    if (pendingActionRef.current) {
      return;
    }

    const agentId = row.agentId as EntityId<"agentId">;
    setInfoAgentId(agentId);
    setSelectedAgentId(null);
    setInfoConfiguration(null);
    setInfoConfigurationError(null);
    void loadInfoConfiguration(agentId);
  }

  function closeAgentInfo() {
    if (pendingActionRef.current) {
      return;
    }

    setInfoAgentId(null);
    setInfoConfiguration(null);
    setInfoConfigurationError(null);
    setIsInfoConfigurationLoading(false);
  }

  function configureFromInfo(row: AgentRowViewModel) {
    closeAgentInfo();
    void showEditForm(row);
  }

  function renameFromInfo(row: AgentRowViewModel) {
    closeAgentInfo();
    setRenameAgentObj(row);
    setRenameError(null);
  }

  function deleteFromInfo(row: AgentRowViewModel) {
    closeAgentInfo();
    setDeleteAgentObj(row);
  }

  async function duplicateFromInfo(row: AgentRowViewModel) {
    await handleDuplicate(row);
  }

  async function lifecycleFromInfo(row: AgentRowViewModel, action: AgentRowAction) {
    if (action.kind === "delete") {
      deleteFromInfo(row);
      return;
    }

    await performLifecycleAction(row, action);
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

  function updateTemplateDraftField(field: TemplateDraftField, value: string) {
    setTemplateDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setTemplateDraftErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  }

  async function submitTemplateDraft() {
    if (!canManageAgents || pendingActionRef.current) {
      return;
    }

    const errors = validateTemplateDraft(templateDraft);
    const selectedModelAvailable = modelCatalog.some(
      (model) => model.modelId === templateDraft.model,
    );

    if (modelCatalogError) {
      setTemplateDraftErrors({
        form: "Available models must load before creating an agent.",
      });
      return;
    }

    if (!selectedModelAvailable) {
      setTemplateDraftErrors({
        ...errors,
        model: "Select an available model.",
      });
      return;
    }

    if (Object.keys(errors).length > 0) {
      setTemplateDraftErrors(errors);
      return;
    }

    await runMutation(
      "create",
      async () => {
        await apiClient.createAgent(workspaceId, {
          name: templateDraft.name.trim(),
          role: templateDraft.role.trim(),
          model: templateDraft.model,
          instructions: buildCreateInstructionsFromDraft(templateDraft),
          responsibilities: splitDraftLines(templateDraft.responsibilities),
          operatingContext: templateDraft.operatingContext.trim() || undefined,
          requestedTools: parseToolReferences(templateDraft.requestedTools),
          requestedKnowledge: parseKnowledgeReferences(templateDraft.requestedKnowledge),
          constraints: splitDraftLines(templateDraft.constraints),
          escalationRules: splitDraftLines(templateDraft.escalationRules),
          exampleTasks: splitDraftLines(templateDraft.exampleTasks),
        });
        await replaceAgents();
        closeForm(true);
        showSuccess("Agent created successfully");
      },
      (error) => {
        showError(messageFor(error, "Unable to create the agent."));
        setTemplateDraftErrors(templateDraftErrorsFor(error));
      },
    );
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
        if (infoAgentId === agentId) {
          setInfoAgentId(null);
          setInfoConfiguration(null);
          setInfoConfigurationError(null);
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
    setGuidedCreateMode("template");
    setTemplateDraft(createTemplateDraft());
    setTemplateDraftErrors({});
    setModelCatalog([]);
    setModelCatalogError(null);
    setSkillPreviewMarkdown("");
    setSkillPreviewError(null);
    setIsSkillPreviewLoading(false);
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

  const acceptAssistantDraft = useCallback((draft: AgentCreationAssistantDraft) => {
    setTemplateDraft({
      name: draft.name,
      role: draft.role,
      model: draft.model,
      instructions: draft.instructions,
      responsibilities: draft.responsibilities?.join("\n") || "",
      operatingContext: draft.operatingContext || "",
      requestedTools: formatToolReferences(draft.requestedTools),
      requestedKnowledge: formatKnowledgeReferences(draft.requestedKnowledge),
      constraints: draft.constraints?.join("\n") || "",
      escalationRules: draft.escalationRules?.join("\n") || "",
      exampleTasks: draft.exampleTasks?.join("\n") || "",
    });
    setGuidedCreateMode("template");
  }, []);

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
            <p>Create and tune the AI agents available in this workspace.</p>
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

      <section className="agent-hero" aria-label="Agent setup overview">
        <div
          className="agent-hero__image"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(17, 30, 36, 0.78), rgba(17, 30, 36, 0.34)), url(${agentsHeroUrl})`,
          }}
          aria-hidden="true"
        />
        <div className="agent-hero__content">
          <span className="agent-hero__eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            Agent setup
          </span>
          <h2>Set up agents with the right role, model, and instructions.</h2>
          <p>
            Keep each agent profile easy to scan, configure, and update while
            the table stays close for repeated setup work.
          </p>
          <dl className="agent-hero__stats" aria-label="Current workspace agent summary">
            <div>
              <dt>Total</dt>
              <dd>{totalCount}</dd>
            </div>
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

          {search.length > 0 || statusFilter !== "All" ? (
            <button
              type="button"
              className="agent-filter-reset"
              onClick={() => {
                setSearch("");
                setStatusFilter("All");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : null}

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
              <p>
                Showing {viewModel.list.rows.length} agent
                {viewModel.list.rows.length === 1 ? "" : "s"} from this workspace.
              </p>
            </div>
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
                onOpenInfo={showAgentInfo}
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

        {selectedInfoRow ? (
          <AgentInfoDialog
            row={selectedInfoRow}
            configuration={infoConfiguration}
            configurationError={infoConfigurationError}
            isConfigurationLoading={isInfoConfigurationLoading}
            canManageAgents={canManageAgents}
            disabled={isBusy}
            onClose={closeAgentInfo}
            onRetry={() =>
              void loadInfoConfiguration(
                selectedInfoRow.agentId as EntityId<"agentId">,
              )
            }
            onConfigure={configureFromInfo}
            onRename={renameFromInfo}
            onDuplicate={(row) => void duplicateFromInfo(row)}
            onLifecycleAction={(row, action) => void lifecycleFromInfo(row, action)}
          />
        ) : null}

        {deleteAgentObj && (
          <ConfirmDeleteDialog
            row={deleteAgentObj}
            disabled={isBusy}
            onClose={() => setDeleteAgentObj(null)}
            onConfirm={performDelete}
          />
        )}

        {canManageAgents && isFormOpen && form.mode === "create" ? (
          <GuidedCreateDialog
            workspaceId={workspaceId}
            apiClient={apiClient}
            activeMode={guidedCreateMode}
            draft={templateDraft}
            errors={templateDraftErrors}
            models={modelCatalog}
            modelCatalogError={modelCatalogError}
            isModelCatalogLoading={isModelCatalogLoading}
            skillPreviewMarkdown={skillPreviewMarkdown}
            skillPreviewError={skillPreviewError}
            isSkillPreviewLoading={isSkillPreviewLoading}
            disabled={pendingAction !== null}
            onModeChange={setGuidedCreateMode}
            onClose={() => closeForm()}
            onDraftChange={updateTemplateDraftField}
            onSubmit={submitTemplateDraft}
            onAcceptAssistantDraft={acceptAssistantDraft}
          />
        ) : null}

        {canManageAgents && isFormOpen && form.mode === "edit" ? (
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

type GuidedCreateDialogProps = {
  workspaceId: string;
  apiClient: AgentManagementApiClient;
  activeMode: GuidedCreateMode;
  draft: TemplateDraftState;
  errors: TemplateDraftErrors;
  models: AgentModelCatalogEntry[];
  modelCatalogError: string | null;
  isModelCatalogLoading: boolean;
  skillPreviewMarkdown: string;
  skillPreviewError: string | null;
  isSkillPreviewLoading: boolean;
  disabled: boolean;
  onModeChange: (mode: GuidedCreateMode) => void;
  onClose: () => void;
  onDraftChange: (field: TemplateDraftField, value: string) => void;
  onSubmit: () => void;
  onAcceptAssistantDraft: (draft: AgentCreationAssistantDraft) => void;
};

function GuidedCreateDialog({
  workspaceId,
  apiClient,
  activeMode,
  draft,
  errors,
  models,
  modelCatalogError,
  isModelCatalogLoading,
  skillPreviewMarkdown,
  skillPreviewError,
  isSkillPreviewLoading,
  disabled,
  onModeChange,
  onClose,
  onDraftChange,
  onSubmit,
  onAcceptAssistantDraft,
}: GuidedCreateDialogProps) {
  const guidedDialogRef = useRef<HTMLDivElement>(null);
  const requiredErrors = validateTemplateDraft(draft);
  const selectedModelAvailable = models.some(
    (model) => model.modelId === draft.model,
  );
  const isSubmitDisabled =
    disabled ||
    isModelCatalogLoading ||
    Boolean(modelCatalogError) ||
    hasBlockingDraftErrors(errors) ||
    !selectedModelAvailable ||
    Object.keys(requiredErrors).length > 0;
  const modeSummary = {
    template: {
      title: "Start from a structured template",
      description: "Fill the profile, review the generated skill.md, then create the agent.",
    },
    prompt: {
      title: "Describe the agent in plain language",
      description: "Generate an editable draft from a natural-language brief.",
    },
    import: {
      title: "Import an existing skill.md",
      description: "Analyze Markdown and turn it into an editable Agent draft.",
    },
  }[activeMode];

  useEffect(() => {
    if (guidedDialogRef.current) {
      guidedDialogRef.current.scrollTop = 0;
    }
  }, [activeMode]);

  return (
    <div className="agent-modal-backdrop" role="presentation">
      <div
        ref={guidedDialogRef}
        className="agent-modal agent-guided-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-guided-title"
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

        <div className="agent-guided">
          <header className="agent-guided__header">
            <span className="agent-form__icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 id="agent-guided-title">Create agent</h2>
              <p>{modeSummary.description}</p>
            </div>
          </header>

          <div className="agent-guided__entry-points" role="tablist">
            <GuidedEntryButton
              mode="template"
              activeMode={activeMode}
              icon={<FileText size={17} aria-hidden="true" />}
              label="Template"
              onModeChange={onModeChange}
            />
            <GuidedEntryButton
              mode="prompt"
              activeMode={activeMode}
              icon={<Brain size={17} aria-hidden="true" />}
              label="Prompt Assistant"
              onModeChange={onModeChange}
            />
            <GuidedEntryButton
              mode="import"
              activeMode={activeMode}
              icon={<Upload size={17} aria-hidden="true" />}
              label="Import skill.md"
              onModeChange={onModeChange}
            />
          </div>
          <div className="agent-guided__mode-summary">
            <span>Current mode</span>
            <strong>{modeSummary.title}</strong>
          </div>

          {activeMode === "template" ? (
            <TemplateDraftForm
              draft={draft}
              errors={errors}
              models={models}
              modelCatalogError={modelCatalogError}
              isModelCatalogLoading={isModelCatalogLoading}
              skillPreviewMarkdown={skillPreviewMarkdown}
              skillPreviewError={skillPreviewError}
              isSkillPreviewLoading={isSkillPreviewLoading}
              disabled={disabled}
              isSubmitDisabled={isSubmitDisabled}
              onDraftChange={onDraftChange}
              onSubmit={onSubmit}
            />
          ) : activeMode === "prompt" ? (
            <PromptAssistantPanel
              workspaceId={workspaceId}
              apiClient={apiClient}
              onAccept={onAcceptAssistantDraft}
            />
          ) : (
            <SkillImportPanel
              workspaceId={workspaceId}
              apiClient={apiClient}
              onAccept={onAcceptAssistantDraft}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PromptAssistantPanel({
  workspaceId,
  apiClient,
  onAccept,
}: {
  workspaceId: EntityId<"workspaceId">;
  apiClient: AgentManagementApiClient;
  onAccept: (draft: AgentCreationAssistantDraft) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftResult, setDraftResult] = useState<AgentCreationAssistantDraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const examplePrompts = [
    "Create a research agent that summarizes competitor updates every week.",
    "Create a support agent that drafts careful replies from product docs.",
    "Create a content agent that turns briefs into social posts and outlines.",
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setDraftResult(null);
    try {
      const response = await apiClient.createAssistantDraft(workspaceId, { prompt });
      setDraftResult(response);
    } catch (err: any) {
      setError(err.message || "Failed to generate draft. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (draftResult?.draft) {
    return (
      <AssistantDraftReview
        icon={<Brain size={24} aria-hidden="true" />}
        title="Draft Ready"
        result={draftResult}
        onDiscard={() => setDraftResult(null)}
        onAccept={onAccept}
      />
    );
  }

  return (
    <section className="agent-guided__mode-panel" aria-live="polite">
      <div className="agent-guided__mode-intro">
        <span className="agent-guided__mode-icon" aria-hidden="true">
          <Brain size={22} />
        </span>
        <div>
          <h3>Prompt Assistant</h3>
          <p>
            Describe the outcome, source material, and boundaries. The assistant
            will turn it into a draft you can inspect before creating.
          </p>
        </div>
      </div>

      <div className="agent-guided__assistant-layout">
        <div className="agent-form__field">
          <label htmlFor="agent-assistant-prompt">Agent description</label>
          <textarea
            id="agent-assistant-prompt"
            className="agent-form__textarea agent-guided__large-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: I need an agent that monitors customer feedback, finds recurring issues, and drafts a weekly insight report."
            disabled={isGenerating}
            rows={8}
          />
          <p className="agent-form__hint">
            Include the agent's role, decisions it can make, source material, and
            what it should avoid.
          </p>
        </div>

        <aside className="agent-guided__assist-card" aria-label="Prompt examples">
          <h4>Useful starting points</h4>
          <p>Pick an example and edit it to match your workspace.</p>
          <div className="agent-guided__chips">
            {examplePrompts.map((example) => (
              <button
                key={example}
                type="button"
                className="agent-helper-chip"
                disabled={isGenerating}
                onClick={() => setPrompt(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {error && <p className="agent-form__error" role="alert">{error}</p>}
      
      {draftResult?.clarifyingQuestions && draftResult.clarifyingQuestions.length > 0 && (
        <div className="agent-draft-questions">
          <h4>Clarifying Questions</h4>
          <ul>
            {draftResult.clarifyingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="agent-guided__action-row">
        <p>{prompt.trim() ? "Ready to generate an editable draft." : "Add a short brief to continue."}</p>
        <button
          type="button"
          className="agent-primary-button"
          disabled={isGenerating || !prompt.trim()}
          onClick={handleGenerate}
        >
          {isGenerating ? "Generating..." : (draftResult ? "Retry" : "Generate draft")}
        </button>
      </div>
    </section>
  );
}

function SkillImportPanel({
  workspaceId,
  apiClient,
  onAccept,
}: {
  workspaceId: EntityId<"workspaceId">;
  apiClient: AgentManagementApiClient;
  onAccept: (draft: AgentCreationAssistantDraft) => void;
}) {
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [draftResult, setDraftResult] =
    useState<AgentCreationAssistantDraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setError(null);
    setDraftResult(null);
    setMarkdown(await file.text());
  };

  const handleAnalyze = async () => {
    if (!markdown.trim()) {
      setError("Markdown content is required.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setDraftResult(null);

    try {
      const response = await apiClient.analyzeSkillImport(workspaceId, {
        markdown,
        fileName,
      });
      setDraftResult(response);
    } catch (err) {
      setError(messageFor(err, "Unable to analyze skill.md. Please try again."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (draftResult?.draft) {
    return (
      <AssistantDraftReview
        icon={<Upload size={24} aria-hidden="true" />}
        title="Imported Draft Ready"
        result={draftResult}
        onDiscard={() => setDraftResult(null)}
        onAccept={onAccept}
      />
    );
  }

  return (
    <section className="agent-guided__mode-panel" aria-live="polite">
      <div className="agent-guided__mode-intro">
        <span className="agent-guided__mode-icon" aria-hidden="true">
          <Upload size={22} />
        </span>
        <div>
          <h3>Import skill.md</h3>
          <p>
            Paste Markdown or choose a file. Nothing is created until you review
            the extracted draft.
          </p>
        </div>
      </div>

      <div className="agent-guided__import-layout">
        <div className="agent-file-drop">
          <FileText size={24} aria-hidden="true" />
          <div>
            <strong>{fileName ?? "Choose a Markdown file"}</strong>
            <p>.md, .markdown, or plain text files are supported.</p>
          </div>
          <label className="agent-secondary-button" htmlFor="agent-skill-import-file">
            Choose file
          </label>
          <input
            id="agent-skill-import-file"
            className="agent-file-drop__input"
            type="file"
            aria-label="Markdown file"
            accept=".md,.markdown,text/markdown,text/plain"
            disabled={isAnalyzing}
            onChange={(event) => void handleFileChange(event)}
          />
        </div>

        <div className="agent-form__field">
        <label htmlFor="agent-skill-import-markdown">Markdown content</label>
        <textarea
          id="agent-skill-import-markdown"
          className="agent-form__textarea agent-guided__large-textarea"
          value={markdown}
          onChange={(event) => {
            setMarkdown(event.target.value);
            setDraftResult(null);
            setError(null);
          }}
          placeholder="# Support Agent&#10;&#10;## Role&#10;Customer support specialist"
          disabled={isAnalyzing}
          rows={10}
        />
          <p className="agent-form__hint">
            Keep headings and bullet lists. The analyzer extracts identity,
            instructions, tools, knowledge, and constraints into an editable draft.
          </p>
        </div>
      </div>

      {error ? (
        <p className="agent-form__error" role="alert">
          {error}
        </p>
      ) : null}

      {draftResult?.clarifyingQuestions.length ? (
        <ClarifyingQuestions questions={draftResult.clarifyingQuestions} />
      ) : null}

      <div className="agent-guided__action-row">
        <p>{markdown.trim() ? "Markdown is ready to analyze." : "Paste Markdown or choose a file to continue."}</p>
        <button
          type="button"
          className="agent-primary-button"
          disabled={isAnalyzing || !markdown.trim()}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? "Analyzing..." : error ? "Retry analysis" : "Analyze skill.md"}
        </button>
      </div>
    </section>
  );
}

function AssistantDraftReview({
  icon,
  title,
  result,
  onDiscard,
  onAccept,
}: {
  icon: ReactNode;
  title: string;
  result: AgentCreationAssistantDraftResponse & { draft: AgentCreationAssistantDraft };
  onDiscard: () => void;
  onAccept: (draft: AgentCreationAssistantDraft) => void;
}) {
  const draft = result.draft;
  const provider = result.provider;

  return (
    <section className="agent-guided__mode-panel agent-guided__prompt-review" aria-live="polite">
      <div className="agent-guided__mode-intro">
        <span className="agent-guided__mode-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3>{title}</h3>
          <p>Review the generated profile before editing it in Template mode.</p>
        </div>
      </div>
      {provider && provider.fallbackUsed ? (
        <p className="agent-warning-text">
          Note: Primary provider failed. Used fallback provider: {provider.modelId}
        </p>
      ) : null}
      <div className="agent-draft-preview">
        <h4>{draft.name}</h4>
        <dl>
          <div>
            <dt>Role</dt>
            <dd>{draft.role}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{draft.model}</dd>
          </div>
        </dl>
        {draft.requestedTools?.length ? (
          <p><strong>Requested tools:</strong> {draft.requestedTools.map((tool) => tool.name).join(", ")}</p>
        ) : null}
        {draft.requestedKnowledge?.length ? (
          <p><strong>Requested knowledge:</strong> {draft.requestedKnowledge.map((item) => item.title).join(", ")}</p>
        ) : null}
      </div>

      {result.warnings.length > 0 ? (
        <div className="agent-draft-warnings">
          <h4>Warnings</h4>
          <ul>
            {result.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.clarifyingQuestions.length > 0 ? (
        <ClarifyingQuestions questions={result.clarifyingQuestions} />
      ) : null}

      <div className="agent-guided__action-row">
        <p>Open the draft in Template mode to make final edits and create it.</p>
        <button
          type="button"
          className="agent-secondary-button"
          onClick={onDiscard}
        >
          Discard
        </button>
        <button
          type="button"
          className="agent-primary-button"
          onClick={() => onAccept(draft)}
        >
          Edit in Template
        </button>
      </div>
    </section>
  );
}

function ClarifyingQuestions({ questions }: { questions: string[] }) {
  return (
    <div className="agent-draft-questions">
      <h4>Clarifying Questions</h4>
      <ul>
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </div>
  );
}

type GuidedEntryButtonProps = {
  mode: GuidedCreateMode;
  activeMode: GuidedCreateMode;
  icon: ReactNode;
  label: string;
  onModeChange: (mode: GuidedCreateMode) => void;
};

function GuidedEntryButton({
  mode,
  activeMode,
  icon,
  label,
  onModeChange,
}: GuidedEntryButtonProps) {
  const isActive = mode === activeMode;
  const labelId = `agent-guided-${mode}-tab`;

  return (
    <button
      type="button"
      id={labelId}
      role="tab"
      aria-selected={isActive}
      className={`agent-guided__entry${isActive ? " agent-guided__entry--active" : ""}`}
      onClick={() => onModeChange(mode)}
    >
      {icon}
      {label}
    </button>
  );
}

type TemplateDraftFormProps = {
  draft: TemplateDraftState;
  errors: TemplateDraftErrors;
  models: AgentModelCatalogEntry[];
  modelCatalogError: string | null;
  isModelCatalogLoading: boolean;
  skillPreviewMarkdown: string;
  skillPreviewError: string | null;
  isSkillPreviewLoading: boolean;
  disabled: boolean;
  isSubmitDisabled: boolean;
  onDraftChange: (field: TemplateDraftField, value: string) => void;
  onSubmit: () => void;
};

function TemplateDraftForm({
  draft,
  errors,
  models,
  modelCatalogError,
  isModelCatalogLoading,
  skillPreviewMarkdown,
  skillPreviewError,
  isSkillPreviewLoading,
  disabled,
  isSubmitDisabled,
  onDraftChange,
  onSubmit,
}: TemplateDraftFormProps) {
  const missingFields = missingTemplateDraftFields(draft);

  return (
    <form
      className="agent-guided__body"
      noValidate
      aria-busy={disabled}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="agent-guided__draft">
        {errors.form ? (
          <p className="agent-form__error" role="alert">
            {errors.form}
          </p>
        ) : null}
        <div className="agent-guided__section">
          <div className="agent-guided__section-header">
            <h3>Agent identity</h3>
            <p>Name the agent and choose the model users will configure.</p>
          </div>
          <div className="agent-guided__section-grid agent-guided__section-grid--two">
            <DraftField
              field="name"
              label="Name"
              value={draft.name}
              error={errors.name}
              required
              disabled={disabled}
              placeholder="Research Agent"
              hint="Use a name users can recognize in the Agent list."
              onDraftChange={onDraftChange}
            />
            <DraftField
              field="role"
              label="Role"
              value={draft.role}
              error={errors.role}
              required
              disabled={disabled}
              placeholder="Market researcher"
              hint="Describe the agent's setup role, not a task assignment."
              onDraftChange={onDraftChange}
            />
          </div>
          <div className="agent-form__field">
            <label htmlFor="agent-template-model">Model</label>
            {modelCatalogError ? (
              <p className="agent-form__error" role="alert">
                {modelCatalogError}
              </p>
            ) : null}
            <select
              id="agent-template-model"
              name="model"
              value={draft.model}
              disabled={disabled || isModelCatalogLoading || models.length === 0}
              aria-invalid={Boolean(errors.model) || Boolean(modelCatalogError)}
              onChange={(event) => onDraftChange("model", event.target.value)}
            >
              {isModelCatalogLoading ? (
                <option value={draft.model}>Loading models...</option>
              ) : null}
              {!isModelCatalogLoading && models.length === 0 ? (
                <option value={draft.model}>No models available</option>
              ) : null}
              {models.map((model) => (
                <option key={model.modelId} value={model.modelId}>
                  {model.displayName}
                </option>
              ))}
            </select>
            <p className="agent-form__hint">
              Model options come from the existing Agent Management catalog API.
            </p>
            {errors.model ? (
              <span className="agent-form__error" role="alert">
                {errors.model}
              </span>
            ) : null}
          </div>
        </div>

        <div className="agent-guided__section">
          <div className="agent-guided__section-header">
            <h3>Behavior</h3>
            <p>Define how this agent should act before it becomes selectable.</p>
          </div>
          <DraftField
            field="responsibilities"
            label="Responsibilities"
            value={draft.responsibilities}
            multiline
            rows={4}
            disabled={disabled}
            placeholder="Track competitor launches&#10;Summarize market signals"
            hint="One responsibility per line keeps the generated skill.md readable."
            onDraftChange={onDraftChange}
          />
          <DraftField
            field="operatingContext"
            label="Operating context"
            value={draft.operatingContext}
            multiline
            rows={4}
            disabled={disabled}
            placeholder="Works from public sources and uploaded workspace notes."
            hint="Add workspace context the agent should consider during setup."
            onDraftChange={onDraftChange}
          />
          <DraftField
            field="instructions"
            label="Instructions"
            value={draft.instructions}
            error={errors.instructions}
            required
            multiline
            rows={5}
            disabled={disabled}
            placeholder="Write concise findings, cite assumptions, and ask for missing context."
            hint="Required. This becomes the core behavior instruction."
            onDraftChange={onDraftChange}
          />
        </div>

        <div className="agent-guided__section">
          <div className="agent-guided__section-header">
            <h3>Resources and guardrails</h3>
            <p>Record setup intent without granting tools or knowledge access.</p>
          </div>
          <DraftField
            field="requestedTools"
            label="Requested tools"
            value={draft.requestedTools}
            error={errors.requestedTools}
            multiline
            rows={4}
            disabled={disabled}
            placeholder="browser-search: Research public updates"
            hint="Optional setup request only; it does not create tool assignments."
            onDraftChange={onDraftChange}
          />
          <DraftField
            field="requestedKnowledge"
            label="Requested knowledge"
            value={draft.requestedKnowledge}
            error={errors.requestedKnowledge}
            multiline
            rows={4}
            disabled={disabled}
            placeholder="Product FAQ: Answer support questions"
            hint="Optional setup request only; it does not grant knowledge access."
            onDraftChange={onDraftChange}
          />
          <DraftField
            field="constraints"
            label="Constraints"
            value={draft.constraints}
            multiline
            rows={4}
            disabled={disabled}
            placeholder="Do not invent pricing. Ask for review when confidence is low."
            onDraftChange={onDraftChange}
          />
        </div>

        <div className="agent-guided__section">
          <div className="agent-guided__section-header">
            <h3>Review details</h3>
            <p>Optional examples help teammates understand the intended setup.</p>
          </div>
          <DraftField
            field="escalationRules"
            label="Escalation rules"
            value={draft.escalationRules}
            multiline
            rows={3}
            disabled={disabled}
            placeholder="Escalate unclear compliance questions to a manager."
            onDraftChange={onDraftChange}
          />
          <DraftField
            field="exampleTasks"
            label="Example tasks"
            value={draft.exampleTasks}
            multiline
            rows={3}
            disabled={disabled}
            placeholder="Summarize this week's customer support themes."
            onDraftChange={onDraftChange}
          />
        </div>
      </div>

      <aside className="agent-guided__preview" aria-label="skill.md preview">
        <div className="agent-guided__preview-header">
          <div>
            <h3>skill.md preview</h3>
            <p>Generated from the draft before any Agent is created.</p>
          </div>
          {isSkillPreviewLoading ? <span role="status">Rendering...</span> : null}
        </div>
        {skillPreviewError ? (
          <p className="agent-form__error" role="alert">
            {skillPreviewError}
          </p>
        ) : null}
        {skillPreviewMarkdown ? (
          <pre>{skillPreviewMarkdown}</pre>
        ) : (
          <div className="agent-guided__preview-empty">
            <FileText size={22} aria-hidden="true" />
            <h4>Preview is waiting for required fields</h4>
            <p>Complete the draft to render the final Markdown.</p>
            {missingFields.length > 0 ? (
              <ul>
                {missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </aside>

      <div className="agent-guided__footer">
        <p>
          {isSubmitDisabled
            ? "Complete required fields and select an available model before creating."
            : "Template draft is ready to create."}
        </p>
        <button
          type="submit"
          className="agent-primary-button"
          disabled={isSubmitDisabled}
        >
          {disabled ? "Saving..." : "Create agent"}
        </button>
      </div>
    </form>
  );
}

type DraftFieldProps = {
  field: TemplateDraftField;
  label: string;
  value: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  onDraftChange: (field: TemplateDraftField, value: string) => void;
};

function DraftField({
  field,
  label,
  value,
  error,
  hint,
  placeholder,
  required = false,
  multiline = false,
  rows,
  disabled = false,
  onDraftChange,
}: DraftFieldProps) {
  const fieldId = `agent-template-${field}`;
  const errorId = `${fieldId}-error`;
  const describedBy = [
    hint ? `${fieldId}-hint` : "",
    error ? errorId : "",
  ].filter(Boolean).join(" ") || undefined;
  const commonProps = {
    id: fieldId,
    name: field,
    value,
    disabled,
    required,
    placeholder,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onDraftChange(field, event.target.value),
  };

  return (
    <div className="agent-form__field">
      <label htmlFor={fieldId}>{label}</label>
      {hint ? (
        <p id={`${fieldId}-hint`} className="agent-form__hint">
          {hint}
        </p>
      ) : null}
      {multiline ? (
        <textarea {...commonProps} rows={rows} />
      ) : (
        <input {...commonProps} />
      )}
      {error ? (
        <span id={errorId} className="agent-form__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

type AgentTableProps = {
  rows: readonly AgentRowViewModel[];
  disabled: boolean;
  canManageAgents: boolean;
  onOpenInfo: (row: AgentRowViewModel) => void;
  onEdit: (row: AgentRowViewModel) => void;
  onRename: (row: AgentRowViewModel) => void;
  onDuplicate: (row: AgentRowViewModel) => void;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function AgentTable({
  rows,
  disabled,
  canManageAgents,
  onOpenInfo,
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
              onOpenInfo={onOpenInfo}
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
  onOpenInfo: (row: AgentRowViewModel) => void;
  onEdit: (row: AgentRowViewModel) => void;
  onRename: (row: AgentRowViewModel) => void;
  onDuplicate: (row: AgentRowViewModel) => void;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function AgentRow({
  row,
  disabled,
  canManageAgents,
  onOpenInfo,
  onEdit,
  onRename,
  onDuplicate,
  onLifecycleAction,
}: AgentRowProps) {
  const selectableLabel = row.canBeSelectedForNewWork
    ? "Selectable in this workspace"
    : "Not selectable in this workspace";

  return (
    <tr
      className={`agent-row agent-row--${row.statusTone}`}
      aria-current={row.isSelected ? "true" : undefined}
      tabIndex={disabled ? -1 : 0}
      aria-label={`View details for ${row.name}`}
      onClick={() => {
        if (!disabled) {
          onOpenInfo(row);
        }
      }}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenInfo(row);
        }
      }}
    >
      <td data-label="Agent">
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
      <td data-label="Role">{row.role}</td>
      <td data-label="Model">{row.model}</td>
      <td data-label="Status">
        <span
          className={`agent-row__status agent-row__status--${row.statusTone}`}
        >
          {row.statusLabel}
        </span>
      </td>
      <td data-label="Updated">{formatDate(row.updatedAt)}</td>
      <td data-label="Availability">{selectableLabel}</td>
      {canManageAgents ? (
        <td data-label="Actions">
          <div
            className="agent-row__actions"
            aria-label={`Actions for ${row.name}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
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

type AgentInfoDialogProps = {
  row: AgentRowViewModel;
  configuration: AgentEditableConfiguration | null;
  configurationError: string | null;
  isConfigurationLoading: boolean;
  canManageAgents: boolean;
  disabled: boolean;
  onClose: () => void;
  onRetry: () => void;
  onConfigure: (row: AgentRowViewModel) => void;
  onRename: (row: AgentRowViewModel) => void;
  onDuplicate: (row: AgentRowViewModel) => void;
  onLifecycleAction: (row: AgentRowViewModel, action: AgentRowAction) => void;
};

function AgentInfoDialog({
  row,
  configuration,
  configurationError,
  isConfigurationLoading,
  canManageAgents,
  disabled,
  onClose,
  onRetry,
  onConfigure,
  onRename,
  onDuplicate,
  onLifecycleAction,
}: AgentInfoDialogProps) {
  const titleId = "agent-info-title";
  const availableAction = row.actions.find((action) => action.kind !== "delete");
  const deleteAction = row.actions.find((action) => action.kind === "delete");

  return (
    <div className="agent-modal-backdrop" role="presentation">
      <article
        className="agent-modal agent-info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby="agent-info-summary"
      >
        <button
          type="button"
          className="agent-modal__close"
          aria-label="Close agent information"
          onClick={onClose}
          disabled={disabled}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <header className="agent-info-dialog__header">
          <span className="agent-info-dialog__avatar" aria-hidden="true">
            <Bot size={24} />
          </span>
          <div>
            <span className="agent-info-dialog__eyebrow">Agent profile</span>
            <h2 id={titleId}>{row.name}</h2>
            <p id="agent-info-summary">
              Review setup details before choosing a configuration action.
            </p>
          </div>
          <span
            className={`agent-row__status agent-row__status--${row.statusTone}`}
          >
            {row.statusLabel}
          </span>
        </header>

        <dl className="agent-info-dialog__summary">
          <div>
            <dt>Role</dt>
            <dd>{row.role}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{row.model}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>
              {row.canBeSelectedForNewWork
                ? "Selectable in this workspace"
                : "Not selectable in this workspace"}
            </dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDate(row.updatedAt)}</dd>
          </div>
        </dl>

        <section className="agent-info-dialog__configuration" aria-live="polite">
          <div className="agent-info-dialog__section-title">
            <h3>Configuration</h3>
            {isConfigurationLoading ? <span role="status">Loading...</span> : null}
          </div>

          {configurationError ? (
            <div className="agent-info-dialog__error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <p>{configurationError}</p>
                <button
                  type="button"
                  className="agent-secondary-button"
                  onClick={onRetry}
                  disabled={disabled || isConfigurationLoading}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          {!configurationError && configuration ? (
            <div className="agent-info-dialog__instructions">
              <p>{configuration.instructions}</p>
            </div>
          ) : null}

          {!configurationError && !configuration && !isConfigurationLoading ? (
            <p className="agent-info-dialog__muted">
              Configuration details are not loaded yet.
            </p>
          ) : null}
        </section>

        {canManageAgents ? (
          <footer className="agent-info-dialog__actions">
            <button
              type="button"
              className="agent-primary-button"
              onClick={() => onConfigure(row)}
              disabled={disabled || isConfigurationLoading}
            >
              <Pencil size={17} aria-hidden="true" />
              Configure
            </button>
            <button
              type="button"
              className="agent-secondary-button"
              onClick={() => onRename(row)}
              disabled={disabled}
            >
              <SquarePen size={17} aria-hidden="true" />
              Rename
            </button>
            <button
              type="button"
              className="agent-secondary-button"
              onClick={() => onDuplicate(row)}
              disabled={disabled}
            >
              <Copy size={17} aria-hidden="true" />
              Duplicate
            </button>
            {availableAction ? (
              <button
                type="button"
                className="agent-secondary-button"
                onClick={() => onLifecycleAction(row, availableAction)}
                disabled={disabled}
              >
                {availableAction.label}
              </button>
            ) : null}
            {deleteAction ? (
              <button
                type="button"
                className="agent-secondary-button agent-secondary-button--danger"
                onClick={() => onLifecycleAction(row, deleteAction)}
                disabled={disabled}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            ) : null}
          </footer>
        ) : (
          <footer className="agent-info-dialog__viewer" role="status">
            <ShieldCheck size={17} aria-hidden="true" />
            Viewer mode can inspect this agent without changing configuration.
          </footer>
        )}
      </article>
    </div>
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
      <h3>Build your first AI agent</h3>
      <p>
        Agents hold role, model, and instruction settings for this workspace.
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
        hint="Which LLM should power this agent? (e.g. gemini-2.5-flash, openrouter/owl-alpha)"
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

function createTemplateDraft(): TemplateDraftState {
  return { ...templateDraftValues };
}

function validateTemplateDraft(draft: TemplateDraftState): TemplateDraftErrors {
  const errors: TemplateDraftErrors = {};

  if (!draft.name.trim()) {
    errors.name = "name is required";
  }

  if (!draft.role.trim()) {
    errors.role = "role is required";
  }

  if (!draft.model.trim()) {
    errors.model = "model is required";
  }

  if (!draft.instructions.trim()) {
    errors.instructions = "instructions are required";
  }

  return errors;
}

function missingTemplateDraftFields(draft: TemplateDraftState): string[] {
  const missing: string[] = [];

  if (!draft.name.trim()) {
    missing.push("Agent name");
  }

  if (!draft.role.trim()) {
    missing.push("Role");
  }

  if (!draft.model.trim()) {
    missing.push("Model");
  }

  if (!draft.instructions.trim()) {
    missing.push("Instructions");
  }

  return missing;
}

function templateDraftErrorsFor(error: unknown): TemplateDraftErrors {
  const apiError = readAgentApiError(error);
  if (apiError?.code === "validation.invalid_input") {
    const issues = Array.isArray(apiError.details?.issues)
      ? apiError.details.issues
      : [];
    const errors: TemplateDraftErrors = {};

    for (const warning of blockingWarningsFor(apiError)) {
      if (warning.field === "requestedTools" || warning.field === "requestedKnowledge") {
        errors[warning.field] = warning.message;
      }
    }

    for (const issue of issues) {
      if (typeof issue !== "string") {
        continue;
      }

      const field = ([
        "name",
        "role",
        "model",
        "instructions",
        "requestedTools",
        "requestedKnowledge",
      ] as const).find(
        (candidate) => issue.startsWith(candidate),
      );
      if (field) {
        errors[field] = issue;
      }
    }

    return Object.keys(errors).length > 0 ? errors : { form: apiError.message };
  }

  return { form: messageFor(error, "Unable to create the agent.") };
}

function hasBlockingDraftErrors(errors: TemplateDraftErrors): boolean {
  return Boolean(errors.form || errors.requestedTools || errors.requestedKnowledge);
}

function blockingWarningsFor(error: { details?: Record<string, unknown> }): Array<{
  field?: string;
  message: string;
  severity?: string;
}> {
  const warnings = Array.isArray(error.details?.warnings)
    ? error.details.warnings
    : [];

  return warnings.filter((warning): warning is {
    field?: string;
    message: string;
    severity?: string;
  } => {
    return (
      typeof warning === "object" &&
      warning !== null &&
      typeof (warning as { message?: unknown }).message === "string" &&
      (warning as { severity?: unknown }).severity === "blocking"
    );
  });
}

function readAgentApiError(error: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const details = (error as { details?: unknown }).details;
    return {
      code: (error as { code: string }).code,
      message: (error as { message: string }).message,
      details: details && typeof details === "object" && !Array.isArray(details)
        ? details as Record<string, unknown>
        : undefined,
    };
  }

  return null;
}

function templateDraftToSkillPreviewInput(
  draft: TemplateDraftState,
): AgentSkillPreviewRequest {
  return {
    name: draft.name.trim(),
    role: draft.role.trim(),
    model: draft.model,
    instructions: draft.instructions.trim(),
    responsibilities: splitDraftLines(draft.responsibilities),
    operatingContext: draft.operatingContext.trim() || undefined,
    requestedTools: parseToolReferences(draft.requestedTools),
    requestedKnowledge: parseKnowledgeReferences(draft.requestedKnowledge),
    constraints: splitDraftLines(draft.constraints),
    escalationRules: splitDraftLines(draft.escalationRules),
    exampleTasks: splitDraftLines(draft.exampleTasks),
  };
}

function buildCreateInstructionsFromDraft(draft: TemplateDraftState): string {
  const optionalSections = [
    draft.responsibilities,
    draft.operatingContext,
    draft.requestedTools,
    draft.requestedKnowledge,
    draft.constraints,
    draft.escalationRules,
    draft.exampleTasks,
  ];

  if (optionalSections.every((value) => splitDraftLines(value).length === 0)) {
    return draft.instructions.trim();
  }

  const sections = [
    formatDraftSection("Responsibilities", draft.responsibilities),
    draft.operatingContext.trim()
      ? `Operating Context:\n${draft.operatingContext.trim()}`
      : "",
    draft.instructions.trim()
      ? `Instructions:\n${draft.instructions.trim()}`
      : "",
    formatDraftSection("Requested Tools", draft.requestedTools),
    formatDraftSection("Requested Knowledge", draft.requestedKnowledge),
    formatDraftSection("Constraints", draft.constraints),
    formatDraftSection("Escalation Rules", draft.escalationRules),
    formatDraftSection("Example Tasks", draft.exampleTasks),
  ].filter(Boolean);

  return sections.join("\n\n");
}

function formatDraftSection(title: string, value: string): string {
  const lines = splitDraftLines(value);
  if (lines.length === 0) {
    return "";
  }

  return [`${title}:`, ...lines.map((line) => `- ${line}`)].join("\n");
}

function splitDraftLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function parseToolReferences(value: string) {
  const references = splitDraftLines(value).map((line) => {
    const [name, ...reasonParts] = line.split(":");
    return {
      name: name.trim(),
      reason: reasonParts.join(":").trim() || undefined,
    };
  }).filter((reference) => reference.name);

  return references.length > 0 ? references : undefined;
}

function parseKnowledgeReferences(value: string) {
  const references = splitDraftLines(value).map((line) => {
    const [title, ...reasonParts] = line.split(":");
    return {
      title: title.trim(),
      reason: reasonParts.join(":").trim() || undefined,
    };
  }).filter((reference) => reference.title);

  return references.length > 0 ? references : undefined;
}

function formatToolReferences(
  references: AgentCreationAssistantDraft["requestedTools"],
): string {
  return (references ?? [])
    .map((tool) => (tool.reason ? `${tool.name}: ${tool.reason}` : tool.name))
    .join("\n");
}

function formatKnowledgeReferences(
  references: AgentCreationAssistantDraft["requestedKnowledge"],
): string {
  return (references ?? [])
    .map((item) => (item.reason ? `${item.title}: ${item.reason}` : item.title))
    .join("\n");
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
