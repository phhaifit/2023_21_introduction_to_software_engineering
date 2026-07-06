import { useId, useState, type FormEvent, type ReactNode } from "react";

import "./task-composer.css";

const EMPTY_PROMPT_MESSAGE = "Enter a task request before sending.";

interface TaskComposerProps {
  prompt: string;
  isDisabled?: boolean;
  isSubmitting?: boolean;
  cancellableTaskActive?: boolean;
  toolbar?: ReactNode;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onCancelTask?: () => void;
}

export function TaskComposer({
  prompt,
  isDisabled = false,
  isSubmitting = false,
  cancellableTaskActive = false,
  toolbar,
  onPromptChange,
  onSubmit,
  onCancelTask
}: TaskComposerProps) {
  const promptId = useId();
  const errorId = `${promptId}-error`;

  const [invalidSubmitAttempted, setInvalidSubmitAttempted] = useState(false);
  const promptIsValid = prompt.trim().length > 0;
  const interactionIsDisabled = isDisabled || isSubmitting;
  const primaryIsCancel = cancellableTaskActive && !isSubmitting;
  const showValidationError = invalidSubmitAttempted && !promptIsValid && !primaryIsCancel;
  const sendDisabled = !primaryIsCancel && (interactionIsDisabled || !promptIsValid);
  const cancelDisabled = interactionIsDisabled;

  function handlePromptChange(value: string) {
    if (value.trim().length > 0) {
      setInvalidSubmitAttempted(false);
    }
    onPromptChange(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (primaryIsCancel) {
      return;
    }

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

  function handlePrimaryClick() {
    if (primaryIsCancel) {
      onCancelTask?.();
    }
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
              if (primaryIsCancel || interactionIsDisabled) {
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



        {primaryIsCancel ? (
          <button
            type="button"
            className="task-composer__send-btn task-composer__send-btn--cancel"
            disabled={cancelDisabled}
            aria-label="Cancel current task"
            onClick={handlePrimaryClick}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="task-composer__send-btn"
            disabled={sendDisabled}
            aria-label={isSubmitting ? "Sending request" : "Send request"}
          >
            {isSubmitting ? "…" : "Send"}
          </button>
        )}
      </div>

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
