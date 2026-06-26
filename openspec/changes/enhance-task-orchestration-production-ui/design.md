# Design: Enhance Task & Orchestration Production UI

## 1. Context and Objectives

The core Task & Orchestration prototype established a robust in-memory lifecycle engine (Pending, In-Progress, Completed, Failed, Canceled) and simulated orchestration mechanics (Tasks 1–13). This design details the production user interface enhancement required to transform the prototype into a premium, accessible, and modern conversation workspace.

The design strictly preserves the existing domain model, state machine, and in-memory architecture. It introduces no backend persistence and avoids copying proprietary branding from commercial products.

## 2. Design Goals

1. Establish a cohesive visual design system (typography, spacing, color, elevation).
2. Refine the conversation workspace shell, session navigation, and information architecture for superior ergonomics.
3. Polish the composer, routing selector, execution feed, and processing inspector.
4. Provide in-memory conversation/history navigation, search, and status filtering.
5. Implement flawless responsive design, empty states, and accessibility primitives.
6. Maintain strict separation between UI `Loading` states and canonical `Pending` lifecycle states.
7. Ensure all implementation pull requests remain focused and generally within 500 added lines of code.

## 3. Visual System Foundation

### Typography and Hierarchy
* Establish clear font scales for workspace headers, task prompts, status labels, and technical logs.
* Ensure optimal line height and contrast ratios for readability.

### Spacing and Layout Tokens
* Utilize a standardized grid and spacing system (e.g., 4px/8px/16px/24px increments).
* Define consistent padding and margin tokens across all workspace components.

### Color Palette and Elevation
* Use semantic color tokens for task statuses (Pending, In-Progress, Completed, Failed, Canceled).
* Establish subtle background surfaces, border colors, and elevation shadows to separate the sidebar, main feed, composer, and modal inspector.
* Strictly avoid proprietary branding or third-party color schemes.

## 4. Component Architecture

The enhancement refines the existing component tree in `apps/frontend/src/features/task-orchestration/components`:

```text
TaskOrchestrationPage (Workspace Shell)
├── Sidebar
│   ├── Workspace Introduction / Navigation Header
│   └── ConversationHistoryNavigation (In-memory)
│       ├── NewChatButton
│       ├── SearchInput
│       ├── StatusFilterBar
│       └── ConversationList
├── MainContentArea
│   ├── WorkspaceTopBar
│   ├── ExecutionFeed (Multi-turn Task Cards / Timeline / Logs)
│   │   ├── TaskStatusBadge
│   │   ├── TaskTimeline
│   │   ├── StreamingResult
│   │   └── CompletedResultView
│   └── ComposerArea
│       ├── TaskComposer
│       └── RoutingSelector
└── Modals / Dialogs
    ├── ProcessingDetailModal (Inspector)
    └── CancelConfirmationDialog
```

## 5. Key Architectural Rules

### 5.1 Authoritative Task Collection
* Continue using the existing Task collection: `TaskCreationState.tasks`.
* Do not create another Task store.

### 5.2 Conversation Session View Model
A conversation session may contain:
```ts
type TaskConversationSession = {
  conversationId: string;
  title: string;
  taskIds: readonly string[];
  createdAt: string;
  updatedAt: string;
};
```
* Conversation records must not copy prompt, partial output, final result, errors, logs, timeline, or routing metadata.

### 5.3 Active Selection
* Define `activeConversationId`.
* Define active Task derived from the latest Task in the selected conversation, or a consistently maintained `activeTaskId`.
* Changing active conversation is a presentation action only. It must not restart a Task, cancel a Task, stop a Task, or change lifecycle status.

### 5.4 Per-Task Runtime Ownership
Current single refs and active-Task effects are not sufficient for inactive background Tasks.
* Processing handles are keyed by Task ID.
* Streaming handles are keyed by Task ID.
* Completion handles are keyed by Task ID.
* Callbacks update records by Task ID.
* Switching conversations does not cleanup another Task’s runtime.
* Terminal Tasks clean up their own handles.
* Reset/unmount cleans all remaining handles.
* No new backend service is prescribed.

### 5.5 New Chat versus Demo Reset
* **New Chat:** Creates a new empty conversation, retains existing conversations and Tasks, and does not stop running Tasks.
* **Demo Reset:** Follows the existing reset contract, clears conversation references consistently, and leaves no orphan IDs or handles.

### 5.6 Task Boundaries
* **Task 2 owns:** Minimal conversation navigation, New Chat, active conversation, switching, multi-turn rendering, background Task continuity, and workspace shell.
* **Task 5 owns:** Search, status filters, prompt/Task ID/Work ID discovery, advanced history browsing, and optional sorting defined by the roadmap.
* **Task 6 owns:** Final responsive, loading, empty, no-result, and accessibility polish.

### 5.7 Strict Separation of Loading vs. Pending
* **UI Loading State:** Represents an asynchronous view state (e.g., initial module loading or component mounting). Displayed via dedicated loading spinners or skeleton screens with appropriate ARIA labels (`aria-busy="true"`).
* **Canonical Pending State:** Represents an established `Task` record that has been successfully submitted and validated, but has not yet begun simulated orchestration. Displayed via the canonical `Pending` status badge and initial timeline steps.
* UI Loading must never be labeled or treated as `Pending`.

### 5.8 Preservation of Lifecycle Semantics
* All UI enhancements are presentation-only.
* Components must not directly mutate `task.status`, bypass state machine helpers (`canTransition`, `isTerminalStatus`), or modify the core logic established in Tasks 1–13.

## 6. Accessibility (a11y) Design

* **Keyboard Navigation:** All interactive elements (filters, search, composer buttons, task cards, modal triggers) must be fully navigable via `Tab` and `Shift+Tab`.
* **Focus Management:** Modals and dialogs must trap focus when open and restore focus to the triggering element when closed.
* **ARIA Attributes:** Use explicit ARIA roles and labels (e.g., `role="status"`, `aria-live="polite"`, `aria-expanded`, `aria-controls`).
* **Color Independence:** Status badges must always include explicit text labels (e.g., "Failed", "In-Progress") and never rely on color alone to convey meaning.

## 7. Code Size and Review Unit Decomposition

Every task must be implemented in a dedicated pull request. To adhere to the review guideline of keeping added code within 500 lines per PR:
* Developers must estimate added lines prior to implementation.
* If a task (e.g., Task Workspace Shell or Execution Feed) risks exceeding 500 added lines, it must be decomposed into multiple focused review units (e.g., separating layout CSS/styles into one PR, and component markup into another).
* Automated tests must accompany each implementation unit.

## 8. Verification Strategy

Every pull request must execute the following commands to verify correctness and ensure zero regression:

```powershell
npm test
npm run build
npx openspec validate "enhance-task-orchestration-production-ui" --strict
npx openspec validate --all --strict
git diff --check
```

Any known repository-wide validation failures (e.g., `spec/client-side-routing`) must be reported transparently and left unmodified if outside the active change scope.
