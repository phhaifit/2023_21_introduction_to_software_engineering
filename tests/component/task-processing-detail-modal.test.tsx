import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskProcessingDetailModal } from "../../apps/frontend/src/features/task-orchestration/components/task-processing-detail-modal";
import type { TaskProcessingDetail } from "../../apps/frontend/src/features/task-orchestration/model/task-processing-detail";

describe("Task Processing Detail Modal", () => {
  const mockDetail: TaskProcessingDetail = {
    taskId: "TASK-001",
    workId: "WORK-001",
    status: "completed",
    routingSummary: "Routing: Auto-routing",
    durationMs: 4500,
    steps: [
      { id: "step-1", label: "Step 1", status: "completed" },
      { id: "step-2", label: "Step 2", status: "completed" }
    ],
    logs: [
      { id: "log-1", stepId: "step-1", level: "info", message: "Initial log", timestamp: "2024-01-01T00:00:01Z" }
    ]
  };

  beforeEach(() => {
    cleanup();
    // HTMLDialogElement is not fully supported in jsdom, we mock showModal
    HTMLDialogElement.prototype.showModal = vi.fn(function() {
      (this as HTMLDialogElement).open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function() {
      (this as HTMLDialogElement).open = false;
    });
  });

  it("renders detail modal and displays authoritative information", () => {
    const handleClose = vi.fn();
    render(<TaskProcessingDetailModal detail={mockDetail} onClose={handleClose} />);

    expect(screen.getByRole("dialog", { name: "Processing details" })).toBeInTheDocument();
    
    // Check identifiers
    expect(screen.getByText("TASK-001")).toBeInTheDocument();
    expect(screen.getByText("WORK-001")).toBeInTheDocument();

    // Check status
    const statusBadge = screen.getByLabelText("Task status: Completed");
    expect(statusBadge).toBeInTheDocument();

    // Check routing
    expect(screen.getByText("Routing: Auto-routing")).toBeInTheDocument();

    // Check duration formatting
    expect(screen.getByText("4.5s")).toBeInTheDocument();

    // Check timeline and logs exist
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Initial log")).toBeInTheDocument();
  });

  it("handles missing duration display gracefully", () => {
    const detailWithoutDuration = { ...mockDetail, durationMs: null };
    render(<TaskProcessingDetailModal detail={detailWithoutDuration} onClose={vi.fn()} />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("formats short durations in ms", () => {
    const detailShortDuration = { ...mockDetail, durationMs: 450 };
    render(<TaskProcessingDetailModal detail={detailShortDuration} onClose={vi.fn()} />);
    expect(screen.getByText("450ms")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<TaskProcessingDetailModal detail={mockDetail} onClose={handleClose} />);

    const closeBtn = screen.getByRole("button", { name: "Close processing details" });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("does not render logs if empty but shows fallback", () => {
    const detailEmptyLogs = { ...mockDetail, logs: [] };
    render(<TaskProcessingDetailModal detail={detailEmptyLogs} onClose={vi.fn()} />);
    expect(screen.getByText("No orchestration logs available.")).toBeInTheDocument();
  });
});
