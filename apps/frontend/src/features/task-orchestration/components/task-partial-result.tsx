import type { TaskStreamingPhase } from "../model/task-streaming";
import { TaskMarkdown } from "./task-markdown";

interface TaskPartialResultProps {
  partialText: string;
  phase: TaskStreamingPhase;
}

export function TaskPartialResult({
  partialText,
  phase
}: TaskPartialResultProps) {
  const isStreaming = phase === "streaming";

  return (
    <section
      className="task-partial-result"
      aria-labelledby="task-partial-result-title"
    >
      <div className="task-partial-result__header">
        <div>
          <p className="task-partial-result__eyebrow">Simulated output</p>
          <h4 id="task-partial-result-title">Partial Result</h4>
        </div>
        {isStreaming ? (
          <span className="task-partial-result__status" role="status">
            Generating partial result
          </span>
        ) : null}
      </div>

      <TaskMarkdown
        className="task-partial-result__body task-markdown"
        aria-label="Accumulated partial result"
        aria-live="polite"
        text={partialText || "Partial output is starting."}
      />
    </section>
  );
}
