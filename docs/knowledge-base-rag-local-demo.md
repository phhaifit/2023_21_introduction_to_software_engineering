# Knowledge Base / RAG Local Demo

## Purpose and scope

This guide describes the Knowledge Base / RAG behavior that can be run and
verified locally in the current TypeScript/Node NPM Workspaces repository. It
provides a repeatable foundation for later Agent Management and Agent
Orchestration integration without adding either integration here.

The implementation covers file upload/storage, TXT/DOCX/text-PDF extraction,
ingestion and indexing boundaries, pgvector retrieval, grounded answer
generation, access control, and the API-backed Processing Status screen.

It does not provide a one-click deployment, a continuously running ingestion
worker, external connectors/OAuth, a public grant-management API, a chatbot, or
Agent/Orchestration integration.

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
| `KNOWLEDGE_EMBEDDING_PROVIDER` | Live embedding/retrieval | Currently `openai-compatible`. |
| `KNOWLEDGE_EMBEDDING_BASE_URL` | Live embedding/retrieval | Provider base URL. |
| `KNOWLEDGE_EMBEDDING_API_KEY` | Live embedding/retrieval | Never commit this local secret. |
| `KNOWLEDGE_EMBEDDING_MODEL` | Live embedding/retrieval | Provider model name. |
| `KNOWLEDGE_EMBEDDING_DIMENSIONS` | Live embedding/pgvector | Must match provider output. |
| `KNOWLEDGE_VECTOR_PROVIDER` | Live vector operations | Currently `pgvector`. |
| `KNOWLEDGE_VECTOR_DIMENSIONS` | Live vector operations | Must match embedding dimensions. |
| `KNOWLEDGE_VECTOR_DISTANCE` | Live retrieval | See `.env.example`. |
| `KNOWLEDGE_RAG_PROVIDER` | Live answers | Currently `openai-compatible`. |
| `KNOWLEDGE_RAG_BASE_URL` | Live answers | Provider base URL. |
| `KNOWLEDGE_RAG_API_KEY` | Live answers | Never commit this local secret. |
| `KNOWLEDGE_RAG_MODEL` | Live answers | Provider model name. |

Optional batch-size, timeout, and output-limit variables have safe defaults in
`.env.example`. There is no environment switch that turns the development
server into deterministic mode. Tests inject deterministic adapters, require no
API keys, and make no provider calls.

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

## Sample document

Use [the fictional company policy](demo/kb-rag/sample-company-policy.txt) for
TXT upload. Useful questions include:

- How many business days does equipment approval take?
- Who reviews reimbursement requests?
- What should employees do if a request is rejected?

## Manual demo flow

The browser supports upload and status inspection, but the current flow is not
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
no worker daemon, polling loop, public process-next endpoint, or simple manual
indexing command. For a reliable demo today, use the deterministic production
test for the complete upload-to-answer proof and the browser for upload,
document listing, and queued Processing Status.

## Troubleshooting

- **Backend reports a missing `.env`:** copy `.env.example` to `.env`.
- **Ports are busy:** run `lsof -nP -iTCP:3001 -sTCP:LISTEN` and the equivalent
  command for port `5173`.
- **Upload stays queued:** expected until a caller invokes the module-local
  worker runtime; the development server does not poll jobs.
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
- The ingestion runtime extracts and chunks but does not compose the separate
  embedding/vector indexing pipeline.
- Google Drive, Notion, and Confluence remain placeholders; OAuth and
  credential storage are not implemented.
- Live retrieval needs PostgreSQL/pgvector and a real embedding provider.
- Live answers need a real answer provider.
- Agent grants are document-level and have no new public administration API.
- Processing Status refresh is manual.
- Image-only PDFs require future OCR.
- There is no chatbot UI or FastAPI implementation.

## Next integration tasks

Later, separately reviewed changes can add:

1. a safe worker entrypoint/queue integration and indexing composition;
2. a public knowledge-grant administration boundary;
3. Agent Management consumption of explicit grants and safe evidence;
4. Agent Orchestration retrieval/answer consumption through public contracts;
5. live provider/database smoke tests and browser acceptance coverage.
