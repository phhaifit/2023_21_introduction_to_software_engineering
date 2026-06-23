import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskComposer } from
  "@vcp/frontend/features/task-orchestration/components/task-composer.tsx";

afterEach(cleanup);

function renderComposer({
  prompt = "",
  isSubmitting = false,
  onPromptChange = vi.fn(),
  onSubmit = vi.fn()
}: {
  prompt?: string;
  isSubmitting?: boolean;
  onPromptChange?: (value: string) => void;
  onSubmit?: () => void;
} = {}) {
  render(
    <TaskComposer
      prompt={prompt}
      isSubmitting={isSubmitting}
      onPromptChange={onPromptChange}
      onSubmit={onSubmit}
    />
  );

  return { onPromptChange, onSubmit };
}

describe("TaskComposer", () => {
  it("renders a controlled multiline prompt with an accessible name", () => {
    renderComposer({ prompt: "Prepare the weekly summary." });

    const prompt = screen.getByRole("textbox", { name: "Request" });
    expect(prompt.tagName).toBe("TEXTAREA");
    expect(prompt).toHaveValue("Prepare the weekly summary.");
    expect(prompt).toHaveAccessibleDescription(
      "Describe the outcome your virtual team should produce."
    );
  });

  it("emits prompt changes without mutating the supplied value", () => {
    const originalPrompt = "Original";
    const onPromptChange = vi.fn();
    renderComposer({ prompt: originalPrompt, onPromptChange });

    fireEvent.change(screen.getByRole("textbox", { name: "Request" }), {
      target: { value: "Updated request" }
    });

    expect(onPromptChange).toHaveBeenCalledWith("Updated request");
    expect(originalPrompt).toBe("Original");
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   \n  "]
  ])("rejects an %s prompt with accessible feedback", async (_case, prompt) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderComposer({ prompt, onSubmit });

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a task request before sending."
    );
    expect(screen.getByRole("textbox", { name: "Request" })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("submits a valid prompt exactly once", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderComposer({ prompt: "Prepare a report.", onSubmit });

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears validation after the user corrects the prompt", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TaskComposer
        prompt=""
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByRole("alert")).toBeVisible();

    rerender(
      <TaskComposer
        prompt="Corrected request"
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Request" })).not.toHaveAttribute(
      "aria-invalid"
    );
  });

  it("disables prompt and submit interaction while submitting", () => {
    renderComposer({ prompt: "Ready", isSubmitting: true });

    expect(screen.getByRole("textbox", { name: "Request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  });

  it("keeps attachment upload explicitly unavailable", () => {
    renderComposer();

    expect(screen.getByRole("button", { name: "Add attachment" })).toBeDisabled();
    expect(screen.getByText(
      "Attachments are not supported in this prototype."
    )).toBeVisible();
  });

  it("supports keyboard submission through the native submit control", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderComposer({ prompt: "Keyboard request", onSubmit });

    screen.getByRole("button", { name: "Send request" }).focus();
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
