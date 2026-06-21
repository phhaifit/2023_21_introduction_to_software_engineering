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
- `agent-management-api-client.ts` owns typed workspace API calls and response-envelope errors.
- `agent-management-mock-data.ts` provides enabled and disabled fixtures for isolated tests only.
- Browser data comes from the local Agent Management API through the Vite `/api` proxy.
- Deleted agents should not appear in the active list returned by the backend lifecycle use case.
- Disabled agents remain visible but are marked unavailable for new work and expose an enable action.

Manual browser verification:

- `npm run dev`
- Open the Vite URL and follow `docs/agent-management-app-shell-manual-test.md`.
- The API runs on port `3001`; the Vite URL is usually port `5173`.
- Without `DATABASE_URL`, restarting the API resets the in-memory seed data.
- With `DATABASE_URL`, the list reflects persisted records in PostgreSQL.
