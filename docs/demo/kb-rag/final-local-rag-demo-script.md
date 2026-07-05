# Final Local KB/RAG Demo Script

## Demo Purpose

This script proves the local/demo KB/RAG path:

```text
Upload document
-> local inline upload-to-index processes the document
-> chunks and vectors are persisted through module boundaries
-> document is assigned to an agent
-> Tasks chat Agent mode answers with citations
-> assignment is revoked
-> the same question returns insufficient_evidence
```

This is a local demo script. It is not a production queue, worker daemon,
OpenClaw tool-runtime registration, benchmark, or external connector flow.

## Prerequisites

- Node.js and npm installed.
- Dependencies installed from the repository root:

  ```bash
  npm install
  ```

- PostgreSQL available for the live local upload/index/retrieval path.
- Prisma schema validated and migrations applied:

  ```bash
  npm run prisma -- validate
  npm run prisma -- migrate deploy
  ```

- PostgreSQL has the `vector` extension available. The migration attempts
  `CREATE EXTENSION IF NOT EXISTS vector`.
- A local embedding provider compatible with the configured embedding adapter.
  Deterministic automated tests do not need this provider.

## Environment

Copy the example file first:

```bash
cp .env.example .env
```

Required for the live browser demo:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/virtual_company_dev
KNOWLEDGE_INGESTION_MODE=inline

KNOWLEDGE_EMBEDDING_PROVIDER=openrouter
KNOWLEDGE_EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
KNOWLEDGE_EMBEDDING_MODEL=openai/text-embedding-3-small
KNOWLEDGE_EMBEDDING_DIMENSIONS=1536
KNOWLEDGE_EMBEDDING_BATCH_SIZE=32
KNOWLEDGE_EMBEDDING_TIMEOUT_MS=30000
OPENROUTER_API_KEY=

KNOWLEDGE_VECTOR_PROVIDER=pgvector
KNOWLEDGE_VECTOR_DIMENSIONS=1536
KNOWLEDGE_VECTOR_DISTANCE=cosine
```

Keep `KNOWLEDGE_VECTOR_DIMENSIONS=1536` for the real web demo. The
3-dimensional vector setting is only for the opt-in pgvector smoke test.

Optional for provider-backed RAG answer generation outside the deterministic
Task chat bridge:

```env
KNOWLEDGE_RAG_PROVIDER=openai-compatible
KNOWLEDGE_RAG_BASE_URL=https://example-llm-provider.local/v1
KNOWLEDGE_RAG_API_KEY=
KNOWLEDGE_RAG_MODEL=provider-model-name
```

Do not commit real API keys, provider credentials, local upload storage, or
database dumps. Keep `.env` local.

## Start Commands

Start backend and frontend together:

```bash
npm run dev
```

Default URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:3001`

If you want two terminals:

```bash
npm run dev:api
npm run dev:web
```

## Demo Sample Document

Use:

```text
docs/demo/kb-rag/sample-equipment-policy.txt
```

Content:

```text
Equipment Approval Policy

All equipment purchases over 500 USD require manager approval.
Emergency replacement requests must include the incident ticket ID.
Approved equipment requests should be recorded in the procurement tracker.
```

## UI Walkthrough

1. Open the frontend at `http://127.0.0.1:5173`.
2. Open **Knowledge Base / RAG Management**.
3. Open **Upload Documents**.
4. Upload `docs/demo/kb-rag/sample-equipment-policy.txt`.
5. Open **Processing Status**.
6. Select **Refresh status**.
7. Confirm the new document/job is completed/ready. In inline mode, upload
   waits for stored-file extraction, chunk persistence, embedding, vector
   upsert, and final document/job state before returning.
8. Open **Agents**.
9. Select an enabled agent, or create one if needed.
10. In **Assigned Knowledge**, assign the uploaded equipment policy document.
11. Open **Tasks**.
12. Select **Agent** mode.
13. Select the same agent.
14. Ask:

    ```text
    What approval is required for equipment purchases over 500 USD?
    ```

15. Verify the assistant answers that equipment purchases over 500 USD require
    manager approval.
16. Verify the assistant response includes at least one citation pointing to
    the uploaded equipment policy document.
17. Return to the agent's **Assigned Knowledge** panel.
18. Revoke/remove the equipment policy document assignment.
19. Ask the same question again in Tasks Agent mode.
20. Verify the assistant returns `insufficient_evidence` or the safe fallback
    stating it does not have enough assigned knowledge to answer.

## Expected Result

Before revoke:

- Response status is answered.
- Answer mentions manager approval for equipment purchases over 500 USD.
- At least one citation is shown.
- Citation title/source metadata points to the uploaded equipment policy file.
- No private storage keys, vector refs, raw provider payloads, prompts, stack
  traces, or runtime internals are visible.

After revoke:

- Response status is `insufficient_evidence`, or the UI shows the equivalent
  safe fallback message.
- No citations are shown.
- The previous indexed document is not used without an active agent assignment.

## Readiness Checklist

- [ ] `.env` exists and contains local-only values.
- [ ] `DATABASE_URL` points to local PostgreSQL.
- [ ] Prisma validation passes.
- [ ] Migrations have been applied.
- [ ] `KNOWLEDGE_INGESTION_MODE=inline` is set.
- [ ] Embedding provider config is present for the live upload/index path.
- [ ] `KNOWLEDGE_VECTOR_PROVIDER=pgvector` is set.
- [ ] Vector dimensions match the embedding provider.
- [ ] Backend starts.
- [ ] Frontend starts.
- [ ] Upload succeeds for `sample-equipment-policy.txt`.
- [ ] Processing Status shows completed/ready after refresh.
- [ ] Document appears in agent **Assigned Knowledge**.
- [ ] Tasks chat Agent mode can select the assigned agent.
- [ ] First answer includes a citation.
- [ ] Revoked document causes the fallback on the same question.
- [ ] No private fields appear in the UI.

## Automated Evidence

Run focused deterministic evidence from the repository root:

```bash
git diff --check
node tests/contract/upload-to-task-chat-rag-integration.test.mjs
node tests/contract/knowledge-base-rag-local-upload-to-index.test.mjs
node tests/contract/task-chat-kb-rag-integration.test.mjs
node tests/contract/knowledge-base-rag-retrieval-search.test.mjs
```

These tests use deterministic fake adapters for embedding, vector indexing, and
composition. They do not call real embedding, pgvector, or RAG providers.

The main contract suite includes the upload-to-Task-chat evidence:

```bash
npm run test:contracts
```

The real local pgvector smoke path is opt-in:

```bash
npm run smoke:kb-rag:pgvector
```

Without `KNOWLEDGE_PGVECTOR_SMOKE=1`, expected output is:

```text
KNOWLEDGE_PGVECTOR_SMOKE not set — skipping KB/RAG pgvector smoke test
```

To enable the smoke test, configure local PostgreSQL/pgvector and the smoke
dimensions from `.env.example`.

## Troubleshooting

- **Backend fails with inline ingestion enabled:** verify `DATABASE_URL` is set
  and PostgreSQL is reachable. Inline mode requires PostgreSQL.
- **Document remains pending:** confirm `KNOWLEDGE_INGESTION_MODE=inline` is set
  in `.env`, then restart the backend. Refresh **Processing Status** manually.
- **Document failed processing:** use a supported text file first. Image-only
  PDFs and OCR hardening are outside this demo.
- **No citations in Task chat:** confirm the document is ready/completed,
  assigned to the selected agent, and the selected Tasks mode is **Agent**.
- **The wrong agent answers:** select the same agent that received the document
  assignment.
- **Fallback appears before revoke:** verify the question is answerable from
  `sample-equipment-policy.txt` and that the grant is active.
- **Fallback does not appear after revoke:** refresh or re-open the assignment
  panel and confirm the document is removed from **Assigned Knowledge**.
- **pgvector smoke skips:** set `KNOWLEDGE_PGVECTOR_SMOKE=1` only when you want
  to run the opt-in local smoke test.
- **Vector dimension mismatch:** keep `KNOWLEDGE_VECTOR_DIMENSIONS` aligned with
  `KNOWLEDGE_EMBEDDING_DIMENSIONS` for live runs. The smoke test uses
  deterministic 3-dimensional vectors.
- **Provider key missing:** deterministic tests still pass; live indexing needs
  the embedding provider values in `.env`.
- **OpenSpec validation unavailable:** install the project-approved OpenSpec
  CLI. In this environment, `npm run validate:openspec` may report
  `sh: 1: openspec: not found`.
- **Vite bundle-size warning:** this is a build warning, not a KB/RAG demo
  blocker.

## Limitations

- The Task chat KB/RAG path is a local-demo bridge owned by KB/RAG and Task
  Orchestration.
- `knowledge.retrieve` is not registered into the production OpenClaw/tool
  runtime.
- There is no production queue, scheduler, Redis/RabbitMQ worker daemon, or
  public process-next endpoint in this demo.
- External connectors, OAuth, and source-level grants are not implemented.
- OCR/image-only PDF hardening is outside this slice.
- Real pgvector verification is opt-in and not required in CI.
- Deterministic automated tests do not call real embedding or RAG providers.
