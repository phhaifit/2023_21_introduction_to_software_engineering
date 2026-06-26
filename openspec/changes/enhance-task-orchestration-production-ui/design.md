## Context

The core Task & Orchestration prototype established a robust in-memory lifecycle engine (Pending, In-Progress, Completed, Failed, Canceled) and simulated orchestration mechanics (Tasks 1–13 of `implement-task-orchestration`). This design details the production user interface enhancement required to transform the prototype into a premium, accessible, and modern conversation workspace. The design strictly preserves the existing domain model, state machine, and in-memory architecture. It operates entirely on in-memory data, introduces no backend persistence, and avoids copying proprietary branding from commercial products.

## Goals / Non-Goals

**Goals:**
- Establish a cohesive visual design system (typography scales, standardized spacing, semantic color tokens, elevation layers).
- Refine the conversation workspace shell, session navigation, and information architecture for superior ergonomics.
- Polish the composer, routing selector, execution feed, and processing inspector (details modal).
- Provide in-memory conversation/history navigation, search (by prompt, Task ID, Work ID), and status filtering.
- Implement flawless responsive design, empty states, and accessibility primitives (keyboard navigation, focus trapping, ARIA live regions).
- Maintain strict separation between UI `Loading` states and canonical `Pending` lifecycle states.
- Ensure all implementation pull requests remain focused and generally within 500 added lines of code.

**Non-Goals:**
- Modifying core task lifecycle semantics or state machine guards (Tasks 1–13 remain canonical).
- Adding real backend database persistence or cross-session storage.
- Integrating with external AI APIs, real agent microservices, or external streaming servers.
- Copying or importing proprietary branding, icons, or visual assets from commercial products.
- Altering shared public contracts or Prisma schema.

## Decisions

### Decision 1: Centralized Visual System Foundation
- **Rationale**: Establish semantic color tokens for task statuses, font scales for clear hierarchy, and standardized spacing (4px/8px/16px/24px increments) to ensure visual consistency across the workspace without relying on proprietary third-party branding.
- **Alternatives Considered**: Ad-hoc utility classes in individual components. Rejected because it leads to visual inconsistency and higher maintenance overhead.

### Decision 2: In-Memory Conversation Sessions View Model
- **Rationale**: Maintain real chat conversations through `TaskConversationSession` view models (`conversationId`, `title`, `taskIds`, `createdAt`, `updatedAt`) referencing the authoritative Task collection (`TaskCreationState.tasks`) without duplicating prompt, output, error, timeline, or log metadata.
- **Alternatives Considered**: Creating a separate Task store for conversations. Rejected because it duplicates authoritative state and causes synchronization discrepancies.

### Decision 3: Per-Task Runtime Ownership & Isolation
- **Rationale**: Key processing, streaming, and completion handles by Task ID rather than relying on a single active-Task ref. Callbacks update records strictly by Task ID, allowing inactive running Tasks in background conversations to progress and reach terminal states independently without state leakage.
- **Alternatives Considered**: Coupling runtime effects solely to `activeTaskId`. Rejected because switching conversations would prematurely halt background processing.

### Decision 4: New Chat vs. Demo Reset Differentiation
- **Rationale**: `New Chat` creates a new empty conversation while retaining existing conversations/Tasks and active background runs. `Demo Reset` clears all conversation references and active handles consistently, leaving no orphan IDs.
- **Alternatives Considered**: Conflating New Chat with Demo Reset. Rejected because users need to start new conversations without losing existing session history.

### Decision 5: Strict Separation of UI Loading vs. Canonical Pending
- **Rationale**: `UI Loading` represents an asynchronous view initialization state using dedicated spinners or skeletons with `aria-busy="true"`. `Canonical Pending` represents an established `Task` record awaiting simulated orchestration, displayed via the canonical `Pending` status badge and initial timeline steps.
- **Alternatives Considered**: Using a generic loading spinner for pending tasks. Rejected because it conflates view rendering latencies with authoritative domain lifecycle states.

### Component Architecture & Data Flow
```text
TaskOrchestrationPage (Workspace Shell)
├── Sidebar
│   ├── Workspace Introduction / Navigation Header
│   └── ConversationHistoryNavigation (In-memory)
│       ├── NewChatButton
│       ├── SearchInput
│       ├── StatusFilterBar
│       └── ConversationList (Filters by Pending/In-Progress/Completed/Failed/Canceled)
├── MainContentArea
│   ├── WorkspaceTopBar
│   ├── ExecutionFeed (Multi-turn Task Cards / Timeline / Logs)
│   │   ├── TaskStatusBadge (Explicit text label + semantic color)
│   │   ├── TaskTimeline
│   │   ├── StreamingResult (ARIA live region)
│   │   └── CompletedResultView
│   └── ComposerArea
│       ├── TaskComposer (Polished validation feedback)
│       └── RoutingSelector (Auto / Specific Agent / Predefined Workflow)
└── Modals / Dialogs
    ├── ProcessingDetailModal (Inspector with structured tabs/sections)
    └── CancelConfirmationDialog
```

### State Transitions & Error Handling
- **Lifecycle Preservation**: All UI enhancements operate as presentation-only. Components never directly mutate `task.status`, bypass state machine helpers (`canTransition`, `isTerminalStatus`), or alter core transition logic.
- **Validation Feedback**: Submitting empty or whitespace-only prompts triggers explicit, accessible validation error styling in the composer without creating a task record or assigning a lifecycle status.

### Testing Strategy
- **Component Tests**: Verify visual system tokens, workspace shell layout slots, composer validation styling, routing mode indicators, status badges with explicit text labels, and processing inspector tab rendering.
- **State & Isolation Tests**: Verify in-memory conversation session reducers, multi-turn append, conversation switching history restoration, per-Task background progression isolation, and New Chat vs Demo Reset behaviors.
- **Accessibility & Responsive Tests**: Verify keyboard navigation (`Tab`/`Shift+Tab`), modal focus trapping, ARIA attributes (`aria-busy`, `aria-live`, `role="status"`), and responsive layout adaptations across desktop, tablet, and mobile dimensions.

## Risks / Trade-offs

- **Risk: UI enhancements inadvertently alter core lifecycle semantics**
  - *Mitigation*: Rely entirely on the existing state machine guards (`isTerminalStatus`, `canTransition`). Treat UI components as strictly presentation-only.
- **Risk: History UI implies persistent backend storage**
  - *Mitigation*: Provide explicit in-app copy and visual cues confirming that session history is stored in-memory for the active demonstration session only.
- **Risk: Confusion between UI Loading and canonical Pending states**
  - *Mitigation*: Ensure `Loading` is treated strictly as an asynchronous component/view state with distinct visual indicators (`aria-busy="true"`), while `Pending` remains an authoritative domain lifecycle status representing an accepted task awaiting execution.
- **Risk: Pull requests exceed the 500-line review recommendation**
  - *Mitigation*: Decompose large UI implementation tasks (e.g., separating layout CSS/styles into one PR, and component markup into another) to maintain clean, reviewable units accompanied by automated tests.
