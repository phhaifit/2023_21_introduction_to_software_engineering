import { useId, useState, type FormEvent } from "react";

import "./task-composer.css";

const EMPTY_PROMPT_MESSAGE = "Enter a task request before sending.";

interface TaskComposerProps {
  prompt: string;
  isDisabled?: boolean;
  isSubmitting?: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}

export function TaskComposer({
  prompt,
  isDisabled = false,
  isSubmitting = false,
  onPromptChange,
  onSubmit
}: TaskComposerProps) {
  const promptId = useId();
  const descriptionId = `${promptId}-description`;
  const errorId = `${promptId}-error`;
  const attachmentDescriptionId = `${promptId}-attachment-description`;
  const [invalidSubmitAttempted, setInvalidSubmitAttempted] = useState(false);
  const promptIsValid = prompt.trim().length > 0;
  const interactionIsDisabled = isDisabled || isSubmitting;
  const showValidationError = invalidSubmitAttempted && !promptIsValid;

  function handlePromptChange(value: string) {
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
      <label className="task-composer__input" htmlFor={promptId}>
        <span>Request</span>
        <textarea
          id={promptId}
          value={prompt}
          placeholder="Describe the work you want completed..."
          aria-describedby={
            showValidationError
              ? `${descriptionId} ${errorId}`
              : descriptionId
          }
          aria-invalid={showValidationError ? "true" : undefined}
          disabled={interactionIsDisabled}
          onChange={(event) => handlePromptChange(event.target.value)}
        />
      </label>

      <p className="task-composer__description" id={descriptionId}>
        Describe the outcome your virtual team should produce.
      </p>

      <p
        className="task-composer__error"
        id={errorId}
        role={showValidationError ? "alert" : undefined}
      >
        {showValidationError ? EMPTY_PROMPT_MESSAGE : ""}
      </p>

      <div className="task-composer__actions">
        <button
          className="task-composer__attachment"
          type="button"
          disabled
          aria-describedby={attachmentDescriptionId}
        >
          Add attachment
        </button>
        <p id={attachmentDescriptionId}>
          Attachments are not supported in this prototype.
        </p>
        <button type="submit" disabled={interactionIsDisabled}>
          {isSubmitting ? "Sending..." : "Send request"}
        </button>
      </div>
    </form>
  );
}
