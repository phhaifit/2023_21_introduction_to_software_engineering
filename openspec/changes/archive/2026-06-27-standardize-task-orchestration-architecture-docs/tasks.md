## 1. High-Level Architecture Documentation

- [x] 1.1 Update `docs/architecture.md` to formally enshrine the OpenAI-compatible HTTP API (`POST /v1/chat/completions`) and remove legacy custom DTO webhook definitions.

## 2. Verification

- [x] 2.1 Run full validation and test suite (`npm test`, `npm run build`, `openspec validate "standardize-task-orchestration-architecture-docs" --strict`, `openspec validate --all --strict`, `git diff --check`).
