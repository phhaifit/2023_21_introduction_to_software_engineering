# Knowledge Base / RAG Module

Owner: Member 9

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own document metadata, ingestion requests, sync configuration, vector index status, and knowledge permissions.
- Enforce workspace scope and agent-document permissions for retrieval.
- Keep slow ingestion and embedding work in workers.
