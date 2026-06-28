import { useId, useState, type FormEvent, type ReactNode } from "react";

import "./task-composer.css";

const EMPTY_PROMPT_MESSAGE = "Enter a task request before sending.";

interface TaskComposerProps {
  prompt: string;
  isDisabled?: boolean;
  isSubmitting?: boolean;
  toolbar?: ReactNode;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}

export function TaskComposer({
  prompt,
  isDisabled = false,
  isSubmitting = false,
  toolbar,
  onPromptChange,
  onSubmit
}: TaskComposerProps) {
  const promptId = useId();
  const errorId = `${promptId}-error`;
  const attachmentDescriptionId = `${promptId}-attachment-description`;
  const [invalidSubmitAttempted, setInvalidSubmitAttempted] = useState(false);
  const promptIsValid = prompt.trim().length > 0;
  const interactionIsDisabled = isDisabled || isSubmitting;
  const showValidationError = invalidSubmitAttempted && !promptIsValid;
  const submitDisabled = interactionIsDisabled || !promptIsValid;

  function handlePromptChange(value: string) {
    if (value.trim().length > 0) {
      setInvalidSubmitAttempted(false);
    }
    onPromptChange(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (interactionIsDisabled) {
      return;
    }

    if (!promptIsValid) {
      setInvalidSubmitAttempted(true);
      return;
    }

    setInvalidSubmitAttempted(false);
    onSubmit();
  }

  return (
    <form
      className="task-composer__form"
      aria-label="Task composer"
      onSubmit={handleSubmit}
      noValidate
    >
      {toolbar ? <div className="task-composer__toolbar">{toolbar}</div> : null}

      <div className="task-composer__input-row">
        <label className="sr-only" htmlFor={promptId}>
          Request
        </label>
        <textarea
          id={promptId}
          className="task-composer__textarea"
          value={prompt}
          placeholder="Message your virtual team..."
          rows={1}
          aria-describedby={showValidationError ? errorId : undefined}
          aria-invalid={showValidationError ? "true" : undefined}
          disabled={interactionIsDisabled}
          onChange={(event) => handlePromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (interactionIsDisabled) {
                return;
              }
              if (!promptIsValid) {
                setInvalidSubmitAttempted(true);
                return;
              }
              setInvalidSubmitAttempted(false);
              onSubmit();
            }
          }}
        />

        <button
          type="button"
          className="task-composer__attachment-btn"
          disabled
          aria-label="Add attachment"
          aria-describedby={attachmentDescriptionId}
          title="Attachments are not supported in this prototype"
        >
          📎
        </button>

        <button
          type="submit"
          className="task-composer__send-btn"
          disabled={submitDisabled}
          aria-label={isSubmitting ? "Sending request" : "Send request"}
        >
          {isSubmitting ? "…" : "Send"}
        </button>
      </div>

      <p className="task-composer__attachment-note" id={attachmentDescriptionId}>
        Attachments are not supported in this prototype.
      </p>

      <p
        className="task-composer__error"
        id={errorId}
        role={showValidationError ? "alert" : undefined}
      >
        {showValidationError ? EMPTY_PROMPT_MESSAGE : ""}
      </p>
    </form>
  );
}
