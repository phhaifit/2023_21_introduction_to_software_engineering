# Knowledge Base / RAG API Layer

HTTP routers are intentionally out of scope for the backend repository-boundary
slice. Future API work should translate workspace-scoped HTTP requests into
application commands and queries defined in this module, then return shared
`@vcp/shared` DTOs.

