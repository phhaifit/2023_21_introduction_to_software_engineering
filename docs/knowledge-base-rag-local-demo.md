# Knowledge Base / RAG Local Demo

## Purpose and scope

This guide describes the Knowledge Base / RAG behavior that can be run and
verified locally in the current TypeScript/Node NPM Workspaces repository. For
the final presentation walkthrough, use
[`docs/demo/kb-rag/final-local-rag-demo-script.md`](demo/kb-rag/final-local-rag-demo-script.md).

The implementation covers file upload/storage, TXT/DOCX/text-PDF extraction,
ingestion and indexing boundaries, pgvector retrieval, grounded answer
generation, access control, and the API-backed Processing Status screen.

Google Drive is the only external data source and supports backend OAuth plus
manual synchronization. The implementation does not provide a one-click
deployment, a durable production queue, scheduled synchronization, Google
Picker, other connectors, source-level grants, a standalone Agent Knowledge
Ask UI, OCR, legacy DOC extraction, or production OpenClaw/tool registration.

## Prerequisites

- Node.js 22 and npm 10 (the versions used by current test evidence)
- PostgreSQL with the `vector` extension for a persistent live demo
- An OpenAI-compatible embedding endpoint for live indexing/retrieval
- An OpenAI-compatible answer endpoint for live RAG answer generation

PostgreSQL, external providers, and credentials are not required for
deterministic automated verification.

## Environment setup

```bash
cp .env.example .env
```

The backend loads the repository-root `.env`. Review these KB/RAG values:

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Persistent API data and pgvector | Use local PostgreSQL. |
| `KNOWLEDGE_FILE_STORAGE_DIR` | Optional upload location | Defaults to `.data/knowledge-base-rag/uploads`; keep it private. |
| `KNOWLEDGE_INGESTION_MODE` | Optional local upload processing | Set to `inline` to parse, chunk, embed, and index before upload returns. Requires PostgreSQL and provider/vector config. |
| `KNOWLEDGE_EMBEDDING_PROVIDER` | Live embedding/retrieval | Use `openrouter` for the local web demo. |
| `KNOWLEDGE_EMBEDDING_BASE_URL` | Live embedding/retrieval | For OpenRouter use `https://openrouter.ai/api/v1`; this is also the default for provider `openrouter`. |
| `KNOWLEDGE_EMBEDDING_MODEL` | Live embedding/retrieval | For OpenRouter use `openai/text-embedding-3-small`; this is also the default for provider `openrouter`. |
| `KNOWLEDGE_EMBEDDING_DIMENSIONS` | Live embedding/pgvector | Use `1536` for `openai/text-embedding-3-small`. |
| `OPENROUTER_API_KEY` | OpenRouter embedding and prompt assistant | Never commit this local secret. |
| `KNOWLEDGE_VECTOR_PROVIDER` | Live vector operations | Currently `pgvector`. |
| `KNOWLEDGE_VECTOR_DIMENSIONS` | Live vector operations | Use `1536` for the OpenRouter web demo. Do not use `3` here. |
| `KNOWLEDGE_VECTOR_DISTANCE` | Live retrieval | See `.env.example`. |
| `KNOWLEDGE_PGVECTOR_SMOKE` | Local pgvector smoke test | Set to `1` only when explicitly running the opt-in smoke test. |
| `GOOGLE_DRIVE_CLIENT_ID` | Real Google Drive OAuth | Backend-only OAuth client ID. |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Real Google Drive OAuth | Backend-only secret; never expose or commit it. |
| `GOOGLE_DRIVE_REDIRECT_URI` | Real Google Drive OAuth | Must target the workspace-scoped OAuth callback route. |
| `GOOGLE_DRIVE_CREDENTIAL_ENCRYPTION_KEY` | Encrypted local credential storage | Backend-only secret of at least 32 characters. |
| `KNOWLEDGE_RAG_PROVIDER` | Live answers | Currently `openai-compatible`. |
| `KNOWLEDGE_RAG_BASE_URL` | Live answers | Provider base URL. |
| `KNOWLEDGE_RAG_API_KEY` | Live answers | Never commit this local secret. |
| `KNOWLEDGE_RAG_MODEL` | Live answers | Provider model name. |

Optional batch-size, timeout, and output-limit variables have safe defaults in
`.env.example`. There is no environment switch that turns the development
server into deterministic mode. Tests inject deterministic adapters, require no
API keys, and make no provider calls.

## Google Drive data source

The Data Sources screen exposes Google Drive only. OAuth requests
`https://www.googleapis.com/auth/drive.file` plus `openid` and `email`.
Synchronization Scope accepts explicit folder IDs and file IDs, optional
recursive folder traversal, allowed MIME types, and a maximum file count.
Synchronization is manual.

Supported imports are TXT, Markdown, CSV, text-bearing PDF, DOCX, Google Docs
(exported as text), and Google Sheets (exported as CSV). Unsupported Google
Workspace types are skipped safely. Scanned PDFs may yield no text because OCR
is not implemented; they fail with a bounded user-facing parsing error.

The local server uses an encrypted file credential store and a process-local
asynchronous queue. That queue is non-durable and is not a production
scheduler. Automated tests use fake Google Drive fetch/provider adapters and
never call Google APIs. A real OAuth smoke test is opt-in and requires the four
backend-only variables above.

For local web demo uploads with OpenRouter embeddings:

```env
KNOWLEDGE_INGESTION_MODE="inline"
KNOWLEDGE_EMBEDDING_PROVIDER="openrouter"
KNOWLEDGE_EMBEDDING_BASE_URL="https://openrouter.ai/api/v1"
KNOWLEDGE_EMBEDDING_MODEL="openai/text-embedding-3-small"
KNOWLEDGE_EMBEDDING_DIMENSIONS=1536
OPENROUTER_API_KEY=

KNOWLEDGE_VECTOR_PROVIDER="pgvector"
KNOWLEDGE_VECTOR_DIMENSIONS=1536
KNOWLEDGE_VECTOR_DISTANCE="cosine"
```

Do not use `KNOWLEDGE_VECTOR_DIMENSIONS=3` for the real web demo. The
3-dimensional vector config is only for the opt-in pgvector smoke test.

## Install and database setup

From the repository root:

```bash
npm install
npm run prisma -- validate
npm run prisma -- generate
npm run prisma -- migrate deploy
```

The pgvector migration runs `CREATE EXTENSION IF NOT EXISTS vector`; the
database user must be allowed to enable it. `DATABASE_URL` may use
`?schema=public` for Prisma, but remove that query parameter for `psql`.

If Prisma is unavailable, the backend falls back to in-memory repositories.
That permits basic UI/API inspection, but state is lost on restart and live
pgvector retrieval is unavailable.

## Start and build

Start backend and frontend together:

```bash
npm run dev
```

Or start them separately:

```bash
npm run dev:api
npm run dev:web
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:3001`

Vite proxies `/api` to the backend. The local server uses development mock
authentication and defaults to the demo workspace; this is not production
authentication.

Build with:

```bash
npm run build
```

## Automated KB/RAG tests

Run contracts and contract type checking:

```bash
npm run test:contracts
npm run test:contracts:types
```

Run focused frontend component tests:

```bash
npx vitest run --config vitest.config.ts \
  tests/component/knowledge-base-rag-api-client.test.ts \
  tests/component/knowledge-base-rag-data-sources-api-integration.test.tsx \
  tests/component/knowledge-base-rag-documents-api-integration.test.tsx \
  tests/component/knowledge-base-rag-processing-status.test.tsx \
  tests/component/knowledge-base-rag-sync-scope-api-integration.test.tsx \
  tests/component/knowledge-base-rag-upload-api-integration.test.tsx
```

Run the deterministic production flow directly:

```bash
node tests/contract/knowledge-base-rag-production-e2e.test.mjs
```

It uses temporary storage, the production TXT extractor, and deterministic
in-memory embedding, vector, and answer adapters. It verifies upload,
extraction, chunking, indexing, retrieval, grounded citations, processing
lifecycle, workspace isolation, and agent-grant denial without a database,
Docker, network access, or provider credentials.

The narrower local composition test is:

```bash
node tests/contract/knowledge-base-rag-end-to-end-local-flow.test.mjs
```

Run all repository tests with `npm test`.

## Local pgvector smoke test

The normal contract tests use deterministic in-memory or mocked adapters so CI
does not need PostgreSQL or pgvector. To prove the real local pgvector path,
run the opt-in smoke test against a local PostgreSQL database after migrations:

```bash
npm run prisma -- migrate deploy

KNOWLEDGE_PGVECTOR_SMOKE=1 \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/virtual_company_dev" \
KNOWLEDGE_VECTOR_PROVIDER=pgvector \
KNOWLEDGE_VECTOR_DIMENSIONS=3 \
KNOWLEDGE_VECTOR_DISTANCE=cosine \
npm run smoke:kb-rag:pgvector
```

Expected success output:

```txt
knowledge-base-rag pgvector smoke checks passed
```

Without `KNOWLEDGE_PGVECTOR_SMOKE=1`, the same command exits successfully with:

```txt
KNOWLEDGE_PGVECTOR_SMOKE not set — skipping KB/RAG pgvector smoke test
```

The smoke test verifies this path:

```txt
PostgreSQL + pgvector
→ KB/RAG schema with vector column
→ chunk/vector persistence through PgvectorKnowledgeVectorIndexAdapter
→ pgvector-backed retrieval through KnowledgeRetrievalSearchUseCase
→ safe evidence returned from indexed chunks
```

It seeds records whose IDs start with `kb-rag-pgvector-smoke-`, uses
deterministic 3-dimensional vectors, verifies workspace isolation, asserts the
public evidence does not expose raw vectors or vector refs, and deletes its
records in cleanup. It does not call a real embedding provider or RAG provider.

Common failures:

- `knowledge.vector_schema_unavailable`: run migrations and confirm the
  database user can execute `CREATE EXTENSION IF NOT EXISTS vector`.
- `Knowledge vector database is unavailable`: check `DATABASE_URL`, PostgreSQL
  availability, and network access.
- `KB/RAG pgvector smoke test expects KNOWLEDGE_VECTOR_DIMENSIONS=3`: use the
  smoke-test dimensions above. Live provider demos can use a different
  dimension, but the deterministic smoke test uses `3`.

This smoke test is not a benchmark, load test, ANN/HNSW/IVFFlat tuning task,
production queue check, or production readiness claim.

## Sample document

Use [the fictional company policy](demo/kb-rag/sample-company-policy.txt) for
general TXT upload. Use
[the equipment policy sample](demo/kb-rag/sample-equipment-policy.txt) with
[the final local RAG demo script](demo/kb-rag/final-local-rag-demo-script.md)
for the upload-to-Task-chat walkthrough. Useful questions include:

- How many business days does equipment approval take?
- Who reviews reimbursement requests?
- What should employees do if a request is rejected?

## Manual demo flow

Without inline mode, the browser supports upload and status inspection, but the flow is not
one-click end to end:

1. Configure `.env`, apply migrations, then run `npm run dev`.
2. Open `http://127.0.0.1:5173` and navigate to Knowledge Base / RAG.
3. In **Upload Documents**, upload
   `docs/demo/kb-rag/sample-company-policy.txt`.
4. In **Documents**, confirm safe document metadata appears.
5. In **Processing Status**, select **Refresh status** and confirm the new job
   is queued.
6. Invoke `createKnowledgeIngestionWorkerRuntime(...).processNextQueuedJob`
   from an approved local integration harness if one is available.
7. Refresh Processing Status and confirm completed or safe failed state.
8. Run the separate `KnowledgeDocumentIndexingPipeline` integration boundary.
9. With embedding, pgvector, and RAG providers configured, call:

```bash
curl -sS -X POST \
  -H 'content-type: application/json' \
  --data '{"query":"How many business days does equipment approval take?","topK":5}' \
  http://127.0.0.1:3001/api/workspaces/workspace-product-demo/knowledge/retrieval/search

curl -sS -X POST \
  -H 'content-type: application/json' \
  --data '{"query":"Who reviews reimbursement requests?","topK":5}' \
  http://127.0.0.1:3001/api/workspaces/workspace-product-demo/knowledge/rag/answer
```

Use the workspace ID shown by the application if it differs. Confirm responses
contain only safe evidence and citation IDs, never storage paths, raw vectors,
provider payloads, or credentials.

Steps 6 and 8 are integration boundaries, not checked-in CLI commands. There is
no worker daemon, polling loop, or public process-next endpoint.

For a real local upload-to-index demo, configure `DATABASE_URL`, the embedding
settings, pgvector settings, and:

```bash
KNOWLEDGE_INGESTION_MODE=inline
```

Then a supported upload runs storage, extraction, chunk persistence, embedding,
vector upsert, and status updates before the upload response returns. Refresh
**Processing Status** to confirm the job is completed/ready. Failed parsing,
embedding, or vector indexing appears as failed with a safe error summary.

For deterministic verification without PostgreSQL or provider credentials:

```bash
node tests/contract/knowledge-base-rag-local-upload-to-index.test.mjs
```

## Agent document assignment

In the local app, open **Agents**, open an agent profile, and use **Assigned
Knowledge** to review active grants, assign an available KB/RAG document, or
remove an assigned document. The panel reads both document lists and active
assignments from the backend; it does not use runtime mock documents.

The same document-level flow is available through the API:

```bash
curl -sS -X POST \
  http://127.0.0.1:3001/api/workspaces/workspace-product-demo/knowledge/agents/agent-research/documents/document-policy

curl -sS \
  http://127.0.0.1:3001/api/workspaces/workspace-product-demo/knowledge/agents/agent-research/documents

curl -sS -X DELETE \
  http://127.0.0.1:3001/api/workspaces/workspace-product-demo/knowledge/agents/agent-research/documents/document-policy
```

Replace the example IDs with existing workspace-scoped agent and document IDs.
Assign/revoke require `knowledge:manage`; listing requires `workspace:read`.
Assignments are document-level only. Source/collection grants and production
OpenClaw tool registry wiring remain follow-ups. Assigned documents can ground
the local-demo agent ask route and Agent-mode Task chat path after the document
has been indexed.

## Internal agent retrieval tool

The backend module exposes `AgentKnowledgeRetrievalTool` under the internal tool
name `knowledge.retrieve`. Its JSON-friendly input contains `workspaceId`,
`agentId`, `query`, optional `topK`, and optional document/source filters. Its
output contains a safe status, warnings, and bounded citation-style evidence.

The tool delegates to the existing KB/RAG retrieval use case. Active
document-level grants constrain every request; optional filters can narrow but
cannot expand access. Revoked grants and skill/config references provide no
access. When the agent has no eligible documents, the tool returns `empty`
before embedding or vector adapters are called.

Run its deterministic local proof without provider credentials or PostgreSQL:

```bash
node tests/contract/agent-knowledge-retrieval-tool.test.mjs
```

The tool is also consumed by the local-demo agent orchestration route:

```bash
curl -sS -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"What is the equipment approval policy?","topK":5}' \
  http://127.0.0.1:3001/api/workspaces/workspace-product-demo/knowledge/agents/agent-research/ask
```

With active assigned evidence, the response is `answered` and includes bounded
citations. With no grant, after revoke, or when filters remove all granted
documents, it returns `insufficient_evidence`; no answer composer runs. The
local composition uses a deterministic evidence-only composer and does not
require a RAG/LLM provider.

This is not a chatbot UI or production OpenClaw tool registration. Skill/config
references still do not grant document access.

## Task chat demo

1. Start the backend/frontend with local inline ingestion enabled when using
   live uploads:

   ```bash
   KNOWLEDGE_INGESTION_MODE=inline
   ```

2. Upload a supported TXT document in **Knowledge**.
3. Refresh **Processing Status** and confirm the document/job is
   completed/ready.
4. Open **Agents** and assign the document to an enabled agent.
5. Open **Tasks**, choose **Agent**, and select that agent.
6. Ask a question covered by the assigned document.
7. Confirm the existing assistant turn shows the grounded answer and citations.
8. Revoke the document assignment in **Agents**.
9. Ask again and confirm the assistant returns the insufficient-evidence
   fallback without citations.

Task chat calls the Task backend bridge, which delegates to the KB/RAG
`AgentKnowledgeOrchestrationUseCase`; it does not query pgvector from the
browser. Deterministic tests use fake adapters/ports. A real local demo requires
the document to be indexed and the existing embedding/pgvector retrieval
configuration to be available.

The cross-feature automated evidence is deterministic and local:

```bash
node tests/contract/upload-to-task-chat-rag-integration.test.mjs
```

It uploads TXT content through the local upload-to-index flow, verifies persisted
chunks and vector-boundary upserts, assigns the indexed document to an agent,
asks through `POST /api/workspaces/:workspaceId/tasks/agent-knowledge/ask`, and
checks that the answer includes bounded citations. The same test revokes the
assignment, verifies `insufficient_evidence`, checks an unassigned agent, and
checks workspace isolation. It does not call real embedding/RAG providers.

## Troubleshooting

- **Backend reports a missing `.env`:** copy `.env.example` to `.env`.
- **Ports are busy:** run `lsof -nP -iTCP:3001 -sTCP:LISTEN` and the equivalent
  command for port `5173`.
- **Upload stays queued:** enable `KNOWLEDGE_INGESTION_MODE=inline` with the
  required database/provider/vector configuration, or invoke the module-local
  worker runtime explicitly. The development server does not poll jobs.
- **Status does not change automatically:** select **Refresh status**. Polling,
  SSE, and WebSocket updates are not implemented.
- **Retrieval adapter is unavailable:** configure both embedding and vector
  variables and use PostgreSQL.
- **RAG returns a provider fallback:** configure the RAG provider and ensure
  retrieval has indexed evidence.
- **Image-only PDF fails:** OCR is not implemented.
- **OpenSpec validation fails:** install the approved `openspec` CLI; it is not
  currently an npm dependency.

## Known limitations

- No worker daemon, scheduler, production queue, atomic multi-worker claim, or
  retry endpoint is included.
- Inline local mode composes ingestion and indexing, but the default queued
  mode still requires an external caller.
- Google Drive is implemented with backend OAuth and encrypted local credential
  storage. No other external connector is supported.
- Live retrieval needs PostgreSQL/pgvector and a real embedding provider.
- Live answers need a real answer provider.
- Agent grants and the current assignment UI are document-level only.
- The internal tool is invoked by the local-demo ask route and Agent-mode Task
  chat, but is not registered as a production OpenClaw tool.
- Processing Status refresh is manual.
- Image-only PDFs require future OCR.
- There is no chatbot UI or FastAPI implementation.

## Next integration tasks

Later, separately reviewed changes can add:

1. a safe worker entrypoint/queue integration and indexing composition;
2. production OpenClaw/Agent Orchestration registration of `knowledge.retrieve`;
3. optional provider-backed answer composition behind the safe evidence port;
4. an Ask UI and live provider/database browser acceptance coverage.
