import { useCallback, useEffect, useState } from "react";
import type { TaskFinalizedResult } from "../model/task-completion";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";

export interface TaskCompletedResultProps {
  result: TaskFinalizedResult;
  clipboardWriter: TaskClipboardWriter;
}

export function TaskCompletedResult({
  result,
  clipboardWriter
}: TaskCompletedResultProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyMessage, setCopyMessage] = useState<string>("");

  useEffect(() => {
    if (copyState === "copied" || copyState === "error") {
      const id = setTimeout(() => {
        setCopyState("idle");
        setCopyMessage("");
      }, 3000);
      return () => clearTimeout(id);
    }
  }, [copyState]);

  const handleCopy = useCallback(async () => {
    try {
      await clipboardWriter.writeText(result.text);
      setCopyState("copied");
      setCopyMessage("Copied");
    } catch {
      setCopyState("error");
      setCopyMessage("Failed to copy");
    }
  }, [clipboardWriter, result.text]);

  return (
    <section className="task-completed-result" aria-labelledby="task-completed-result-title">
      <div className="task-completed-result__header">
        <h4 id="task-completed-result-title">Completed Result</h4>
        <div className="task-completed-result__actions">
          <button
            type="button"
            className="task-completed-result__copy-btn"
            onClick={handleCopy}
            aria-label="Copy finalized result"
          >
            Copy
          </button>
          <span 
            role="status" 
            aria-live="polite" 
            className={`task-completed-result__feedback ${copyState === "error" ? "task-completed-result__feedback--error" : ""}`}
          >
            {copyMessage}
          </span>
        </div>
      </div>
      <div className="task-completed-result__body">
        {result.text}
      </div>
    </section>
  );
}
