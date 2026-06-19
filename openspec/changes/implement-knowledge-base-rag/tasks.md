## 1. Knowledge Domain

- [ ] 1.1 Define document, collection, data source, ingestion job, vector metadata, and agent access models
- [ ] 1.2 Implement document and knowledge access repository or persistence interfaces
- [ ] 1.3 Implement public retrieval contract for task orchestration

## 2. Ingestion and Retrieval

- [ ] 2.1 Implement document upload validation and metadata creation
- [ ] 2.2 Enqueue document ingestion jobs after upload
- [ ] 2.3 Implement ingestion worker for parsing, chunking, embedding, and vector storage through adapters
- [ ] 2.4 Implement ingestion success and failure status updates
- [ ] 2.5 Implement vector search through the adapter boundary
- [ ] 2.6 Implement agent knowledge assignment and access checks

## 3. Frontend Experience

- [ ] 3.1 Build document list and upload UI
- [ ] 3.2 Build ingestion status display for pending, indexed, and failed documents
- [ ] 3.3 Build data source placeholder configuration UI
- [ ] 3.4 Build agent knowledge assignment controls

## 4. Verification and Handoff

- [ ] 4.1 Add tests for upload, unsupported file rejection, ingestion success/failure, search, and access checks
- [ ] 4.2 Add tests that vector and embedding calls go through adapters
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with supported file assumptions, adapter contracts, and RAG limitations
