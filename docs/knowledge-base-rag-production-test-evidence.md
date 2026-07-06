# Knowledge Base / RAG Production Test Evidence

Issue: `#336`  
Parent issue: `#323`  
OpenSpec change: `implement-knowledge-base-rag`  
Evidence date: 2026-07-04

## 1. Scope

This document records final integration evidence for the TypeScript/Node
Knowledge Base / RAG pipeline:

1. real upload and local file-storage boundary;
2. TXT/DOCX/PDF text extraction;
3. ingestion lifecycle and chunk persistence;
4. embedding provider boundary;
5. PostgreSQL pgvector adapter boundary;
6. retrieval and evidence hydration;
7. grounded RAG answer generation;
8. workspace/user/agent access control; and
9. API-backed Processing Status UI.

The new production-flow contract test uses real temporary filesystem storage
and the production TXT extractor. Embedding, vector query, and answer-provider
dependencies are deterministic in-memory fakes, so the test requires no
credentials, external service, PostgreSQL server, or Docker.

## 2. Environment

| Item | Value |
| --- | --- |
| OS | Linux 6.6.87.2-microsoft-standard-WSL2 x86_64 |
| Node.js | v22.23.0 |
| npm | 10.9.8 |
| Baseline commit | `5826ba3` |
| Branch | `feature/kb-rag-production-e2e-test-evidence` |
| Database | No live PostgreSQL used by deterministic contract tests |
| External providers | No real embedding or LLM provider called |
| Browser | Manual browser flow not executed locally |

## 3. Automated Coverage Inventory

| Area | Primary evidence |
| --- | --- |
| Upload/storage | `knowledge-base-rag-application-use-cases.test.mjs`, `knowledge-base-rag-api-router.test.mjs`, upload component tests |
| Parser/extraction | `knowledge-base-rag-document-extraction.test.mjs` |
| Ingestion worker | `knowledge-base-rag-ingestion-worker-runtime.test.mjs`, worker handoff/pipeline tests |
| Embedding | `knowledge-base-rag-real-embedding-provider.test.mjs`, embedding/indexing adapter tests |
| Vector/pgvector | `knowledge-base-rag-pgvector-index.test.mjs` |
| Retrieval/search | `knowledge-base-rag-retrieval-search.test.mjs` |
| RAG answer | `knowledge-base-rag-rag-answer-generation.test.mjs` |
| Access control | `knowledge-base-rag-access-control.test.mjs` |
| Processing Status | `knowledge-base-rag-processing-status.test.tsx` |
| Public contracts/schema | KB/RAG contracts, backend boundary, DB schema, API router tests |
| Composed flow | local-flow test and `knowledge-base-rag-production-e2e.test.mjs` |

## 4. Functional and Integration Matrix

`Passed` means the cited automated test was executed successfully on the
environment above. `Not executed` is intentionally not presented as passing.

| ID | Area | Scenario | Type | Steps / command | Expected result | Actual result | Status | Evidence source | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KB-E2E-001 | Upload | Supported TXT upload | Automated | Run contract suite | Bytes stored; pending document/job DTOs returned | Accepted and persisted through storage port | Passed | application use cases; production E2E | Public DTO excludes storage key |
| KB-E2E-002 | Upload | Supported PDF/DOCX signatures | Automated | Run contract suite | Supported formats accepted | PDF and DOCX candidates accepted | Passed | application use cases | Parsing covered separately |
| KB-E2E-003 | Upload | Unsupported type | Automated | Run contract suite | Safe validation rejection | Unsupported media rejected | Passed | application use cases; API router | No storage side effect |
| KB-E2E-004 | Upload | Oversized file | Automated | Run contract suite | Safe validation rejection | Oversized input rejected | Passed | application use cases; API router | Configured limit enforced |
| KB-E2E-005 | Upload | Missing file | Automated | Run contract suite | Safe validation rejection | Empty upload rejected | Passed | application use cases; API router | Multipart missing-file behavior covered |
| KB-E2E-006 | Storage | Path traversal filename | Automated | Run contract suite | File remains under storage root | Server-generated safe key used | Passed | application use cases | Original name is metadata only |
| KB-E2E-007 | Storage | Persistence failure cleanup | Automated | Run contract suite | Stored orphan removed best-effort | Cleanup invocation verified | Passed | application use cases | Cleanup details remain private |
| KB-E2E-008 | Parser | TXT extraction and normalization | Automated | Run contract suite | Strict UTF-8 normalized text | Extracted and normalized | Passed | document extraction; production E2E | Production extractor used in E2E |
| KB-E2E-009 | Parser | DOCX extraction | Automated | Run contract suite | Readable body text extracted | Synthetic DOCX passed | Passed | document extraction | Uses `mammoth` |
| KB-E2E-010 | Parser | Text PDF extraction | Automated | Run contract suite | Readable PDF text extracted | Synthetic text PDF passed | Passed | document extraction | Uses `pdf-parse` |
| KB-E2E-011 | Parser | Corrupt parser input | Automated | Run contract suite | Safe parser error | Corrupt input rejected safely | Passed | document extraction | Parser internals withheld |
| KB-E2E-012 | Parser | Empty/image-only PDF | Automated | Run contract suite | No usable text fails safely | Empty PDF extraction rejected | Passed | document extraction | OCR is not implemented |
| KB-E2E-013 | Worker | Queued job succeeds | Automated | Run contract suite | Job/document progress to ready | Chunks persisted; lifecycle ready | Passed | ingestion worker runtime | Storage and extractor called once |
| KB-E2E-014 | Worker | Storage/parser failure | Automated | Run contract suite | Job/document fail safely | Safe failure status persisted | Passed | ingestion worker runtime | Private paths excluded |
| KB-E2E-015 | Worker | Non-pending job | Automated | Run contract suite | No reprocessing or duplicate chunks | Ingesting/ready/failed jobs rejected | Passed | ingestion worker runtime | No implicit retry |
| KB-E2E-016 | Worker | FIFO tie ordering | Automated | Run contract suite | `queuedAt`, then job ID ordering | Stable ordering verified | Passed | ingestion worker runtime | No multi-worker lease claim |
| KB-E2E-017 | Worker | Chunk persistence failure | Automated | Run contract suite | Job/document remain failed, not ready | Failure lifecycle verified | Passed | ingestion worker runtime | Partial chunk is not treated as success |
| KB-E2E-018 | Embedding | Deterministic and real-adapter success | Automated | Run contract suite | Vectors generated in input order | Fake and mocked HTTP modes passed | Passed | embedding adapter/provider tests | No real network call |
| KB-E2E-019 | Embedding | Provider failure | Automated | Run contract suite | Safe embedding failure | Provider details redacted | Passed | embedding adapter; local flow | API key/payload withheld |
| KB-E2E-020 | Embedding | Dimension/count mismatch | Automated | Run contract suite | Invalid response rejected | Mismatch rejected safely | Passed | real embedding provider | Non-finite values also rejected |
| KB-E2E-021 | Vector | pgvector upsert | Automated | Run contract suite | Stable chunk vector upsert | SQL boundary and replacement verified | Passed | pgvector index | Mocked DB executor |
| KB-E2E-022 | Vector | Duplicate chunk upsert | Automated | Run contract suite | Existing row updated, no duplicate | Stable identity verified | Passed | pgvector index | Raw vector remains DB-internal |
| KB-E2E-023 | Vector | DB/query failure | Automated | Run contract suite | Safe vector error | DB details excluded | Passed | pgvector index; local flow | No external vector DB |
| KB-E2E-024 | Retrieval | Ranked evidence success | Automated | Run contract suite | Safe ranked chunk evidence | Ranked evidence returned | Passed | retrieval/search; production E2E | Hydrates document/chunk metadata |
| KB-E2E-025 | Retrieval | Empty result | Automated | Run contract suite | Empty safe result | `{ results: [], total: 0 }` | Passed | retrieval/search | Not an error |
| KB-E2E-026 | Retrieval | Cross-workspace/unsafe match | Automated | Run contract suite | Match excluded | Other-workspace and pending matches filtered | Passed | retrieval/search; access control | Workspace is mandatory |
| KB-E2E-027 | RAG | Grounded answer with citation | Automated | Run contract suite | Answer cites returned evidence | Evidence and `E1` citation returned | Passed | RAG answer; production E2E | Unknown citation IDs discarded |
| KB-E2E-028 | RAG | Insufficient evidence | Automated | Run contract suite | Safe fallback; provider not called | Fallback verified | Passed | RAG answer | Weak score also gated |
| KB-E2E-029 | RAG | Provider failure/malformed response | Automated | Run contract suite | Safe provider fallback | `provider_error` returned safely | Passed | RAG answer | Prompt/payload withheld |
| KB-E2E-030 | Access | Unauthorized upload | Automated | Run contract suite | 403 safe response | Management action denied | Passed | access control; API router | Requires `knowledge:manage` |
| KB-E2E-031 | Access | Unauthorized retrieval/RAG | Automated | Run contract suite | 403 safe response | Both operations denied | Passed | access control | Requires workspace read |
| KB-E2E-032 | Access | Cross-workspace document/content | Automated | Run contract suite | Safe denial/not-found | Repository/content reader scope enforced | Passed | access control | Existence is not disclosed |
| KB-E2E-033 | Agent | Ungranted retrieval/RAG | Automated | Run contract suite | Empty before embedding/provider calls | No provider calls observed | Passed | access control | Active document grants required |
| KB-E2E-034 | Agent | Skill reference only | Automated | Run contract suite | Reference grants no permission | Retrieval/RAG remained denied | Passed | access control | `skill.md` is not policy |
| KB-E2E-035 | Status UI | API-backed lifecycle states | Automated | Run targeted component tests | Queued/processing/completed/failed mapped | All mappings rendered | Passed | Processing Status component | Mock jobs are not runtime source |
| KB-E2E-036 | Status UI | Safe failed/API error display | Automated | Run targeted component tests | Generic/bounded safe error | Unsafe values not rendered | Passed | Processing Status component | Manual refresh verified |
| KB-E2E-037 | Contracts | Public/private-field safety | Automated | Run contract and safety checks | Public DTOs contain safe fields only | Contract deny lists passed | Passed | contracts/backend/API tests | Internal fields remain backend-only |
| KB-E2E-038 | Full flow | Upload to grounded answer | Automated | Run production E2E contract | Upload, extract, chunk, index, retrieve, answer, status | Entire deterministic flow passed | Passed | `knowledge-base-rag-production-e2e.test.mjs` | Temp storage + production TXT parser |

## 5. Automated Validation Summary

| Command | Result |
| --- | --- |
| `node tests/contract/knowledge-base-rag-production-e2e.test.mjs` | Passed |
| `npm run test:contracts` | Passed, including the production E2E contract |
| Targeted Processing Status, Upload, and API-client component tests | Passed: 3 files, 16 tests |
| `npm run test:contracts:types` | Passed as part of contract suite |
| `npm run prisma -- validate` | Passed |
| `npm run build` | Passed; existing non-blocking Vite chunk-size warning |
| `npm test` | Passed; task-orchestration frontend 577/577 and component suite 685/685 |
| `npm run test:e2e` | Failed before test execution because the Playwright Chromium executable is not installed; current suite has no KB/RAG spec |
| `npm run validate:openspec` | Failed: `openspec: command not found` |
| `git diff --check` | Passed |

## 6. Manual / Browser Verification Checklist

Manual browser verification was not executed locally. It requires a running
backend/frontend, configured database migration state, worker invocation, and
provider credentials where real-provider behavior is desired.

- [ ] Open Documents, Upload Documents, and Processing Status.
- [ ] Upload a supported TXT file.
- [ ] Upload a small text PDF and DOCX file.
- [ ] Confirm the document appears without private storage metadata.
- [ ] Confirm the ingestion job appears queued/processing.
- [ ] Invoke the worker runtime through the deployment's approved entrypoint.
- [ ] Confirm the job becomes completed and the document becomes ready.
- [ ] Submit retrieval/search against unique uploaded text.
- [ ] Generate a grounded answer and inspect citation/evidence references.
- [ ] Verify an empty query and an insufficient-evidence query.
- [ ] Verify a failed job displays only its safe failure summary.
- [ ] Verify an unauthorized request returns a safe 401/403.
- [ ] Verify a second workspace cannot read the first workspace's evidence.
- [ ] Inspect API/UI output for private storage, vector, provider, and queue data.

## 7. Defect Log

| ID | Area | Description | Severity | Reproduction | Expected | Actual | Status | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | Tooling | OpenSpec CLI is unavailable | Low / Tooling | Run `npm run validate:openspec` | Strict OpenSpec validation runs | `sh: 1: openspec: not found` | External limitation | Install approved OpenSpec CLI and run strict validation |
| D-002 | Tooling | Playwright browser binary is unavailable | Low / Tooling | Run `npm run test:e2e` | Configured Chromium launches | Executable missing under the Playwright cache; 4 tests failed to launch and 6 did not run | External limitation | Install the matching Playwright Chromium binary in the validation environment |

No runtime defect was found by the automated verification performed for this
issue. This does not replace live deployment and browser acceptance testing.

## 8. Known Limitations

- Real embedding and RAG providers were not called; tests use mocked HTTP or
  deterministic adapters and require no real credentials.
- pgvector SQL behavior is contract-tested through a mocked database executor;
  deployment still requires PostgreSQL with the `vector` extension and the
  repository migration applied.
- Browser/manual verification was not executed locally.
- The existing Playwright suite covers Agent Management and Workflow
  import/export, not KB/RAG; it also cannot run in this environment until the
  matching Chromium binary is installed.
- Google Drive is the only implemented external synchronization provider.
  Manual sync and opt-in scheduled polling operate only on configured file or
  folder scope. Notion and Confluence remain out of scope.
- Agent grants are document-level. Source-level grants and a public grant
  administration API remain deferred.
- Image-only PDFs require OCR, which remains out of scope.
- Processing Status uses manual refresh; polling/WebSocket/SSE is deferred.
- There is no chatbot UI.
- No FastAPI migration is included; use-case and DTO behavior remains suitable
  as reference behavior for a later OpenAPI/Pydantic port.

## 9. Security and Privacy Review

The safety search and focused tests permit internal backend/schema/test
references but reject public exposure of:

- API keys, bearer tokens, credentials, and secrets;
- storage keys, private URLs, and filesystem paths;
- queue payloads and worker runtime internals;
- raw embeddings, raw vectors, and vector references;
- provider requests/responses and raw prompts; and
- parser internals and stack traces.

Public DTO contract tests, API-client deny lists, retrieval/RAG safety tests,
access-control tests, and Processing Status component tests enforce these
boundaries. No real secret is included in this evidence.

## 10. Production Readiness Assessment

The repository-level implementation is ready for review as a complete,
deterministically verified reference flow. All production slices compose
without a newly discovered wiring defect, and failure/access/safety boundaries
have focused automated evidence.

Operational production readiness remains conditional on:

1. applying and validating PostgreSQL/pgvector migrations in the deployment;
2. configuring and smoke-testing approved embedding/RAG providers;
3. running the worker entrypoint in the target runtime; and
4. completing browser/manual acceptance checks.

## 11. Parent Issue Closure Note

Parent issue `#323` can be closed after this PR is reviewed and accepted if its
closure criterion is completion of the repository implementation and
deterministic production-flow evidence. Live infrastructure/provider and
browser acceptance should remain explicit deployment follow-ups rather than be
represented as executed by this issue.
