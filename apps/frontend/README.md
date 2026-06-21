# Frontend

Frontend code mirrors backend capability boundaries under `src/features/<capability>`.

Rules:

- Keep pages/components/hooks for a capability inside its feature folder.
- Share only generic UI primitives and shared contracts; avoid cross-feature imports.
- Feature folders own their page/component code and can import shared contracts.

## Local App Shell

Run the React + Vite app shell through the root dev command so the local API is started with it:

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173/`.

The Vite app proxies `/api` to `http://127.0.0.1:3001`. Running only the frontend workspace is useful for UI error-state checks, but the normal manual flow should use the root `npm run dev` command.

Manual test checklist:

- `docs/agent-management-app-shell-manual-test.md`
