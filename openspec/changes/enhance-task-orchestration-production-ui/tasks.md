# Task & Orchestration — Production UI Enhancement Tasks

## 1. Production UI Foundation and Visual System

- [x] 1.1 Define centralized CSS tokens and design system utilities for typography scales, standardized spacing, semantic colors, and elevation layers maintaining a presentation-only scope.
- [x] 1.2 Establish consistent design foundation classes supporting all five canonical task statuses (Pending, In-Progress, Completed, Failed, Canceled) without proprietary branding, provider-specific logic, or runtime behavior changes.
- [x] 1.3 Implement focused styling and foundation rendering tests verifying semantic token consumption across all canonical statuses.

## 2. Conversation Workspace Shell and Session Navigation

- [x] 2.1 Implement in-memory conversation session model (`TaskConversationSession`), active conversation management (`activeConversationId`), and stable sidebar/header/feed/composer layouts.
- [x] 2.2 Implement multi-turn Task feed and presentation-only conversation switching without canceling, restarting, pausing, duplicating, or resetting Tasks.
- [x] 2.3 Implement per-Task background runtime isolation (runtimes keyed by immutable Task ID) allowing inactive tasks to progress and reach terminal states.
- [x] 2.4 Implement New Chat action creating a new empty conversation while preserving existing conversations/Tasks and ensuring empty conversations do not display stale Task data or open processing details/cancellation dialogs for prior Tasks.
- [x] 2.5 Implement strict visual separation ensuring UI loading states are distinct from canonical Pending states, and verify unmount/reset cleanup leaves no orphan runtimes.
- [x] 2.6 Implement reducer, multi-turn rendering, switching isolation, background completion/failure, New Chat preservation, cancellation dialog target verification, and Strict Mode tests.

## 3. Composer and Routing Experience

- [x] 3.1 Polish task composer input ergonomics, active/focus states, keyboard submit interactions, double-submit prevention, and explicit visual validation feedback for empty/whitespace prompts.
- [x] 3.2 Enhance routing mode selector (Auto, Specific Agent, Predefined Workflow) with clear mode descriptions, selector loading/unavailable states, and target required validation before submission.
- [x] 3.3 Implement routing mode switching behavior that clears incompatible target values and ensures the UI does not self-analyze prompts to select agents or self-execute Auto-routing.
- [x] 3.4 Implement provider-neutral task submission ensuring the request contains no provider credentials or direct OpenClaw calls, and preserves user input on recoverable submission failures.
- [x] 3.5 Implement composer interaction, routing selector validation, submitting state distinct from Pending presentation, and successful canonical Task creation transition tests.

## 4. Execution Feed and Processing Inspector

- [x] 4.1 Render normalized runtime updates while retaining deterministic mock updates as a legitimate test and development adapter across Pending, In-Progress, Completed, Failed, and Canceled states.
- [x] 4.2 Upgrade execution feed rendering ensuring partial output is clearly distinguished from finalized results, Completed tasks display finalized results, Failed tasks display errors without treating incomplete output as Completed, and Canceled tasks stop receiving updates.
- [x] 4.3 Enhance processing detail modal (inspector) scoped strictly by Task ID, displaying canonical steps and logs, separating technical details from main results, with Advanced Details closed by default and excluding raw credentials or sensitive provider payloads.
- [x] 4.4 Implement terminal-state protection ensuring delayed non-terminal events do not transition terminal Tasks back to active, and cross-Task isolation ensuring inactive conversations never receive data from active Tasks.
- [x] 4.5 Implement feed rendering, partial output separation, inspector task-scoping, missing optional observability graceful handling, and terminal protection tests.

## 5. Conversation History, Search and Status Filters

- [ ] 5.1 Implement conversation-oriented history navigation within the workspace sidebar area, ordering items by updated time or design rules, and supporting stable selections and clear search/filter actions.
- [ ] 5.2 Implement search input filtering in-memory conversations by conversation title, prompt text, Task ID, or Work ID matching without affecting runtime execution.
- [ ] 5.3 Implement status filter controls matching conversations when their latest Task has the selected canonical status, ensuring empty conversations do not match status filters.
- [ ] 5.4 Implement graceful selection handling when the active conversation is filtered out of the list, and display explicit visual notices confirming history data is session-scoped (in-memory).
- [ ] 5.5 Implement history filtering, search matching, empty conversation filtering rules, and presentation-only scoping tests.

## 6. Responsive, Empty, Loading and Accessibility

- [ ] 6.1 Polish responsive layout behaviors across desktop, tablet, and mobile viewport dimensions, pinned composers, scrollable feeds, long results, and dedicated empty states.
- [ ] 6.2 Implement distinct visual indicators for temporary UI states including loading, submitting, reconnecting (distinct from canonical Task status), and provider unavailable states (distinct from Failed Task).
- [ ] 6.3 Implement comprehensive accessibility polish including keyboard navigation (`Tab`/`Shift+Tab`), focus trapping in modals, keyboard-accessible dialogs and routing selectors, focus-visible styling, and accessible simulation indicators.
- [ ] 6.4 Implement accessible status labels ensuring status is not conveyed by color alone, reduced-motion compatibility, search no-result states, and verify empty conversations display no stale task actions.

## 7. Regression and Final Verification

- [ ] 7.1 Execute full presentation regression verification covering workspace shell, conversations, New Chat, composer, routing, lifecycle rendering, execution feed, processing details, history sidebar, search/filter, responsive layouts, and accessibility.
- [ ] 7.2 Execute provider-neutral regression verification ensuring UI renders from normalized Task state, mock execution remains fully functional as a test and development adapter, presentation does not import OpenClaw-specific types or depend on provider-specific events, and no silent fallback occurs.
- [ ] 7.3 Verify loading/reconnecting states do not distort canonical lifecycle, terminal Tasks never return to active, and multiple concurrent Tasks maintain perfect update isolation without requiring real OpenClaw integration tests.
