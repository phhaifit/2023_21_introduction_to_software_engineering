import { useEffect, useId, useRef, useState } from "react";

import type { CreatedTaskRecord } from "../model/task-types";
import { selectAccumulatedPartialText } from "../model/task-streaming";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

export interface TaskTurnActionsMenuProps {
  task: CreatedTaskRecord;
  prompt: string;
  clipboardWriter: TaskClipboardWriter;
  canDelete: boolean;
  deleteDisabledReason?: string;
  onViewDetails: () => void;
  onDelete: () => void;
}

function getCopyableResponse(task: CreatedTaskRecord): string | null {
  if (task.status === "succeeded" && task.finalizedResult?.text) {
    return task.finalizedResult.text;
  }
  if (task.status === "running") {
    const partial = selectAccumulatedPartialText(task.streamingSnapshot);
    return partial.trim().length > 0 ? partial : null;
  }
  return null;
}

export function TaskTurnActionsMenu({
  task,
  prompt,
  clipboardWriter,
  canDelete,
  deleteDisabledReason,
  onViewDetails,
  onDelete
}: TaskTurnActionsMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { copyText, feedback } = useCopyToClipboard(clipboardWriter);
  const responseText = getCopyableResponse(task);
  const menuLabel = `More actions for this work`;

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
      className={`task-turn-actions${isOpen ? " task-turn-actions--open" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="task-turn-actions__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={menuLabel}
        title={menuLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        ⋯
      </button>
      {feedback !== "idle" ? (
        <span className="task-turn-actions__feedback sr-only" role="status" aria-live="polite">
          {feedback === "copied" ? "Copied" : "Copy unavailable"}
        </span>
      ) : null}
      {isOpen ? (
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
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleMenuAction(() => copyText(prompt))}
            >
              Copy query
            </button>
          </li>
          {responseText ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuAction(() => copyText(responseText))}
              >
                Copy response
              </button>
            </li>
          ) : null}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleMenuAction(() => copyText(task.taskId as string))}
            >
              Copy Task ID
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleMenuAction(() => copyText(task.workId as string))}
            >
              Copy Work ID
            </button>
          </li>
          {task.status === "failed" && task.error ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuAction(onViewDetails)}
              >
                View error details
              </button>
            </li>
          ) : null}
          {task.status === "cancelled" ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleMenuAction(onViewDetails)}
              >
                View cancellation details
              </button>
            </li>
          ) : null}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-turn-actions__menu-item--danger"
              disabled={!canDelete}
              title={!canDelete ? deleteDisabledReason : undefined}
              onClick={() => {
                if (canDelete) {
                  handleMenuAction(onDelete);
                }
              }}
            >
              Delete message
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
