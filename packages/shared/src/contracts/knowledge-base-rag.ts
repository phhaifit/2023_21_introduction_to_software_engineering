import type { ApiError, ErrorCode } from "./api.ts";
import type { EntityId } from "./ids.ts";
import type { KnowledgeIndexStatus } from "./statuses.ts";

export const KNOWLEDGE_BASE_RAG_API_ROUTES = {
  documents: "/api/workspaces/:workspaceId/knowledge/documents",
  document: "/api/workspaces/:workspaceId/knowledge/documents/:documentId",
  uploadDocuments: "/api/workspaces/:workspaceId/knowledge/uploads",
  validateUploads: "/api/workspaces/:workspaceId/knowledge/uploads/validate",
  prepareUploads: "/api/workspaces/:workspaceId/knowledge/uploads/prepare",
  ingestionJobs: "/api/workspaces/:workspaceId/knowledge/ingestion-jobs",
  dataSources: "/api/workspaces/:workspaceId/knowledge/data-sources",
  connectDataSource: "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect",
  syncScope: "/api/workspaces/:workspaceId/knowledge/sync-scope",
  syncJobs: "/api/workspaces/:workspaceId/knowledge/sync-jobs",
  retrievalSearch: "/api/workspaces/:workspaceId/knowledge/retrieval/search",
  ragAnswer: "/api/workspaces/:workspaceId/knowledge/rag/answer",
  agentKnowledgeDocuments:
    "/api/workspaces/:workspaceId/knowledge/agents/:agentId/documents",
  agentKnowledgeDocument:
    "/api/workspaces/:workspaceId/knowledge/agents/:agentId/documents/:documentId",
  agentKnowledgeAsk:
    "/api/workspaces/:workspaceId/knowledge/agents/:agentId/ask",
  googleDriveOAuthStart:
    "/api/workspaces/:workspaceId/knowledge/data-sources/google-drive/connect/start",
  googleDriveOAuthCallback:
    "/api/workspaces/:workspaceId/knowledge/data-sources/google-drive/oauth/callback",
  disconnectDataSource:
    "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/disconnect",
  googleDriveScope:
    "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/google-drive/scope",
  googleDrivePreview:
    "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/google-drive/preview",
  googleDriveAutoSync:
    "/api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/google-drive/auto-sync",
  syncJob:
    "/api/workspaces/:workspaceId/knowledge/sync-jobs/:jobId"
} as const;

export const KNOWLEDGE_BASE_RAG_ROUTE_CONTRACTS = [
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.documents },
  { method: "DELETE", path: KNOWLEDGE_BASE_RAG_API_ROUTES.document },
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
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.retrievalSearch },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.ragAnswer },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.agentKnowledgeDocuments },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.agentKnowledgeDocument },
  { method: "DELETE", path: KNOWLEDGE_BASE_RAG_API_ROUTES.agentKnowledgeDocument },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.agentKnowledgeAsk },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.googleDriveOAuthStart },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.googleDriveOAuthCallback },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.disconnectDataSource },
  { method: "PUT", path: KNOWLEDGE_BASE_RAG_API_ROUTES.googleDriveScope },
  { method: "POST", path: KNOWLEDGE_BASE_RAG_API_ROUTES.googleDrivePreview },
  { method: "PUT", path: KNOWLEDGE_BASE_RAG_API_ROUTES.googleDriveAutoSync },
  { method: "GET", path: KNOWLEDGE_BASE_RAG_API_ROUTES.syncJob }
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
  "workspace.not_found",
  "knowledge.access_denied",
  "system.unexpected_error"
] as const satisfies readonly ErrorCode[];

export const KNOWLEDGE_BASE_RAG_DTO_EXPORTS = [
  "KnowledgeDocumentDto",
  "DeleteKnowledgeDocumentResponse",
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
  "GoogleDriveOAuthStartRequest",
  "GoogleDriveOAuthStartResponse",
  "GoogleDriveOAuthCallbackResponse",
  "GoogleDriveSyncScopeRequest",
  "GoogleDriveScopePreviewRequest",
  "GoogleDriveAutoSyncSettingsRequest",
  "KnowledgeRetrievalSearchRequest",
  "KnowledgeEvidenceDto",
  "KnowledgeRetrievalSearchResponse",
  "KnowledgeRagAnswerRequest",
  "KnowledgeRagAnswerCitationDto",
  "KnowledgeRagAnswerResponse",
  "AgentKnowledgeDocumentDto",
  "AgentKnowledgeAskRequest",
  "AgentKnowledgeAskResponse",
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
  externalId?: string;
  sourceModifiedAt?: string;
  lastSyncedAt?: string;
  failure?: SafeFailureSummary;
};

export type DeleteKnowledgeDocumentResponse = {
  documentId: EntityId<"documentId">;
  deleted: true;
};

export type AgentKnowledgeDocumentDto = {
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
  document: KnowledgeDocumentDto;
  grantStatus: "active" | "revoked";
};

export type AgentKnowledgeAskRequest = {
  message: string;
  topK?: number;
  filters?: Pick<
    KnowledgeRetrievalFilters,
    "documentIds" | "sourceTypes" | "sourceLocators"
  >;
};

export type AgentKnowledgeAskCitationDto = {
  citationId: string;
  documentId: EntityId<"documentId">;
  documentTitle: string;
  snippet: string;
  sourceType: KnowledgeDocumentSource;
  sourceLocator?: string;
};

export type AgentKnowledgeAskResponse = {
  status:
    | "answered"
    | "insufficient_evidence"
    | "unauthorized"
    | "invalid_request"
    | "error";
  answer: string;
  citations: AgentKnowledgeAskCitationDto[];
  warnings: string[];
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
  connectedAccountEmail?: string;
  oauthConfigured?: boolean;
  lastSyncAt?: string;
  autoSyncEnabled?: boolean;
  autoSyncFrequency?: "hourly" | "daily";
  lastAutoSyncAt?: string;
  nextAutoSyncAt?: string;
  lastSyncStatus?: "completed" | "failed";
  updatedAt: string;
  failure?: SafeFailureSummary;
};

export type SyncScopeNodeDto = {
  scopeNodeId: string;
  sourceId: string;
  externalId?: string;
  parentScopeNodeId?: string;
  name: string;
  nodeType: "folder" | "file" | "page" | "space";
  mimeType?: string;
  selected: boolean;
  selectable: boolean;
  unsupportedReason?: string;
  hasMoreChildren?: boolean;
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
  importedItemCount?: number;
  updatedItemCount?: number;
  skippedUnchangedItemCount?: number;
  skippedUnsupportedItemCount?: number;
  removedItemCount?: number;
  failedItemCount?: number;
  totalChunksCreated?: number;
  totalVectorsIndexed?: number;
  syncMode?: "manual" | "scheduled";
  failure?: SafeFailureSummary;
};

export type GoogleDriveOAuthStartRequest = {
  displayName?: string;
};

export type GoogleDriveOAuthStartResponse = {
  authorizationUrl: string;
};

export type GoogleDriveOAuthCallbackResponse = {
  source: KnowledgeDataSourceDto;
  connected: true;
};

export type GoogleDriveSyncScopeRequest = {
  folderIds?: string[];
  fileIds?: string[];
  recursive?: boolean;
  allowedMimeTypes?: string[];
  maxFiles?: number;
};

export type GoogleDriveScopePreviewRequest = {
  folderIds?: string[];
  fileIds?: string[];
  recursive?: boolean;
  allowedMimeTypes?: string[];
  maxFiles?: number;
};

export type GoogleDriveAutoSyncSettingsRequest = {
  autoSyncEnabled: boolean;
  autoSyncFrequency?: "hourly" | "daily";
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

export const KNOWLEDGE_RAG_ANSWER_STATUSES = [
  "answered",
  "answered_with_caution",
  "insufficient_evidence",
  "provider_error"
] as const;

export type KnowledgeRagAnswerStatus =
  (typeof KNOWLEDGE_RAG_ANSWER_STATUSES)[number];

export type KnowledgeRagAnswerOptions = {
  maxAnswerLength?: number;
  includeCitations?: boolean;
};

export type KnowledgeRagAnswerRequest = {
  query: string;
  topK?: number;
  filters?: KnowledgeRetrievalFilters;
  answerOptions?: KnowledgeRagAnswerOptions;
};

export type KnowledgeRagAnswerCitationDto = {
  citationId: string;
  evidenceId: string;
  documentId: EntityId<"documentId">;
  chunkId: string;
  rank: number;
  snippet: string;
};

export type KnowledgeRagAnswerResponse = {
  answerId: string;
  status: KnowledgeRagAnswerStatus;
  answer: string;
  citations: KnowledgeRagAnswerCitationDto[];
  evidence: KnowledgeEvidenceDto[];
  warnings: string[];
};

export type KnowledgeBaseApiError = ApiError & {
  code: KnowledgeBaseApiErrorCode;
};
