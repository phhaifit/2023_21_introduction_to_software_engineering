export type KnowledgeDocumentStatus = "ready" | "processing" | "failed" | "pending";

export type KnowledgeDocumentSource =
  | "upload"
  | "google-drive"
  | "notion"
  | "confluence";

export type KnowledgeDocumentType = "pdf" | "docx" | "txt" | "csv" | "page";

export type KnowledgeDocument = {
  id: string;
  name: string;
  source: KnowledgeDocumentSource;
  type: KnowledgeDocumentType;
  sizeLabel: string;
  owner: string;
  updatedAt: string;
  mediaType?: string;
  lastSyncedAt?: string;
  sourceModifiedAt?: string;
  status: KnowledgeDocumentStatus;
  chunkCount?: number;
  indexedItemCount?: number;
  summary?: string;
  description?: string;
};

export type UploadValidationStatus = "valid" | "invalid";

export type UploadCandidateFile = {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  validationStatus: UploadValidationStatus;
  validationMessage: string;
};

export type ProcessingJobStatus = "pending" | "running" | "completed" | "failed";

export type KnowledgeBaseProcessingJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ProcessingJob = {
  jobId: string;
  documentId: string;
  documentName: string;
  documentStatus: KnowledgeDocumentStatus;
  mediaType: string;
  fileType: KnowledgeDocumentType;
  sourceName: string;
  status: KnowledgeBaseProcessingJobStatus;
  progress: number;
  currentStep: string;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
  chunkCount?: number;
  indexedChunkCount?: number;
  safeErrorMessage?: string;
  originalDriveName?: string;
  lastSyncedAt?: string;
  sourceModifiedAt?: string;
};

export type IngestionJob = ProcessingJob;

export type ExternalDataSourceProvider = "google-drive" | "notion" | "confluence";

export type ExternalDataSourceStatus =
  | "connected"
  | "not-connected"
  | "syncing"
  | "failed";

export type ExternalDataSource = {
  id: string;
  provider: ExternalDataSourceProvider;
  name: string;
  status: ExternalDataSourceStatus;
  description: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  selectedScopeCount: number;
  syncSummary: string;
};

export type SyncScopeNodeType = "folder" | "file" | "page" | "space";

export type SyncScopeNode = {
  id: string;
  name: string;
  type: SyncScopeNodeType;
  selected: boolean;
  children?: SyncScopeNode[];
};

export type SyncJobStatus = "running" | "completed" | "failed";

export type SyncJob = {
  id: string;
  sourceName: string;
  status: SyncJobStatus;
  progress: number;
  documentsAdded: number;
  documentsUpdated: number;
  documentsRemoved: number;
  startedAt: string;
  finishedAt?: string;
  message: string;
};
