-- Enable pgvector in the primary PostgreSQL database.
CREATE EXTENSION IF NOT EXISTS vector;

-- Store embeddings on the existing workspace-scoped chunk record.
-- The unconstrained vector type keeps the configured embedding dimension replaceable.
ALTER TABLE "knowledge_document_chunks"
    ADD COLUMN "embedding" vector,
    ADD COLUMN "embeddingDimensions" INTEGER;

ALTER TABLE "knowledge_document_chunks"
    ADD CONSTRAINT "knowledge_document_chunks_embedding_dimensions_check"
    CHECK (
        ("embedding" IS NULL AND "embeddingDimensions" IS NULL)
        OR (
            "embedding" IS NOT NULL
            AND "embeddingDimensions" > 0
            AND vector_dims("embedding") = "embeddingDimensions"
        )
    );

CREATE INDEX "knowledge_document_chunks_workspaceId_embeddingDimensions_idx"
    ON "knowledge_document_chunks"("workspaceId", "embeddingDimensions");
