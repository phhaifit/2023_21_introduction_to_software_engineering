# Knowledge Base / RAG Feature

Owner: Member 9

This folder owns the React frontend implementation for Knowledge Base / RAG
Management. The feature manages workspace knowledge sources before they are
used by RAG or AI agents. It is not the final chatbot or answer-generation UI.

Current status:

- Context and implementation guidance only.
- No feature UI, API client, route, or mock data has been added yet.
- Issue #36 starts with base layout and local navigation only.

Frontend scope:

- Document upload.
- Document list viewing.
- Selected file validation.
- Document deletion.
- Data sync setup.
- Index status.
- Agent knowledge permission controls.

Issue #36 scope:

- Main layout container.
- Header/title area.
- Local navigation between placeholder views.
- Nav items: Documents, Upload Documents, Data Sources, Synchronization Scope,
  Processing Status.
- Active navigation state and placeholder content.
- No real API calls, upload handling, validation, sync logic, or processing
  tables.

Likely future files:

- `knowledge-base-rag-page.tsx`
- `knowledge-base-rag-view.css`
- `knowledge-base-rag-mock-data.ts`
- `knowledge-base-rag-view.ts`

Implementation rules:

- Keep code inside this feature folder unless explicitly requested.
- Do not modify Agent Management or other feature folders.
- Do not add React Router for this feature unless a later app-shell issue
  explicitly requires route-based navigation.
- Follow the existing frontend style: React components, feature-prefixed CSS
  classes, small files, and mock data only for isolated prototype flows.
