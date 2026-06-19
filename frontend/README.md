# Frontend

Frontend code mirrors backend capability boundaries under `src/features/<capability>`.

Rules:

- Keep pages/components/hooks for a capability inside its feature folder.
- Share only generic UI primitives and shared contracts; avoid cross-feature imports.
- Feature folders start with README files until the team selects the final frontend framework.
