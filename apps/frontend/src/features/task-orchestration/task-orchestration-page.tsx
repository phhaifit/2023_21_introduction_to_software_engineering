import { useState } from "react";

import { TaskComposer } from "./components/task-composer";
import { DEMO_PROMPTS } from "./mocks/task-orchestration-mocks";

import "./task-orchestration-page.css";

type TaskOrchestrationPageProps = {
  isLoading?: boolean;
};

const suggestedPrompts = [
  DEMO_PROMPTS.weeklyProgressReport,
  DEMO_PROMPTS.specificAgentProductDescription,
  DEMO_PROMPTS.researchAndSynthesis
] as const;

export function TaskOrchestrationPage({
  isLoading = false
}: TaskOrchestrationPageProps) {
  const [prompt, setPrompt] = useState("");

  function handleAcceptedSubmission() {
    setPrompt("");
  }

  return (
    <section className="task-workspace" aria-labelledby="task-workspace-title">
      <aside className="task-workspace__sidebar" aria-label="Task workspace sidebar">
        <div>
          <p className="task-workspace__eyebrow">Conversations</p>
          <h2>Workspace sessions</h2>
        </div>
        <button type="button" disabled>
          New conversation
        </button>
        <section className="task-workspace__history" aria-labelledby="recent-work-title">
          <h3 id="recent-work-title">Recent work</h3>
          <p>No conversations yet.</p>
          <span>New sessions will appear here in a later task.</span>
        </section>
      </aside>

      <div className="task-workspace__main">
        <header className="task-workspace__header">
          <div>
            <p className="task-workspace__eyebrow">Demo workspace</p>
            <h2 id="task-workspace-title">Task &amp; Orchestration</h2>
            <p>Bring a request to your virtual team and keep the work in one conversation.</p>
          </div>
          <span className="task-workspace__label">PA5 workspace</span>
        </header>

        <section
          className="task-workspace__conversation"
          aria-label="Main conversation region"
        >
          {isLoading ? (
            <div className="task-workspace__loading" role="status" aria-live="polite">
              <span className="task-workspace__spinner" aria-hidden="true" />
              <div>
                <h3>Preparing your workspace</h3>
                <p>Loading local conversation controls and suggestions.</p>
              </div>
            </div>
          ) : (
            <div className="task-workspace__empty">
              <span className="task-workspace__empty-mark" aria-hidden="true">✦</span>
              <p className="task-workspace__eyebrow">Start a conversation</p>
              <h3>What should your virtual team work on?</h3>
              <p>Describe an outcome, choose a suggestion, or prepare your own request.</p>
              <ul className="task-workspace__suggestions" aria-label="Suggested prompts">
                {suggestedPrompts.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => setPrompt(suggestion)}
                      disabled={isLoading}
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="task-composer" aria-label="Task composer area">
          <div className="task-composer__routing">
            <label htmlFor="task-routing-preview">Routing</label>
            <select id="task-routing-preview" disabled>
              <option>Routing setup coming soon</option>
            </select>
          </div>
          <TaskComposer
            prompt={prompt}
            isDisabled={isLoading}
            onPromptChange={setPrompt}
            onSubmit={handleAcceptedSubmission}
          />
        </section>
      </div>
    </section>
  );
}
