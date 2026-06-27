import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgentApiClientError,
  type AgentListItem,
  type AgentManagementApiClient,
} from "@vcp/frontend/features/agent-management/agent-management-api-client.ts";
import { AgentManagementPage } from "@vcp/frontend/features/agent-management/agent-management-page.tsx";
import { ToastProvider } from "@vcp/frontend/components/shared/Toast.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;

const enabledAgent: AgentListItem = {
  agentId: "agent-enabled" as EntityId<"agentId">,
  workspaceId,
  name: "Research Agent",
  role: "Researcher",
  model: "gemini-2.5-flash",
  status: "enabled",
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
};

const disabledAgent: AgentListItem = {
  ...enabledAgent,
  agentId: "agent-disabled" as EntityId<"agentId">,
  name: "Support Agent",
  role: "Support",
  status: "disabled",
};

const defaultPagination = {
  totalItems: 2,
  pageSize: 20,
  totalPages: 1,
  currentPage: 1,
};

const modelCatalog = [
  {
    providerId: "gemini",
    modelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    capabilities: ["text-generation", "structured-output"],
    tier: "demo" as const,
    enabled: true,
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/owl-alpha",
    displayName: "OpenRouter Owl Alpha",
    capabilities: ["text-generation"],
    tier: "free" as const,
    enabled: true,
  },
];

function createClient(overrides: Partial<AgentManagementApiClient> = {}) {
  return {
    listAgents: vi.fn(async () => ({
      items: [enabledAgent, disabledAgent],
      pagination: defaultPagination,
    })),
    listAgentModels: vi.fn(async () => modelCatalog),
    previewSkillMarkdown: vi.fn(async (workspace, payload) => ({
      markdown: [
        `# ${payload.name}`,
        "",
        "## Role",
        "",
        payload.role,
        "",
        "## Instructions",
        "",
        payload.instructions,
      ].join("\n"),
      fileName: "skill.md" as const,
    })),
    createAssistantDraft: vi.fn(async () => ({
      draft: {
        name: "Assistant Support Agent",
        role: "Support specialist",
        model: "gemini-2.5-flash",
        instructions: "Answer support questions.",
        responsibilities: ["Triage support issues"],
        operatingContext: "Use the support handbook.",
        requestedTools: [{ name: "Slack", reason: "Notify support team" }],
        requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
        constraints: [],
        escalationRules: [],
        exampleTasks: ["Draft a support reply"],
        warnings: [],
        clarifyingQuestions: [],
      },
      warnings: [],
      clarifyingQuestions: [],
      provider: { providerId: "mock", modelId: "mock-model", fallbackUsed: false },
    })),
    analyzeSkillImport: vi.fn(async () => ({
      draft: {
        name: "Imported Support Agent",
        role: "Support specialist",
        model: "gemini-2.5-flash",
        instructions: "Answer support questions.",
        responsibilities: ["Triage support issues"],
        operatingContext: "Use the support handbook.",
        requestedTools: [{ name: "Slack", reason: "Notify support team" }],
        requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
        constraints: [],
        escalationRules: [],
        exampleTasks: []
      },
      warnings: [],
      clarifyingQuestions: [],
      provider: { providerId: "mock", modelId: "mock-model", fallbackUsed: false }
    })),
    createAgent: vi.fn(async () => enabledAgent),
    getAgentConfiguration: vi.fn(async () => ({
      ...enabledAgent,
      instructions: "Prepare market research.",
    })),
    updateAgent: vi.fn(async () => enabledAgent),
    enableAgent: vi.fn(async () => enabledAgent),
    disableAgent: vi.fn(async () => disabledAgent),
    deleteAgent: vi.fn(async () => ({
      ...enabledAgent,
      status: "deleted" as const,
    })),
    renameAgent: vi.fn(async () => enabledAgent),
    duplicateAgent: vi.fn(async () => enabledAgent),
    ...overrides,
  } as unknown as AgentManagementApiClient;
}

function renderPage(client = createClient()) {
  render(
    <ToastProvider>
      <AgentManagementPage workspaceId={workspaceId} apiClient={client} />
    </ToastProvider>,
  );
  return client;
}

async function openCreateModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "New Agent" }));
  return screen.getByRole("dialog", { name: "Create agent" });
}

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Planning Agent");
  await user.type(screen.getByLabelText("Role"), "Planner");
  await user.type(
    screen.getByLabelText("Instructions"),
    "Create execution plans.",
  );
}

function agentRow(name: string): HTMLElement {
  return screen.getByRole("row", { name: new RegExp(name) });
}

describe("AgentManagementPage API integration", () => {
  it("shows loading and then renders enabled and disabled agents", async () => {
    let resolveList!: (res: {
      items: AgentListItem[];
      pagination: any;
    }) => void;
    const listPromise = new Promise<{
      items: AgentListItem[];
      pagination: any;
    }>((resolve) => {
      resolveList = resolve;
    });
    const client = createClient({ listAgents: vi.fn(() => listPromise) });

    renderPage(client);
    expect(screen.getByRole("status").textContent).toContain("Loading agents");

    resolveList({
      items: [enabledAgent, disabledAgent],
      pagination: defaultPagination,
    });
    expect(await screen.findByText("Research Agent")).toBeTruthy();
    expect(screen.getByText("Support Agent")).toBeTruthy();
  });

  it("renders the API empty state without mock agents", async () => {
    const user = userEvent.setup();
    renderPage(
      createClient({
        listAgents: vi.fn(async () => ({
          items: [],
          pagination: defaultPagination,
        })),
      }),
    );

    expect(await screen.findByText("No active agents yet.")).toBeTruthy();
    expect(screen.queryByText("Research Agent")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Create first agent" }),
    );
    expect(screen.getByRole("dialog", { name: "Create agent" })).toBeTruthy();
  });

  it("shows guided create entry points without creating an agent", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    expect(screen.getByRole("tab", { name: "Template" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Prompt Assistant" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Import skill.md" })).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Prompt Assistant" }));
    expect(screen.getByRole("button", { name: "Generate draft" })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: "Import skill.md" }));
    expect(screen.getByRole("button", { name: "Analyze skill.md" })).not.toBeDisabled();
    expect(screen.getByLabelText("Markdown content")).toBeTruthy();
    expect(client.createAgent).not.toHaveBeenCalled();
  });

  it("renders skill.md preview from the current template draft", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    await fillCreateForm(user);

    await waitFor(() => expect(client.previewSkillMarkdown).toHaveBeenCalled());
    expect(
      screen.getByText((_, element) => {
        return (
          element?.tagName.toLowerCase() === "pre" &&
          element.textContent?.includes("# Planning Agent") === true &&
          element.textContent.includes("Create execution plans.")
        );
      }),
    ).toBeTruthy();
    expect(client.previewSkillMarkdown).toHaveBeenLastCalledWith(
      workspaceId,
      expect.objectContaining({
        name: "Planning Agent",
        role: "Planner",
        model: "gemini-2.5-flash",
        instructions: "Create execution plans.",
      }),
    );
  });

  it("shows an initial error and retries the list request", async () => {
    const listAgents = vi
      .fn()
      .mockRejectedValueOnce(
        new AgentApiClientError({
          message: "API unavailable",
          kind: "network",
        }),
      )
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      });
    const user = userEvent.setup();
    renderPage(createClient({ listAgents }));

    expect(await screen.findByText("API unavailable")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Research Agent")).toBeTruthy();
    expect(listAgents).toHaveBeenCalledTimes(2);
  });

  it("creates an agent, refreshes the list, and resets the form", async () => {
    const createdAgent = {
      ...enabledAgent,
      agentId: "agent-created" as EntityId<"agentId">,
      name: "Planning Agent",
      role: "Planner",
    };
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({
        items: [enabledAgent, createdAgent],
        pagination: defaultPagination,
      });
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    await fillCreateForm(user);
    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(await screen.findByText("Planning Agent")).toBeTruthy();
    expect(client.createAgent).toHaveBeenCalledWith(workspaceId, {
      name: "Planning Agent",
      role: "Planner",
      model: "gemini-2.5-flash",
      instructions: "Create execution plans.",
      responsibilities: [],
      operatingContext: undefined,
      requestedTools: undefined,
      requestedKnowledge: undefined,
      constraints: [],
      escalationRules: [],
      exampleTasks: [],
    });
    expect(screen.queryByRole("dialog", { name: "Create agent" })).toBeNull();
  });

  it("completes the guided assistant happy path from draft to enabled list row", async () => {
    const createdAgent = {
      ...enabledAgent,
      agentId: "agent-assistant-created" as EntityId<"agentId">,
      name: "Assistant Support Agent",
      role: "Support specialist",
    };
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({
        items: [enabledAgent, createdAgent],
        pagination: { ...defaultPagination, totalItems: 2 },
      });
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    await user.click(screen.getByRole("tab", { name: "Prompt Assistant" }));
    await user.type(
      screen.getByPlaceholderText("I need an agent that..."),
      "Create a support agent that uses Slack and the support handbook.",
    );
    await user.click(screen.getByRole("button", { name: "Generate draft" }));

    expect(await screen.findByText("Draft Ready")).toBeTruthy();
    expect(screen.getByText("Assistant Support Agent")).toBeTruthy();
    expect(client.createAssistantDraft).toHaveBeenCalledWith(workspaceId, {
      prompt: "Create a support agent that uses Slack and the support handbook.",
    });

    await user.click(screen.getByRole("button", { name: "Edit in Template" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Assistant Support Agent");
    await waitFor(() => expect(client.previewSkillMarkdown).toHaveBeenCalled());
    expect(
      screen.getByText((_, element) =>
        element?.tagName.toLowerCase() === "pre" &&
        element.textContent?.includes("# Assistant Support Agent") === true
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(await screen.findByText("Assistant Support Agent")).toBeTruthy();
    expect(client.createAgent).toHaveBeenCalledWith(workspaceId, {
      name: "Assistant Support Agent",
      role: "Support specialist",
      model: "gemini-2.5-flash",
      instructions: [
        "Responsibilities:",
        "- Triage support issues",
        "",
        "Operating Context:",
        "Use the support handbook.",
        "",
        "Instructions:",
        "Answer support questions.",
        "",
        "Requested Tools:",
        "- Slack: Notify support team",
        "",
        "Requested Knowledge:",
        "- Support Handbook: Ground answers",
        "",
        "Example Tasks:",
        "- Draft a support reply",
      ].join("\n"),
      responsibilities: ["Triage support issues"],
      operatingContext: "Use the support handbook.",
      requestedTools: [{ name: "Slack", reason: "Notify support team" }],
      requestedKnowledge: [{ title: "Support Handbook", reason: "Ground answers" }],
      constraints: [],
      escalationRules: [],
      exampleTasks: ["Draft a support reply"],
    });
    expect(screen.queryByRole("dialog", { name: "Create agent" })).toBeNull();
  });

  it("shows blocking capability warnings and allows submit after resolution", async () => {
    const createAgent = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Invalid agent configuration: requestedTools"), {
          code: "validation.invalid_input",
          kind: "api",
          status: 400,
          details: {
            issues: [
              'requestedTools: Requested tool "PagerDuty" is not connected in this workspace.',
            ],
            warnings: [
              {
                code: "tool.missing",
                message: 'Requested tool "PagerDuty" is not connected in this workspace.',
                severity: "blocking",
                field: "requestedTools",
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(enabledAgent);
    const client = createClient({ createAgent });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    await fillCreateForm(user);
    await user.type(screen.getByLabelText("Requested tools"), "PagerDuty");
    await user.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(
        screen.getAllByRole("alert").some((alert) =>
          alert.textContent?.includes('Requested tool "PagerDuty"'),
        ),
      ).toBe(true);
    });
    expect(screen.getByRole("button", { name: "Create agent" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Requested tools"));
    await user.type(screen.getByLabelText("Requested tools"), "Slack: Notify owners");
    expect(screen.getByRole("button", { name: "Create agent" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(createAgent).toHaveBeenLastCalledWith(workspaceId, {
      name: "Planning Agent",
      role: "Planner",
      model: "gemini-2.5-flash",
      instructions: [
        "Instructions:",
        "Create execution plans.",
        "",
        "Requested Tools:",
        "- Slack: Notify owners",
      ].join("\n"),
      responsibilities: [],
      operatingContext: undefined,
      requestedTools: [{ name: "Slack", reason: "Notify owners" }],
      requestedKnowledge: undefined,
      constraints: [],
      escalationRules: [],
      exampleTasks: [],
    });
  });

  it("keeps an assistant draft uncreated when capability warnings are blocking", async () => {
    const createAgent = vi.fn().mockRejectedValue(
      Object.assign(new Error("Invalid agent configuration: requestedTools"), {
        code: "validation.invalid_input",
        kind: "api",
        status: 400,
        details: {
          issues: [
            'requestedTools: Requested tool "PagerDuty" is not connected in this workspace.',
          ],
          warnings: [
            {
              code: "tool.missing",
              message: 'Requested tool "PagerDuty" is not connected in this workspace.',
              severity: "blocking",
              field: "requestedTools",
            },
          ],
        },
      }),
    );
    const client = createClient({
      createAssistantDraft: vi.fn(async () => ({
        draft: {
          name: "Incident Agent",
          role: "Incident responder",
          model: "gemini-2.5-flash",
          instructions: "Coordinate incidents.",
          responsibilities: ["Triage incidents"],
          requestedTools: [{ name: "PagerDuty", reason: "Page responders" }],
          requestedKnowledge: [],
          constraints: [],
          escalationRules: [],
          exampleTasks: [],
          warnings: [],
          clarifyingQuestions: [],
        },
        warnings: [
          {
            code: "tool.missing",
            message: 'Requested tool "PagerDuty" is not connected in this workspace.',
            severity: "blocking",
            field: "requestedTools",
          },
        ],
        clarifyingQuestions: [],
        provider: { providerId: "mock", modelId: "mock-model", fallbackUsed: false },
      })),
      createAgent,
    });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    await user.click(screen.getByRole("tab", { name: "Prompt Assistant" }));
    await user.type(
      screen.getByPlaceholderText("I need an agent that..."),
      "Create an incident response agent that uses PagerDuty.",
    );
    await user.click(screen.getByRole("button", { name: "Generate draft" }));

    expect(
      await screen.findByText('Requested tool "PagerDuty" is not connected in this workspace.'),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Edit in Template" }));
    await waitFor(() => expect(client.previewSkillMarkdown).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Research Agent")).toBeTruthy();
    expect(screen.queryByText("Incident Agent", { selector: "td" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create agent" })).toBeDisabled();
    expect(screen.getByLabelText("Requested tools")).toHaveValue("PagerDuty: Page responders");
  });

  it("prevents template creation when required fields are missing", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");
    await openCreateModal(user);
    await user.type(screen.getByLabelText("Name"), "Planning Agent");
    await user.type(screen.getByLabelText("Instructions"), "Create plans.");

    expect(screen.getByRole("button", { name: "Create agent" })).toBeDisabled();
    expect(client.createAgent).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Planning Agent");
    expect(screen.getByLabelText("Instructions")).toHaveValue("Create plans.");
  });

  it("preserves form and list while preventing duplicate create requests", async () => {
    let rejectCreate!: (reason: unknown) => void;
    const createPromise = new Promise<never>((_, reject) => {
      rejectCreate = reject;
    });
    const client = createClient({ createAgent: vi.fn(() => createPromise) });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");
    await openCreateModal(user);
    await fillCreateForm(user);

    const submit = screen.getByRole("button", { name: "Create agent" });
    await user.click(submit);
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(client.createAgent).toHaveBeenCalledTimes(1);

    rejectCreate(
      new AgentApiClientError({ message: "Create failed", kind: "api" }),
    );
    expect(
      (await screen.findAllByText("Create failed")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Research Agent")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("Planning Agent");
  });

  it("closes the create modal without creating an agent", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await openCreateModal(user);
    await user.type(screen.getByLabelText("Name"), "Draft Agent");
    await user.click(screen.getByRole("button", { name: "Close agent form" }));

    expect(screen.queryByRole("dialog", { name: "Create agent" })).toBeNull();
    expect(client.createAgent).not.toHaveBeenCalled();
    expect(screen.getByText("Research Agent")).toBeTruthy();
  });

  it("loads editable configuration before enabling save", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: "Configure",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Configure agent" }),
    ).toBeTruthy();
    expect(
      await screen.findByDisplayValue("Prepare market research."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("shows unavailable configuration and does not enable stale edit submission", async () => {
    const client = createClient({
      getAgentConfiguration: vi.fn(async () => {
        throw new AgentApiClientError({
          code: "agent.not_available",
          message: "Agent is not available in this workspace.",
          kind: "api",
          status: 404,
        });
      }),
    });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: "Configure",
      }),
    );

    expect(
      await screen.findByText("Agent is not available in this workspace."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(client.updateAgent).not.toHaveBeenCalled();
  });

  it("updates an agent without sending its name and refreshes the row", async () => {
    const updatedAgent = { ...enabledAgent, role: "Analyst", model: "gemini-2.5-flash-lite" };
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({
        items: [updatedAgent],
        pagination: defaultPagination,
      });
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");
    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: "Configure",
      }),
    );
    await screen.findByDisplayValue("Prepare market research.");
    await user.clear(screen.getByLabelText("Role"));
    await user.type(screen.getByLabelText("Role"), "Analyst");
    await user.clear(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "gemini-2.5-flash-lite");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        within(agentRow("Research Agent")).getByText("Analyst"),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole("dialog", { name: "Configure agent" }),
    ).toBeNull();
    expect(client.updateAgent).toHaveBeenCalledWith(
      workspaceId,
      enabledAgent.agentId,
      {
        role: "Analyst",
        model: "gemini-2.5-flash-lite",
        instructions: "Prepare market research.",
      },
    );
  });

  it("preserves edited values and prevents duplicate update requests", async () => {
    let rejectUpdate!: (reason: unknown) => void;
    const updatePromise = new Promise<never>((_, reject) => {
      rejectUpdate = reject;
    });
    const client = createClient({ updateAgent: vi.fn(() => updatePromise) });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");
    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: "Configure",
      }),
    );
    await screen.findByDisplayValue("Prepare market research.");
    await user.clear(screen.getByLabelText("Role"));
    await user.type(screen.getByLabelText("Role"), "Analyst");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(client.updateAgent).toHaveBeenCalledTimes(1);

    rejectUpdate(
      new AgentApiClientError({ message: "Update failed", kind: "api" }),
    );
    expect(
      (await screen.findAllByText("Update failed")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Role")).toHaveValue("Analyst");
  });

  it("closes the configure modal without updating an agent", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: "Configure",
      }),
    );
    await screen.findByDisplayValue("Prepare market research.");
    await user.clear(screen.getByLabelText("Role"));
    await user.type(screen.getByLabelText("Role"), "Draft analyst");
    await user.click(screen.getByRole("button", { name: "Close agent form" }));

    expect(
      screen.queryByRole("dialog", { name: "Configure agent" }),
    ).toBeNull();
    expect(client.updateAgent).not.toHaveBeenCalled();
    expect(
      within(agentRow("Research Agent")).getByText("Researcher"),
    ).toBeTruthy();
  });

  it("disables and enables agents while refreshing available actions", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({
        items: [{ ...enabledAgent, status: "disabled" }],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      });
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Disable/,
      }),
    );
    expect(
      await within(agentRow("Research Agent")).findByRole("button", {
        name: /Enable/,
      }),
    ).toBeTruthy();
    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Enable/,
      }),
    );
    expect(
      await within(agentRow("Research Agent")).findByRole("button", {
        name: /Disable/,
      }),
    ).toBeTruthy();

    expect(client.disableAgent).toHaveBeenCalledTimes(1);
    expect(client.enableAgent).toHaveBeenCalledTimes(1);
  });

  it("requires deletion confirmation and removes the confirmed agent", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({ items: [], pagination: defaultPagination });
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Delete/,
      }),
    );
    expect(screen.getByRole("dialog", { name: "Delete agent" })).toBeTruthy();
    expect(client.deleteAgent).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete agent" })).toBeNull();
    expect(client.deleteAgent).not.toHaveBeenCalled();

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Delete/,
      }),
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Delete agent" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    expect(await screen.findByText("No active agents yet.")).toBeTruthy();
    expect(client.deleteAgent).toHaveBeenCalledTimes(1);
  });

  it("keeps the list and prevents duplicate lifecycle requests after failure", async () => {
    let rejectDisable!: (reason: unknown) => void;
    const disablePromise = new Promise<never>((_, reject) => {
      rejectDisable = reject;
    });
    const client = createClient({ disableAgent: vi.fn(() => disablePromise) });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Disable/,
      }),
    );
    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Disable/,
      }),
    );
    expect(client.disableAgent).toHaveBeenCalledTimes(1);

    rejectDisable(
      new AgentApiClientError({ message: "Lifecycle failed", kind: "network" }),
    );
    expect(await screen.findByText("Lifecycle failed")).toBeTruthy();
    expect(screen.getByText("Research Agent")).toBeTruthy();
    expect(client.disableAgent).toHaveBeenCalledTimes(1);
  });

  it("supports row menu actions for renaming and duplicating agents", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      })
      .mockResolvedValueOnce({
        items: [enabledAgent],
        pagination: defaultPagination,
      });
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    // Test Duplicate
    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Open actions/,
      }),
    );
    const duplicateButton = within(agentRow("Research Agent")).getByRole(
      "button",
      { name: /Duplicate Research Agent/ },
    );
    expect(duplicateButton).not.toBeDisabled();
    await user.click(duplicateButton);
    expect(client.duplicateAgent).toHaveBeenCalledWith(
      workspaceId,
      enabledAgent.agentId,
    );

    // Test Rename
    await user.click(
      within(agentRow("Research Agent")).getByRole("button", {
        name: /Open actions/,
      }),
    );
    const renameButton = within(agentRow("Research Agent")).getByRole(
      "button",
      { name: /Rename Research Agent/ },
    );
    expect(renameButton).not.toBeDisabled();
    await user.click(renameButton);

    // Rename Dialog should open
    const renameDialog = screen.getByRole("dialog", { name: "Rename agent" });
    expect(renameDialog).toBeTruthy();
    const nameInput = within(renameDialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(
      within(renameDialog).getByRole("button", { name: "Save" }),
    );

    expect(client.renameAgent).toHaveBeenCalledWith(
      workspaceId,
      enabledAgent.agentId,
      "New Name",
    );
  });

  it("handles prompt assistant submit, loading, fallback-provider, clarification, and success draft review", async () => {
    let mockDraftResolve: (value: any) => void = () => {};
    const mockDraftPromise = new Promise((resolve) => {
      mockDraftResolve = resolve;
    });
    
    const client = createClient({
      createAssistantDraft: vi.fn().mockReturnValue(mockDraftPromise)
    });

    renderPage(client);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Agent" })).toBeInTheDocument();
    });

    const newAgentButton = screen.getByRole("button", { name: "New Agent" });
    await userEvent.click(newAgentButton);

    const promptAssistantButton = screen.getByRole("tab", { name: "Prompt Assistant" });
    await userEvent.click(promptAssistantButton);

    const promptInput = screen.getByPlaceholderText("I need an agent that...");
    await userEvent.type(promptInput, "Help me write tests.");

    const generateButton = screen.getByRole("button", { name: "Generate draft" });
    await userEvent.click(generateButton);

    expect(screen.getByRole("button", { name: "Generating..." })).toBeDisabled();
    expect(promptInput).toBeDisabled();

    // Resolve with fallback provider and clarifying questions
    mockDraftResolve({
      draft: {
        name: "Test Assistant",
        role: "QA",
        model: "openrouter/owl-alpha",
        instructions: "Write tests.",
        responsibilities: [],
        operatingContext: "",
        constraints: [],
        escalationRules: [],
        exampleTasks: []
      },
      warnings: [],
      clarifyingQuestions: ["What framework?"],
      provider: { providerId: "openrouter", modelId: "openrouter/owl-alpha", fallbackUsed: true }
    });

    await waitFor(() => {
      expect(screen.getByText("Draft Ready")).toBeInTheDocument();
    });

    expect(screen.getByText("Note: Primary provider failed. Used fallback provider: openrouter/owl-alpha")).toBeInTheDocument();
    expect(screen.getByText("Test Assistant")).toBeInTheDocument();
    
    const editInTemplateButton = screen.getByRole("button", { name: "Edit in Template" });
    await userEvent.click(editInTemplateButton);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Test Assistant");
      expect(screen.getByRole("textbox", { name: "Instructions" })).toHaveValue("Write tests.");
    });
  });

  it("ensures all-provider failure preserves user input and asks the user to retry", async () => {
    const client = createClient({
      createAssistantDraft: vi.fn().mockRejectedValue(new Error("Assistant unavailable"))
    });

    renderPage(client);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Agent" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "New Agent" }));
    await userEvent.click(screen.getByRole("tab", { name: "Prompt Assistant" }));

    const promptInput = screen.getByPlaceholderText("I need an agent that...");
    await userEvent.type(promptInput, "Help me write tests.");

    await userEvent.click(screen.getByRole("button", { name: "Generate draft" }));

    await waitFor(() => {
      expect(screen.getByText("Assistant unavailable")).toBeInTheDocument();
    });

    expect(promptInput).toHaveValue("Help me write tests.");
    expect(screen.getByRole("button", { name: "Generate draft" })).not.toBeDisabled();
  });

  it("analyzes pasted skill markdown and moves the extracted draft into review", async () => {
    const client = createClient();
    renderPage(client);

    await screen.findByText("Research Agent");
    await userEvent.click(screen.getByRole("button", { name: "New Agent" }));
    await userEvent.click(screen.getByRole("tab", { name: "Import skill.md" }));

    const markdownInput = screen.getByLabelText("Markdown content");
    await userEvent.type(markdownInput, "# Support Agent\n\n## Role\nSupport");
    await userEvent.click(screen.getByRole("button", { name: "Analyze skill.md" }));

    await waitFor(() => {
      expect(client.analyzeSkillImport).toHaveBeenCalledWith(workspaceId, {
        markdown: "# Support Agent\n\n## Role\nSupport",
        fileName: undefined
      });
    });
    expect(await screen.findByText("Imported Draft Ready")).toBeInTheDocument();
    expect(screen.getByText((_, element) =>
      element?.textContent === "Requested tools: Slack"
    )).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit in Template" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Imported Support Agent");
    expect(screen.getByRole("textbox", { name: "Requested tools" })).toHaveValue("Slack: Notify support team");
    expect(screen.getByRole("textbox", { name: "Requested knowledge" })).toHaveValue("Support Handbook: Ground answers");
  });

  it("analyzes uploaded skill markdown files", async () => {
    const client = createClient();
    renderPage(client);

    await screen.findByText("Research Agent");
    await userEvent.click(screen.getByRole("button", { name: "New Agent" }));
    await userEvent.click(screen.getByRole("tab", { name: "Import skill.md" }));

    const file = new File(["# File Agent\n\n## Role\nSupport"], "support.skill.md", {
      type: "text/markdown"
    });
    const fileInput = screen.getByLabelText("Markdown file");
    await userEvent.upload(fileInput, file);
    await waitFor(() => {
      expect(screen.getByLabelText("Markdown content")).toHaveValue("# File Agent\n\n## Role\nSupport");
    });
    await userEvent.click(screen.getByRole("button", { name: "Analyze skill.md" }));

    await waitFor(() => {
      expect(client.analyzeSkillImport).toHaveBeenCalledWith(workspaceId, {
        markdown: "# File Agent\n\n## Role\nSupport",
        fileName: "support.skill.md"
      });
    });
  });

  it("keeps skill markdown available after invalid import and provider failure", async () => {
    const client = createClient({
      analyzeSkillImport: vi.fn().mockRejectedValue(new Error("Import analysis unavailable"))
    });
    renderPage(client);

    await screen.findByText("Research Agent");
    await userEvent.click(screen.getByRole("button", { name: "New Agent" }));
    await userEvent.click(screen.getByRole("tab", { name: "Import skill.md" }));

    await userEvent.click(screen.getByRole("button", { name: "Analyze skill.md" }));
    expect(screen.getByText("Markdown content is required.")).toBeInTheDocument();

    const markdownInput = screen.getByLabelText("Markdown content");
    await userEvent.type(markdownInput, "# Support Agent");
    await userEvent.click(screen.getByRole("button", { name: "Analyze skill.md" }));

    await waitFor(() => {
      expect(screen.getByText("Unable to analyze skill.md. Please try again.")).toBeInTheDocument();
    });
    expect(markdownInput).toHaveValue("# Support Agent");
    expect(screen.getByRole("button", { name: "Retry analysis" })).not.toBeDisabled();
  });

  it("renders viewer mode without mutation controls or mutation API calls", async () => {
    const client = createClient();

    render(
      <ToastProvider>
        <AgentManagementPage
          workspaceId={workspaceId}
          apiClient={client}
          accessMode="viewer"
        />
      </ToastProvider>,
    );
    expect(await screen.findByText("Research Agent")).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(screen.getByLabelText("Viewer permissions")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New Agent/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Create agent/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Configure/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Disable Research Agent/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Delete Research Agent/ }),
    ).toBeNull();

    expect(client.createAgent).not.toHaveBeenCalled();
    expect(client.getAgentConfiguration).not.toHaveBeenCalled();
    expect(client.updateAgent).not.toHaveBeenCalled();
    expect(client.enableAgent).not.toHaveBeenCalled();
    expect(client.disableAgent).not.toHaveBeenCalled();
    expect(client.deleteAgent).not.toHaveBeenCalled();
  });
});
