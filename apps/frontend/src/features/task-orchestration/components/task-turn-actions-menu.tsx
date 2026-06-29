import { useEffect, useId, useRef, useState } from "react";

import type { CreatedTaskRecord } from "../model/task-types";
import { selectAccumulatedPartialText } from "../model/task-streaming";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

export interface TaskTurnActionsMenuProps {
  task: CreatedTaskRecord;
  prompt: string;
  clipboardWriter: TaskClipboardWriter;
  variant: "query" | "response";
  onViewDetails: () => void;
}

function getCopyableResponse(task: CreatedTaskRecord): string | null {
  if (task.status === "succeeded" && task.finalizedResult?.text) {
    return task.finalizedResult.text;
  }
  if (task.status === "running") {
    const partial = selectAccumulatedPartialText(task.streamingSnapshot);
    return partial.trim().length > 0 ? partial : null;
  }
  if (task.status === "failed" && task.error?.message) {
    return task.error.message;
  }
  if (task.status === "cancelled") {
    return "Task was canceled before completion.";
  }
  return null;
}

export function TaskTurnActionsMenu({
  task,
  prompt,
  clipboardWriter,
  variant,
  onViewDetails
}: TaskTurnActionsMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { copyText, feedback } = useCopyToClipboard(clipboardWriter);
  const responseText = getCopyableResponse(task);
  const copyableText = variant === "query" ? prompt : responseText;
  const copyLabel = variant === "query" ? "Copy query" : "Copy response";
  const menuLabel = "More response actions";

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleMenuAction(action: () => void | Promise<void>) {
    await action();
    setIsOpen(false);
  }

  return (
    <div
      className={`task-turn-actions task-turn-actions--${variant}${
        isOpen ? " task-turn-actions--open" : ""
      }`}
      ref={containerRef}
    >
      <button
        type="button"
        className="task-turn-actions__icon-button"
        aria-label={copyLabel}
        title={copyLabel}
        disabled={!copyableText}
        onClick={() => {
          if (copyableText) {
            copyText(copyableText);
          }
        }}
      >
        <span aria-hidden="true">⧉</span>
      </button>
      {variant === "response" ? (
        <button
          type="button"
          className="task-turn-actions__icon-button task-turn-actions__trigger"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-label={menuLabel}
          title={menuLabel}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span aria-hidden="true">...</span>
        </button>
      ) : null}
      {feedback !== "idle" ? (
        <span className="task-turn-actions__feedback sr-only" role="status" aria-live="polite">
          {feedback === "copied" ? "Copied" : "Copy unavailable"}
        </span>
      ) : null}
      {variant === "response" && isOpen ? (
        <ul id={menuId} className="task-turn-actions__menu" role="menu" aria-label={menuLabel}>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleMenuAction(onViewDetails)}
            >
              View processing details
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
