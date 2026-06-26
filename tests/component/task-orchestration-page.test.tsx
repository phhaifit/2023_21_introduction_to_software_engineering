import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vcp/frontend/features/agent-management/agent-management-page.tsx", () => ({
  AgentManagementPage: () => <section>Agent management placeholder</section>
}));

vi.mock("@vcp/frontend/features/subscription-payment/subscription-payment-page.tsx", () => ({
  SubscriptionPaymentPage: () => <section>Billing placeholder</section>
}));

vi.mock("@vcp/frontend/features/dashboard/DashboardPage.tsx", () => ({
  DashboardPage: () => <section>Dashboard placeholder</section>
}));

vi.mock("@vcp/frontend/features/workflow-management/WorkflowsPage.tsx", () => ({
  WorkflowsPage: () => <section>Workflows placeholder</section>
}));

import { App } from "@vcp/frontend/App.tsx";
import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";

afterEach(cleanup);
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function() {
    (this as HTMLDialogElement).open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function() {
    (this as HTMLDialogElement).open = false;
  });
});

describe("TaskOrchestrationPage base workspace", () => {
  it("renders the semantic empty workspace without task processing data", () => {
    render(<TaskOrchestrationPage />);

    expect(screen.getByRole("complementary", { name: "Task workspace sidebar" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Task & Orchestration" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Main conversation region" })).toBeVisible();
    expect(screen.getByRole("heading", {
      name: "What should your virtual team work on?"
    })).toBeVisible();
    expect(screen.getByRole("list", { name: "Suggested prompts" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Task composer area" })).toBeVisible();

    expect(screen.queryByText(/Task ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Work ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timeline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pending/i)).not.toBeInTheDocument();
  });

  it("renders a distinct accessible loading state without implying a task", () => {
    render(<TaskOrchestrationPage isLoading />);

    const loadingState = screen.getByRole("status");
    expect(loadingState).toHaveTextContent("Preparing your workspace");
    expect(loadingState).toHaveTextContent("Loading local conversation controls");
    expect(screen.queryByText(/Pending/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", {
      name: "What should your virtual team work on?"
    })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Request")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("renders the real controlled routing selector and composer", () => {
    render(<TaskOrchestrationPage />);

    expect(screen.getByRole("group", { name: "Routing mode" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Auto-routing/ })).toBeChecked();
    expect(screen.getByLabelText("Request")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("uses deterministic suggestions and renders Pending after accepted submit", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage />);

    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByLabelText("Request")).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    const suggestions = screen.getByRole("list", { name: "Suggested prompts" });
    const suggestion = within(suggestions).getAllByRole("button")[0];
    await user.click(suggestion);

    const prompt = screen.getByLabelText("Request");
    expect(prompt).not.toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(prompt).not.toHaveAttribute("aria-invalid");

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(prompt).toHaveValue("");
    expect(screen.getByRole("radio", { name: /Auto-routing/ })).toBeChecked();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "View processing details" }));
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText(/Task ID/i)).toBeVisible();
    expect(screen.getByText(/Work ID/i)).toBeVisible();
    expect(screen.queryByText(/processing log/i)).not.toBeInTheDocument();
  });

  it("opens the workspace through the executions navigation entry", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    const navigation = screen.getByRole("complementary", { name: "Primary navigation" });
    await user.click(within(navigation).getByRole("link", { name: "Công việc" }));

    expect(screen.getByRole("region", { name: "Main conversation region" })).toBeVisible();
  });
});
