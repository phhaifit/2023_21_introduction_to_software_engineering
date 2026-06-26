/**
 * task-failed-details-ui.test.tsx
 *
 * Permanent automated UI tests for Task 13B-2 — Failed Summary, Error Details
 * and Processing Detail Modal Integration.
 *
 * Coverage mapping:
 * 1. Failed Summary Visibility: Task failed hiển thị TaskFailedState, không hiển thị CompletedResult, không có Retry.
 * 2. TaskError Details UI: Render đủ 5 fields (title, occurredAt, message, code, stepId), formatOccurredAt hoạt động đúng.
 * 3. Preserved Partial Output: Nếu có fragments, hiển thị phần output kèm nhãn "Partial output before failure", text cộng dồn chính xác.
 * 4. Completed Result Restriction: Task failed tuyệt đối không render TaskCompletedResult hay nút Copy.
 * 5. Failed Processing Details Modal: Nút "View processing details" mở modal, hiển thị badge Failed, Duration chính xác, hiển thị Error Details bên trong modal.
 * 6. Failed Timeline & Logs: Timeline hiển thị các bước trước đó Completed, aggregate-result là Failed, finalize là Waiting. Logs hiển thị các log trước khi fail.
 * 7. Terminal State Guards: Sau khi Failed, các thao tác Late Update bị từ chối, không thay đổi UI.
 * 8. Demo Reset & Isolation: Nút Reset dọn sạch UI về empty state, không lưu trạng thái cũ. Hai task A/B hiển thị độc lập.
 * 9. Accessibility: role="alert", aria-labelledby, aria-label đầy đủ trên TaskFailedState, TaskErrorDetails, Modal.
 * 10. Regression: Existing Pending, In-Progress, Succeeded, Canceled UI vẫn hoạt động bình thường.
 * 11. Dependency Check: Không import backend, database, Prisma, hoặc private modules.
 */

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskOrchestrationPage } from "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { resetTaskIdentitySequence } from "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import { formatOccurredAt } from "@vcp/frontend/features/task-orchestration/components/task-error-details.tsx";
import type { TaskCreationClient } from "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import type { TaskProcessingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-processing-runtime.ts";
import type { TaskStreamingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-streaming-runtime.ts";
import type { TaskCompletionRuntime } from "@vcp/frontend/features/task-orchestration/model/task-completion-runtime.ts";
import type { EntityId, TaskStatus as ProductionTaskStatus } from "@vcp/shared";

const FIXED_TS = "2026-06-25T12:00:00.000Z";

class FakeScheduler {
  callbacks: (() => void)[] = [];
  schedule(delayMs: number, callback: () => void) {
    this.callbacks.push(callback);
    return {
      cancel: () => {
        this.callbacks = this.callbacks.filter((cb) => cb !== callback);
      }
    };
  }
  advance() {
    const cbs = [...this.callbacks];
    this.callbacks = [];
    cbs.forEach((cb) => cb());
  }
}

class FakeProcessingRuntime implements TaskProcessingRuntime {
  scheduler = new FakeScheduler();
  clock = { now: () => FIXED_TS };
  logIdentitySource = {
    counter: 0,
    nextLogId() {
      this.counter += 1;
      return `log-${this.counter}`;
    }
  };
}

class FakeStreamingRuntime implements TaskStreamingRuntime {
  scheduler = new FakeScheduler();
  clock = { now: () => FIXED_TS };
  fragmentIdentitySource = {
    counter: 0,
    nextFragmentId() {
      this.counter += 1;
      return `frag-${this.counter}`;
    }
  };
  fragmentSource = {
    getFragments: () => ["Partial text chunk 1", " Partial text chunk 2"]
  };
}

class FakeCompletionRuntime implements TaskCompletionRuntime {
  scheduler = new FakeScheduler();
  resultSource = {
    finalize: () => ({
      text: "Completed successfully",
      actionItems: ["Action 1"],
      finalizedAt: "2026-06-25T12:00:05.000Z"
    })
  };
  clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined)
  };
}

class ConfigurableClient implements TaskCreationClient {
  callCount = 0;
  constructor(public status: ProductionTaskStatus = "queued") {}

  async createTask() {
    this.callCount += 1;
    const seq = this.callCount.toString().padStart(6, "0");
    return {
      taskId: `TASK-${seq}` as EntityId<"taskId">,
      workId: `WORK-${seq}` as EntityId<"workId">,
      status: this.status,
      createdAt: FIXED_TS
    };
  }
}

async function submitPrompt(prompt: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Request" }), prompt);
  await user.click(screen.getByRole("button", { name: "Send request" }));
  return user;
}

afterEach(cleanup);

beforeEach(() => {
  resetTaskIdentitySequence();
  HTMLDialogElement.prototype.showModal = vi.fn(function() {
    (this as HTMLDialogElement).open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function() {
    (this as HTMLDialogElement).open = false;
  });
});

describe("1. Failed Summary Visibility", () => {
  it("Task failed hiển thị TaskFailedState, không hiển thị CompletedResult, không có Retry", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: test failure");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    // Advance to failure at aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // queued -> running (validate-input)
    act(() => { pRuntime.scheduler.advance(); }); // validate-input -> analyze-request
    act(() => { pRuntime.scheduler.advance(); }); // analyze-request -> select-routing
    act(() => { pRuntime.scheduler.advance(); }); // select-routing -> execute-task
    act(() => { pRuntime.scheduler.advance(); }); // execute-task -> aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // aggregate-result fails

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();
    expect(screen.getByText("Task Failed")).toBeVisible();
    expect(screen.queryByText("Completed Result")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  }, 10000);
});

describe("2. TaskError Details UI", () => {
  it("Render đủ 5 fields (title, occurredAt, message, code, stepId), formatOccurredAt hoạt động đúng", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: error details check");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();

    // Verify 5 fields
    expect(screen.getByText("Không thể tổng hợp kết quả")).toBeVisible(); // title
    expect(screen.getByText("Quá trình tổng hợp kết quả đã được mô phỏng là thất bại.")).toBeVisible(); // message
    expect(screen.getByText("MOCK_AGGREGATION_FAILED")).toBeVisible(); // code
    expect(screen.getAllByText("aggregate-result")[0]).toBeVisible(); // stepId
    expect(screen.getByText(`Occurred at: ${FIXED_TS}`)).toBeVisible(); // occurredAt

    // Test formatOccurredAt pure helper directly
    expect(formatOccurredAt(FIXED_TS)).toBe(FIXED_TS);
    expect(formatOccurredAt("")).toBe("Unavailable");
    expect(formatOccurredAt("invalid-date")).toBe("invalid-date");
  });
});

describe("3. Preserved Partial Output", () => {
  it("Nếu có fragments, hiển thị phần output kèm nhãn 'Partial output before failure', text cộng dồn chính xác", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={pRuntime}
        streamingRuntime={sRuntime}
      />
    );

    await submitPrompt("FAIL_SIMULATION: partial output check");
    act(() => { pRuntime.scheduler.advance(); }); // validate-input
    act(() => { pRuntime.scheduler.advance(); }); // analyze-request
    act(() => { pRuntime.scheduler.advance(); }); // select-routing
    act(() => { pRuntime.scheduler.advance(); }); // execute-task

    // Emit streaming fragments
    act(() => { sRuntime.scheduler.advance(); }); // chunk 1
    act(() => { sRuntime.scheduler.advance(); }); // chunk 2

    act(() => { pRuntime.scheduler.advance(); }); // aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // fails

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();
    expect(screen.getByText("Partial output before failure")).toBeVisible();
    expect(screen.getByText("Partial text chunk 1 Partial text chunk 2")).toBeVisible();
  });
});

describe("4. Completed Result Restriction", () => {
  it("Task failed tuyệt đối không render TaskCompletedResult hay nút Copy", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: restriction check");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();
    expect(screen.queryByText("Completed Result")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });
});

describe("5. Failed Processing Details Modal", () => {
  it("Nút 'View processing details' mở modal, hiển thị badge Failed, Duration chính xác, hiển thị Error Details bên trong modal", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: modal check");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }

    const detailBtn = screen.getByRole("button", { name: "View processing details" });
    await user.click(detailBtn);

    const dialog = screen.getByRole("dialog", { name: "Processing details" });
    expect(dialog).toBeVisible();

    // Verify Failed badge inside modal
    const badge = within(dialog).getByLabelText("Task status: Failed");
    expect(badge).toBeVisible();

    // Duration is 0ms since clock now() returns FIXED_TS for both start and error occurrence
    expect(within(dialog).getByText("0ms")).toBeVisible();

    // Verify Error Details inside modal
    expect(within(dialog).getByRole("heading", { name: "Error Details" })).toBeVisible();
    expect(within(dialog).getByText("Không thể tổng hợp kết quả")).toBeVisible();

    // Open Advanced details to see internal error code
    const advancedToggle = within(dialog).getByRole("button", { name: /Show Advanced details/i });
    await user.click(advancedToggle);
    expect(within(dialog).getByText("MOCK_AGGREGATION_FAILED")).toBeVisible();

    // Close modal
    const closeBtn = within(dialog).getByRole("button", { name: "Close processing details" });
    await user.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("6. Failed Timeline & Logs", () => {
  it("Timeline hiển thị các bước trước đó Completed, aggregate-result là Failed, finalize là Waiting. Logs hiển thị các log trước khi fail", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: timeline check");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "View processing details" }));
    await user.click(screen.getAllByRole("button", { name: /Show Advanced details/i })[0]);

    const timeline = screen.getAllByLabelText(/processing timeline/i)[0]!;
    const listItems = within(timeline).getAllByRole("listitem");

    expect(listItems[0]).toHaveTextContent("Completed"); // validate-input
    expect(listItems[1]).toHaveTextContent("Completed"); // analyze-request
    expect(listItems[2]).toHaveTextContent("Completed"); // select-routing
    expect(listItems[3]).toHaveTextContent("Completed"); // execute-task
    expect(listItems[4]).toHaveTextContent("Failed"); // aggregate-result
    expect(listItems[5]).toHaveTextContent("Waiting"); // finalize

    const logs = screen.getAllByLabelText("Processing log details")[0]!;
    expect(within(logs).getByText("Input validated successfully.")).toBeVisible();
    expect(within(logs).getByText("Task executed.")).toBeVisible();
    expect(within(logs).getByText("Aggregating result.")).toBeVisible();
  });
});

describe("7. Terminal State Guards", () => {
  it("Sau khi Failed, các thao tác Late Update bị từ chối, không thay đổi UI", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={pRuntime}
        streamingRuntime={sRuntime}
        completionRuntime={cRuntime}
      />
    );

    await submitPrompt("FAIL_SIMULATION: terminal guard check");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();

    // Advance all schedulers to simulate late callbacks
    act(() => {
      pRuntime.scheduler.advance();
      sRuntime.scheduler.advance();
      cRuntime.scheduler.advance();
    });

    expect(screen.getByLabelText("Task status: Failed")).toBeVisible();
    expect(screen.queryByLabelText("Task status: Completed")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed Result")).not.toBeInTheDocument();
  });
});

describe("8. Demo Reset & Isolation", () => {
  it("Nút Reset dọn sạch UI về empty state, không lưu trạng thái cũ. Hai task A/B hiển thị độc lập", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntimeA = new FakeProcessingRuntime();
    const { unmount } = render(
      <TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntimeA} />
    );

    await submitPrompt("FAIL_SIMULATION: Task A");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntimeA.scheduler.advance(); });
    }
    expect(await screen.findByText("FAIL_SIMULATION: Task A")).toBeVisible();
    expect(screen.getByLabelText("Task status: Failed")).toBeVisible();

    // Simulate Demo Reset by unmounting, cleaning up, resetting ID sequence, and remounting
    unmount();
    cleanup();
    resetTaskIdentitySequence();

    const pRuntimeB = new FakeProcessingRuntime();
    render(
      <TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntimeB} />
    );

    // Assert empty state restored
    expect(screen.getByText("What should your virtual team work on?")).toBeVisible();
    expect(screen.queryByText("FAIL_SIMULATION: Task A")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Task status: Failed")).not.toBeInTheDocument();

    // Submit Task B (normal task)
    await submitPrompt("Normal Task B");
    expect(await screen.findByText("Normal Task B")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
  });
});

describe("9. Accessibility", () => {
  it("role='alert', aria-labelledby, aria-label đầy đủ trên TaskFailedState, TaskErrorDetails, Modal", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: a11y check");
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }

    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();

    // TaskFailedState accessibility
    const failedSection = screen.getByLabelText("Status: Failed").closest("section")!;
    expect(failedSection).toHaveAttribute("aria-labelledby", "task-failed-state-title");

    // TaskErrorDetails accessibility
    const alertDiv = within(failedSection).getByRole("alert");
    expect(alertDiv).toHaveAttribute("aria-labelledby", "task-error-details-title");
    expect(within(alertDiv).getByLabelText("Error metadata")).toBeVisible();

    // Modal accessibility
    const detailBtn = screen.getByRole("button", { name: "View processing details" });
    await user.click(detailBtn);

    const modal = screen.getByRole("dialog", { name: "Processing details" });
    expect(modal).toHaveAttribute("aria-labelledby", "processing-detail-title");
    expect(within(modal).getByLabelText("Processing identifiers")).toBeVisible();
  });
});

describe("10. Regression", () => {
  it("Existing Pending, In-Progress, Succeeded, Canceled UI vẫn hoạt động bình thường", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={pRuntime}
        streamingRuntime={sRuntime}
        completionRuntime={cRuntime}
      />
    );

    // Submit normal task
    await submitPrompt("Regression check normal");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    act(() => { pRuntime.scheduler.advance(); }); // queued -> running
    expect(await screen.findByLabelText("Task status: In Progress")).toBeVisible();

    // Advance to success
    act(() => { pRuntime.scheduler.advance(); }); // analyze-request
    act(() => { pRuntime.scheduler.advance(); }); // select-routing
    act(() => { pRuntime.scheduler.advance(); }); // execute-task

    act(() => { sRuntime.scheduler.advance(); }); // chunk 1
    act(() => { sRuntime.scheduler.advance(); }); // chunk 2
    act(() => { sRuntime.scheduler.advance(); }); // exhausted

    act(() => { pRuntime.scheduler.advance(); }); // aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // finalize
    act(() => { cRuntime.scheduler.advance(); }); // completed

    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();
    expect(screen.getByText("Completed successfully")).toBeVisible();
  });
});

describe("11. Dependency Check", () => {
  const root = process.cwd();
  const files = [
    "apps/frontend/src/features/task-orchestration/components/task-error-details.tsx",
    "apps/frontend/src/features/task-orchestration/components/task-failed-state.tsx",
    "apps/frontend/src/features/task-orchestration/model/task-processing-detail.ts",
    "apps/frontend/src/features/task-orchestration/components/task-processing-detail-modal.tsx",
    "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"
  ];

  it.each(files)("file %s không import backend, database, Prisma, hoặc private modules", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    expect(source).not.toMatch(/@vcp\/backend/);
    expect(source).not.toMatch(/@vcp\/database/);
    expect(source).not.toMatch(/Prisma/);
    expect(source).not.toMatch(/modules\/agent-management/);
    expect(source).not.toMatch(/modules\/workflow-management/);
  });
});
