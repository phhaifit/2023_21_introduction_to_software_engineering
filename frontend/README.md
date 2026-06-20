# Frontend

Frontend code mirrors backend capability boundaries under `src/features/<capability>`.

Rules:

- Keep pages/components/hooks for a capability inside its feature folder.
- Share only generic UI primitives and shared contracts; avoid cross-feature imports.
- Feature folders own their page/component code and can import shared contracts.

## Local App Shell

Run the React + Vite app shell:

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173/`.

The Agent Management app shell uses mock data and does not require backend API,
database, or OpenClaw services.

Manual test checklist:

- `docs/agent-management-app-shell-manual-test.md`
