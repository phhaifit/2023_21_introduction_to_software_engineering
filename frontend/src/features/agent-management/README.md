# Agent Management Feature

Owner: Member 5

Frontend scope:

- Agent list.
- Agent create/edit forms.
- Agent enable/disable/delete controls.
- Skill/instruction editing surface.

Implementation:

- `agent-management-view.ts` provides a framework-agnostic view model and HTML renderer for the feature screen.
- `agent-management-view.css` defines the responsive list, form, status, and action control presentation.
- `agent-management-page.tsx` mounts the Agent Management page inside the React app shell.
- `agent-management-mock-data.ts` provides enabled and disabled mock agents for browser preview.
- Deleted agents should not appear in the active list returned by the backend lifecycle use case.
- Disabled agents remain visible but are marked unavailable for new work and expose an enable action.

Manual browser verification:

- `npm run dev`
- Open the Vite URL and follow `docs/agent-management-app-shell-manual-test.md`.
