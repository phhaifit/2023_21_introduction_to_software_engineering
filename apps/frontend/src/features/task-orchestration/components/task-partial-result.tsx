import type { TaskStreamingPhase } from "../model/task-streaming";

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

      <p
        className="task-partial-result__body"
        aria-label="Accumulated partial result"
        aria-live="polite"
      >
        {partialText || "Partial output is starting."}
      </p>
    </section>
  );
}
