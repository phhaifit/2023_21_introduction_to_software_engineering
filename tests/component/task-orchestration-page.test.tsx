import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vcp/frontend/features/agent-management/agent-management-page.tsx", () => ({
  AgentManagementPage: () => <section>Agent management placeholder</section>
}));

vi.mock("@vcp/frontend/features/subscription-payment/subscription-payment-page.tsx", () => ({
  SubscriptionPaymentPage: () => <section>Billing placeholder</section>
}));

import { App } from "@vcp/frontend/App.tsx";
import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";

afterEach(cleanup);

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
    expect(screen.getByRole("region", { name: "Task composer placeholder" })).toBeVisible();

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
  });

  it("keeps composer and routing controls clearly disabled", () => {
    render(<TaskOrchestrationPage />);

    expect(screen.getByLabelText("Routing")).toBeDisabled();
    expect(screen.getByLabelText("Request")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
    expect(screen.getByText(
      "Task submission and routing will be enabled in later sub-issues."
    )).toBeVisible();
  });

  it("opens the workspace through the existing application tab navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Công việc (Tasks)" }));

    expect(screen.getByRole("heading", {
      name: "Task & Orchestration",
      level: 1
    })).toBeVisible();
    expect(screen.getByRole("heading", {
      name: "Task & Orchestration",
      level: 2
    })).toBeVisible();
  });
});
