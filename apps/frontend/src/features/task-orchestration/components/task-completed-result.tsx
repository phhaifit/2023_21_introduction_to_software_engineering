import type { TaskFinalizedResult } from "../model/task-completion";
import type { TaskClipboardWriter } from "../model/task-completion-runtime";
import { TaskMarkdown } from "./task-markdown";

export interface TaskCompletedResultProps {
  result: TaskFinalizedResult;
  clipboardWriter: TaskClipboardWriter;
  isWorkflow?: boolean;
}

export function TaskCompletedResult({
  result,
  clipboardWriter: _clipboardWriter,
  isWorkflow = false
}: TaskCompletedResultProps) {
  const isWorkflowStatusOnly = isWorkflow && isGenericWorkflowCompletion(result.text);

  return (
    <div className="task-completed-result" aria-label="Assistant final response">
      {isWorkflowStatusOnly ? (
        <div className="task-workflow-completion" role="status">
          <strong>Workflow completed successfully.</strong>
          <span>No workflow output was returned.</span>
        </div>
      ) : (
        <TaskMarkdown className="task-markdown" text={result.text} />
      )}
      {result.citations?.length ? (
        <ul className="task-knowledge-citations" aria-label="Knowledge citations">
          {result.citations.map((citation) => (
            <li key={citation.citationId}>
              <details className="task-knowledge-citation">
                <summary>
                  <span>{citation.citationId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{citation.documentTitle}</span>
                </summary>
                <div className="task-knowledge-citation__details">
                  <dl>
                    <div>
                      <dt>Evidence id</dt>
                      <dd>{citation.citationId}</dd>
                    </div>
                    <div>
                      <dt>Document</dt>
                      <dd>{citation.documentTitle}</dd>
                    </div>
                    {citation.sourceLocator ? (
                      <div>
                        <dt>Source</dt>
                        <dd>{citation.sourceLocator}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p>{citation.snippet}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function isGenericWorkflowCompletion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return [
    "completed successfully.",
    "execution completed successfully.",
    "workflow execution completed successfully."
  ].includes(normalized);
}
