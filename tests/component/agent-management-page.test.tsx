import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AgentApiClientError,
  type AgentListItem,
  type AgentManagementApiClient
} from "@vcp/frontend/features/agent-management/agent-management-api-client.ts";
import { AgentManagementPage } from "@vcp/frontend/features/agent-management/agent-management-page.tsx";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

afterEach(cleanup);

const workspaceId = "workspace-a" as EntityId<"workspaceId">;

const enabledAgent: AgentListItem = {
  agentId: "agent-enabled" as EntityId<"agentId">,
  workspaceId,
  name: "Research Agent",
  role: "Researcher",
  model: "gpt-4.1-mini",
  status: "enabled",
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
};

const disabledAgent: AgentListItem = {
  ...enabledAgent,
  agentId: "agent-disabled" as EntityId<"agentId">,
  name: "Support Agent",
  role: "Support",
  status: "disabled"
};

function createClient(overrides: Partial<AgentManagementApiClient> = {}) {
  return {
    listAgents: vi.fn(async () => [enabledAgent, disabledAgent]),
    createAgent: vi.fn(async () => enabledAgent),
    getAgentConfiguration: vi.fn(async () => ({
      ...enabledAgent,
      instructions: "Prepare market research."
    })),
    updateAgent: vi.fn(async () => enabledAgent),
    enableAgent: vi.fn(async () => enabledAgent),
    disableAgent: vi.fn(async () => disabledAgent),
    deleteAgent: vi.fn(async () => ({ ...enabledAgent, status: "deleted" as const })),
    ...overrides
  };
}

function renderPage(client = createClient()) {
  render(<AgentManagementPage workspaceId={workspaceId} apiClient={client} />);
  return client;
}

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Planning Agent");
  await user.type(screen.getByLabelText("Role"), "Planner");
  await user.type(screen.getByLabelText("Instructions"), "Create execution plans.");
}

function agentRow(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name, level: 3 });
  const row = heading.closest("article");
  if (!row) {
    throw new Error(`Missing row for ${name}`);
  }
  return row;
}

describe("AgentManagementPage API integration", () => {
  it("shows loading and then renders enabled and disabled agents", async () => {
    let resolveList!: (agents: AgentListItem[]) => void;
    const listPromise = new Promise<AgentListItem[]>((resolve) => {
      resolveList = resolve;
    });
    const client = createClient({ listAgents: vi.fn(() => listPromise) });

    renderPage(client);
    expect(screen.getByRole("status").textContent).toContain("Loading agents");

    resolveList([enabledAgent, disabledAgent]);
    expect(await screen.findByText("Research Agent")).toBeTruthy();
    expect(screen.getByText("Support Agent")).toBeTruthy();
  });

  it("renders the API empty state without mock agents", async () => {
    renderPage(createClient({ listAgents: vi.fn(async () => []) }));

    expect(await screen.findByText("No active agents yet.")).toBeTruthy();
    expect(screen.queryByText("Research Agent")).toBeNull();
  });

  it("shows an initial error and retries the list request", async () => {
    const listAgents = vi
      .fn()
      .mockRejectedValueOnce(new AgentApiClientError({ message: "API unavailable", kind: "network" }))
      .mockResolvedValueOnce([enabledAgent]);
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
      role: "Planner"
    };
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([enabledAgent])
      .mockResolvedValueOnce([enabledAgent, createdAgent]);
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await fillCreateForm(user);
    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(await screen.findByText("Planning Agent")).toBeTruthy();
    expect(client.createAgent).toHaveBeenCalledWith(workspaceId, {
      name: "Planning Agent",
      role: "Planner",
      model: "gpt-4.1-mini",
      instructions: "Create execution plans."
    });
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("maps validation errors and preserves create values", async () => {
    const client = createClient({
      createAgent: vi.fn(async () => {
        throw new AgentApiClientError({
          code: "validation.invalid_input",
          message: "Invalid agent configuration",
          details: { issues: ["role is required"] },
          status: 400,
          kind: "api"
        });
      })
    });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");
    await user.type(screen.getByLabelText("Name"), "Planning Agent");
    await user.type(screen.getByLabelText("Instructions"), "Create plans.");

    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(await screen.findByText("role is required")).toBeTruthy();
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
    await fillCreateForm(user);

    const submit = screen.getByRole("button", { name: "Create agent" });
    await user.click(submit);
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(client.createAgent).toHaveBeenCalledTimes(1);

    rejectCreate(new AgentApiClientError({ message: "Create failed", kind: "api" }));
    expect(await screen.findByText("Create failed")).toBeTruthy();
    expect(screen.getByText("Research Agent")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("Planning Agent");
  });

  it("loads editable configuration before enabling save", async () => {
    const client = createClient();
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Edit" }));

    expect(await screen.findByDisplayValue("Prepare market research.")).toBeTruthy();
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
          status: 404
        });
      })
    });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Edit" }));

    expect(await screen.findByText("Agent is not available in this workspace.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(client.updateAgent).not.toHaveBeenCalled();
  });

  it("updates an agent without sending its name and refreshes the row", async () => {
    const updatedAgent = { ...enabledAgent, role: "Analyst", model: "gpt-4.1" };
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([enabledAgent])
      .mockResolvedValueOnce([updatedAgent]);
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");
    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Edit" }));
    await screen.findByDisplayValue("Prepare market research.");
    await user.clear(screen.getByLabelText("Role"));
    await user.type(screen.getByLabelText("Role"), "Analyst");
    await user.clear(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "gpt-4.1");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(within(agentRow("Research Agent")).getByText("Analyst")).toBeTruthy());
    expect(client.updateAgent).toHaveBeenCalledWith(workspaceId, enabledAgent.agentId, {
      role: "Analyst",
      model: "gpt-4.1",
      instructions: "Prepare market research."
    });
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
    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Edit" }));
    await screen.findByDisplayValue("Prepare market research.");
    await user.clear(screen.getByLabelText("Role"));
    await user.type(screen.getByLabelText("Role"), "Analyst");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(client.updateAgent).toHaveBeenCalledTimes(1);

    rejectUpdate(new AgentApiClientError({ message: "Update failed", kind: "api" }));
    expect(await screen.findByText("Update failed")).toBeTruthy();
    expect(screen.getByLabelText("Role")).toHaveValue("Analyst");
  });

  it("disables and enables agents while refreshing available actions", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([enabledAgent])
      .mockResolvedValueOnce([{ ...enabledAgent, status: "disabled" }])
      .mockResolvedValueOnce([enabledAgent]);
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Disable" }));
    expect(await within(agentRow("Research Agent")).findByRole("button", { name: "Enable" })).toBeTruthy();
    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Enable" }));
    expect(await within(agentRow("Research Agent")).findByRole("button", { name: "Disable" })).toBeTruthy();

    expect(client.disableAgent).toHaveBeenCalledTimes(1);
    expect(client.enableAgent).toHaveBeenCalledTimes(1);
  });

  it("requires deletion confirmation and removes the confirmed agent", async () => {
    const listAgents = vi
      .fn()
      .mockResolvedValueOnce([enabledAgent])
      .mockResolvedValueOnce([]);
    const client = createClient({ listAgents });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPage(client);
    await screen.findByText("Research Agent");

    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Delete" }));
    expect(client.deleteAgent).not.toHaveBeenCalled();
    expect(screen.getByText("Research Agent")).toBeTruthy();

    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No active agents yet.")).toBeTruthy();
    expect(client.deleteAgent).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(2);
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

    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Disable" }));
    await user.click(within(agentRow("Research Agent")).getByRole("button", { name: "Disable" }));
    expect(client.disableAgent).toHaveBeenCalledTimes(1);

    rejectDisable(new AgentApiClientError({ message: "Lifecycle failed", kind: "network" }));
    expect(await screen.findByText("Lifecycle failed")).toBeTruthy();
    expect(screen.getByText("Research Agent")).toBeTruthy();
    expect(client.disableAgent).toHaveBeenCalledTimes(1);
  });
});
