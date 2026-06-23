# Knowledge Base / RAG Context

## Overview

Knowledge Base / RAG Management owns workspace knowledge sources before they are
used by RAG or AI agents. It prepares, tracks, and governs documents and external
source data. It is not the final chatbot or answer-generation module.

Parent issue: `[Phase 4] Quản lý Tri thức & Dữ liệu nội bộ (Knowledge Base / RAG Management) #35`

First sub-issue: `[Phase 4] Knowledge Base / RAG Management - Base Layout and Navigation #36`

OpenSpec change: `implement-knowledge-base-rag`

## Feature Responsibilities

- View workspace document lists.
- Upload internal documents.
- Validate selected files before ingestion.
- Delete or disable documents when later scoped.
- Monitor ingestion and processing status.
- Manage external source concepts such as Google Drive, Notion, and Confluence.
- Select synchronization scope.
- Trigger manual synchronization.
- Support future automated synchronization.
- Monitor synchronization status.
- Preserve agent knowledge access control as a later module concern.

## Non-Responsibilities

- Do not generate final chatbot answers.
- Do not implement agent execution or task orchestration.
- Do not own Agent Management UI or backend behavior.
- Do not expose raw vector database details to other modules.
- Do not implement production OAuth integrations for PA5 unless explicitly
  assigned later.

## Current Repo State

- The repository is a TypeScript/NPM workspaces monorepo.
- Frontend is React 18 + Vite + TypeScript.
- Backend runtime is currently a TypeScript modular monolith development server.
- `apps/frontend/src/App.tsx` currently renders Agent Management.
- Existing tests may depend on Agent Management staying intact.
- Knowledge Base / RAG frontend, backend, and worker folders currently contain
  README/context only.
- There is no route-based navigation for this feature today.

## Target Architecture

- React frontend for user workflows.
- Modular monolith backend with feature-owned module boundaries.
- Separate background worker runtime for slow or retryable processing.
- Message broker or processing queue for asynchronous jobs.
- PostgreSQL with vector-capable storage for metadata, chunks, and embeddings.
- Object storage for raw uploaded and synchronized files.
- External platforms connected through OAuth/API boundaries.
- Parsing, chunking, embedding, indexing, and sync ingestion run asynchronously.

## Prototype Approach

For PA5 / Phase 4, prefer a stable frontend prototype with mock data and clear
boundaries. Add real backend, worker, and integration code only when a later
ticket explicitly requests it.

Issue #36 should use local React state for tab/view switching inside the
Knowledge Base / RAG page. Do not introduce React Router or app-level
architecture changes for this sub-issue.

## Main Screens

- Documents
- Upload Documents
- Data Sources
- Synchronization Scope
- Processing Status

## Main Statuses

Existing shared status values include `pending`, `ingesting`, `ready`, and
`failed` for knowledge indexing. Future UI should keep status labels consistent
with shared contracts when real contracts are used.

## Future Backend Concepts

- Document metadata.
- Raw file object reference.
- Data source connection metadata.
- Sync scope configuration.
- Ingestion job.
- Sync job.
- Chunk metadata.
- Embedding/vector metadata.
- Agent knowledge access assignment.

## PA5 Testing Alignment

- Issue #36: manual render/click verification is enough unless a later
  instruction asks for tests.
- Later frontend tickets: add focused component tests for view switching,
  upload validation, status rendering, and mock flow behavior.
- Later backend/worker tickets: add contract or unit tests for validation,
  repository behavior, queue handoff, ingestion success/failure, and adapter
  boundaries.
- Always keep Agent Management tests untouched unless explicitly requested by
  its owner.

## Current Known Constraints

- Do not modify other teammates' modules.
- Do not change package dependencies.
- Do not change build or test config.
- Do not add routes for issue #36.
- Do not change shared contracts unless a later reviewed requirement proves the
  current contracts are insufficient.
- Keep sub-issue PRs small, preferably under 500 lines of code.
