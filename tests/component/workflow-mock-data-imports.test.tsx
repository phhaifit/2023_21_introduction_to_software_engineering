import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from
  "@vcp/frontend/features/dashboard/DashboardPage.tsx";
import { WorkflowsPage } from
  "@vcp/frontend/features/workflow-management/WorkflowsPage.tsx";
import { mockWorkflows } from
  "../../apps/frontend/src/data/workflows.ts";
import type { WorkflowManagementApiClient } from "@vcp/frontend/features/workflow-management/api/workflow-api-client.ts";

afterEach(cleanup);

function createMockApiClient(overrides: Partial<WorkflowManagementApiClient> = {}): WorkflowManagementApiClient {
  return {
    listWorkflows: vi.fn(async () => mockWorkflows),
    getWorkflow: vi.fn(),
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    ...overrides
  } as unknown as WorkflowManagementApiClient;
}

describe("workflow mock data imports", () => {
  it("renders dashboard workflow summary from the shared demo data import", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Tổng số Workflows")).toBeVisible();
    expect(screen.getByText(String(mockWorkflows.length))).toBeVisible();
    expect(screen.getByText("Workflows hoạt động gần đây")).toBeVisible();
    expect(screen.getByText(mockWorkflows[0].name)).toBeVisible();
  });

  it("renders the workflow list with deterministic demo rows", async () => {
    const user = userEvent.setup();
    const apiClient = createMockApiClient();
    render(<WorkflowsPage apiClient={apiClient} />);

    await user.click(screen.getByRole("button", { name: "Danh sách" }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText(mockWorkflows[0].name)).toBeVisible();
  });

  it("renders an empty workflow search state without import failures", async () => {
    const user = userEvent.setup();
    const apiClient = createMockApiClient();
    render(<WorkflowsPage apiClient={apiClient} />);

    await user.click(screen.getByRole("button", { name: "Danh sách" }));
    await screen.findByRole("table");
    
    await user.type(
      screen.getByPlaceholderText("Tìm kiếm workflow..."),
      "khong-co-workflow"
    );

    expect(screen.getByText("Không tìm thấy workflow nào.")).toBeVisible();
  });
});
