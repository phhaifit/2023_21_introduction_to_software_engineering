import { useCallback, useEffect, useState } from "react";

import type { TaskClipboardWriter } from "../model/task-completion-runtime";

export type CopyFeedbackState = "idle" | "copied" | "error";

export function useCopyToClipboard(clipboardWriter: TaskClipboardWriter) {
  const [feedback, setFeedback] = useState<CopyFeedbackState>("idle");

  useEffect(() => {
    if (feedback === "idle") {
      return;
    }
    const id = window.setTimeout(() => setFeedback("idle"), 2000);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const copyText = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setFeedback("error");
        return false;
      }
      try {
        await clipboardWriter.writeText(text);
        setFeedback("copied");
        return true;
      } catch {
        setFeedback("error");
        return false;
      }
    },
    [clipboardWriter]
  );

  return { copyText, feedback };
}
