import type { TaskFinalizedResult } from "../model/task-completion";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";
import { TaskMarkdown } from "./task-markdown";

export interface TaskCompletedResultProps {
  result: TaskFinalizedResult;
  clipboardWriter: TaskClipboardWriter;
}

export function TaskCompletedResult({
  result,
  clipboardWriter: _clipboardWriter
}: TaskCompletedResultProps) {
  return (
    <div className="task-completed-result" aria-label="Assistant final response">
      <TaskMarkdown className="task-markdown" text={result.text} />
      {result.citations?.length ? (
        <ul className="task-knowledge-citations" aria-label="Knowledge citations">
          {result.citations.map((citation) => (
            <li key={citation.citationId}>
              <strong>
                {citation.citationId}: {citation.documentTitle}
              </strong>
              <p>{citation.snippet}</p>
              {citation.sourceLocator ? (
                <small>{citation.sourceLocator}</small>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
