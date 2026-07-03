import type { ApiError, ErrorCode } from "./api.ts";
import type { EntityId } from "./ids.ts";
import type { KnowledgeIndexStatus } from "./statuses.ts";

export const KNOWLEDGE_BASE_RAG_API_ROUTES = {
  documents: "/api/workspaces/:workspaceId/knowledge/documents",
  uploadDocuments: "/api/workspaces/:workspaceId/knowledge/uploads",
  validateUploads: "/api/workspaces/:workspaceId/knowledge/uploads/validate",
  prepareUploads: "/api/workspaces/:workspaceId/knowledge/uploads/prepare",
  ingestionJobs: "/api/workspaces/:workspaceId/knowledge/ingestion-jobs",
  dataSources: "/api/workspaces/:workspaceId/knowledge/data-sources",
  connectDataSource: "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect",
  syncScope: "/api/workspaces/:workspaceId/knowledge/sync-scope",
  syncJobs: "/api/workspaces/:workspaceId/knowledge/sync-jobs",
  retrievalSearch: "/api/workspaces/:workspaceId/knowledge/retrieval/search"
} as const;

export const KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS = [
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.documents },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.uploadDocuments },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.validateUploads },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.prepareUploads },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.ingestionJobs },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.dataSources },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.connectDataSource },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.syncScope },
  { method: "PUT", path: KNOWLEDGE_BASE_RAG_API_ROUTES.syncScope },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.syncJobs },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.syncJobs },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.retrievalSearch }
] as const;

export type KnowledgeBaseRagApiRoute =
  (typeof KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS)[number];

export const KNOWLEDGE_DOCUMENT_SOURCES = [
  "upload",
  "google_drive",
  "notion",
  "confluence"
] as const;

export const KNOWLEDGE_DATA_SOURCE_STATUSES = [
  "not_connected",
  "connected",
  "syncing",
  "failed"
] as const;

export const KNOWLEDGE_SYNC_JOB_STATUSES = [
  "pending",
  "syncing",
  "completed",
  "failed"
] as const;

export const UPLOAD_VALIDATION_STATUSES = ["accepted", "rejected"] as const;

export const KNOWLEDGE_BASE_API_ERROR_CODES = [
  "auth.unauthorized",
  "auth.forbidden",
  "validation.invalid_input",
  "knowledge.access_denied",
  "system.unexpected_error"
] as const satisfies readonly ErrorCode[];

export const KNOWLEDGE_BASE_RAG_DTO_EXPORTS = [
  "KnowledgeDocumentDto",
  "KnowledgeDocumentChunkDto",
  "UploadCandidateFileDto",
  "UploadValidationRequest",
  "UploadValidationResponse",
  "PrepareUploadRequest",
  "PrepareUploadResponse",
  "IngestionJobDto",
  "KnowledgeDataSourceDto",
  "SyncScopeNodeDto",
  "SyncJobDto",
  "KnowledgeRetrievalSearchRequest",
  "KnowledgeEvidenceDto",
  "KnowledgeRetrievalSearchResponse",
  "KnowledgeBaseApiError"
] as const;

export type KnowledgeDocumentSource = (typeof KNOWLEDGE_DOCUMENT_SOURCES)[number];
export type KnowledgeDataSourceStatus = (typeof KNOWLEDGE_DATA_SOURCE_STATUSES)[number];
export type KnowledgeSyncJobStatus = (typeof KNOWLEDGE_SYNC_JOB_STATUSES)[number];
export type UploadValidationStatus = (typeof UPLOAD_VALIDATION_STATUSES)[number];
export type KnowledgeBaseApiErrorCode = (typeof KNOWLEDGE_BASE_API_ERROR_CODES)[number];

export type SafeFailureSummary = {
  errorCode: string;
  errorMessage: string;
};

export type KnowledgeDocumentDto = {
  documentId: EntityId<"documentId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  source: KnowledgeDocumentSource;
  mediaType: string;
  sizeBytes: number;
  status: KnowledgeIndexStatus;
  chunkCount: number;
  indexedChunkCount: number;
  createdAt: string;
  updatedAt: string;
  lastIndexedAt?: string;
  failure?: SafeFailureSummary;
};

export type KnowledgeDocumentChunkDto = {
  chunkId: string;
  documentId: EntityId<"documentId">;
  workspaceId: EntityId<"workspaceId">;
  sequence: number;
  textPreview: string;
  pageLabel?: string;
  characterCount?: number;
  createdAt: string;
};

export type UploadCandidateFileDto = {
  clientFileId: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
};

export type UploadValidationResultDto = {
  clientFileId: string;
  fileName: string;
  status: UploadValidationStatus;
  reasonCode?: string;
  message?: string;
};

export type UploadValidationRequest = {
  files: UploadCandidateFileDto[];
};

export type UploadValidationResponse = {
  results: UploadValidationResultDto[];
  acceptedCount: number;
  rejectedCount: number;
};

export type PrepareUploadRequest = {
  files: UploadCandidateFileDto[];
};

export type PrepareUploadResponse = {
  documents: KnowledgeDocumentDto[];
  ingestionJobs: IngestionJobDto[];
};

export type IngestionJobDto = {
  jobId: EntityId<"jobId">;
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  status: KnowledgeIndexStatus;
  progressPercent: number;
  currentStep?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  failure?: SafeFailureSummary;
};

export type KnowledgeDataSourceDto = {
  sourceId: string;
  workspaceId: EntityId<"workspaceId">;
  provider: Exclude<KnowledgeDocumentSource, "upload">;
  displayName: string;
  status: KnowledgeDataSourceStatus;
  selectedScopeNodeCount: number;
  lastSyncAt?: string;
  updatedAt: string;
  failure?: SafeFailureSummary;
};

export type SyncScopeNodeDto = {
  scopeNodeId: string;
  sourceId: string;
  parentScopeNodeId?: string;
  name: string;
  nodeType: "folder" | "file" | "page" | "space";
  selected: boolean;
  selectable: boolean;
  updatedAt: string;
};

export type SyncJobDto = {
  jobId: EntityId<"jobId">;
  workspaceId: EntityId<"workspaceId">;
  sourceId?: string;
  status: KnowledgeSyncJobStatus;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  scannedItemCount: number;
  changedItemCount: number;
  failure?: SafeFailureSummary;
};

export type ConnectKnowledgeDataSourceRequest = {
  displayName?: string;
  providerAccountLabel?: string;
};

export type UpdateSyncScopeRequest = {
  selectedScopeNodeIds: string[];
};

export type RequestKnowledgeSyncJobRequest = {
  sourceId?: string;
  scopeNodeIds?: string[];
};

export type KnowledgeRetrievalFilters = {
  documentIds?: EntityId<"documentId">[];
  sourceTypes?: KnowledgeDocumentSource[];
  sourceLocators?: string[];
  statuses?: KnowledgeIndexStatus[];
};

export type KnowledgeRetrievalSearchRequest = {
  query: string;
  topK?: number;
  filters?: KnowledgeRetrievalFilters;
};

export type KnowledgeEvidenceDto = {
  evidenceId: string;
  rank: number;
  score: number;
  documentId: EntityId<"documentId">;
  chunkId: string;
  documentTitle: string;
  snippet: string;
  source: {
    type: KnowledgeDocumentSource;
    locator?: string;
  };
  metadata: {
    chunkIndex: number;
  };
};

export type KnowledgeRetrievalSearchResponse = {
  results: KnowledgeEvidenceDto[];
  total: number;
};

export type KnowledgeBaseApiError = ApiError & {
  code: KnowledgeBaseApiErrorCode;
};
