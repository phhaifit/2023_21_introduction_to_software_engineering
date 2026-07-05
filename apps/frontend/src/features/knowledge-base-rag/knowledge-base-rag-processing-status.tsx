import { RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  IngestionJobDto,
  KnowledgeDocumentDto,
  SyncJobDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";

import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseFileTypeBadge,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard
} from "./knowledge-base-rag-components.tsx";
import type {
  KnowledgeBaseProcessingJobStatus,
  ProcessingJob
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-processing-status.css";

type ProcessingStatusMetrics = {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
};

const defaultApiClient = createKnowledgeBaseRagApiClient();

export type KnowledgeBaseProcessingStatusScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  workspaceId?: EntityId<"workspaceId">;
};

export function KnowledgeBaseProcessingStatusScreen(
  props: KnowledgeBaseProcessingStatusScreenProps
) {
  const {
    apiClient = defaultApiClient,
    workspaceId = DEMO_WORKSPACE_ID
  } = props;
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJobDto[]>([]);
  const [loadState, setLoadState] =
    useState<"loading" | "loaded" | "error">("loading");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const metrics = useMemo(() => createProcessingStatusMetrics(jobs), [jobs]);
  const selectedJob =
    jobs.find((job) => job.jobId === selectedJobId) ?? null;

  useEffect(() => {
    let isActive = true;
    setLoadState("loading");

    Promise.all([
      apiClient.listIngestionJobs(workspaceId, { page: 1, pageSize: 100 }),
      apiClient.listDocuments(workspaceId, { page: 1, pageSize: 100 }),
      apiClient.listSyncJobs(workspaceId, { page: 1, pageSize: 100 })
    ])
      .then(([jobResponse, documentResponse, syncJobResponse]) => {
        if (!isActive) return;
        const documents = new Map(
          documentResponse.items.map((document) => [document.documentId, document])
        );
        setJobs(
          jobResponse.items.map((job) =>
            toProcessingJob(job, documents.get(job.documentId))
          )
        );
        setSyncJobs(syncJobResponse.items);
        setLoadState("loaded");
      })
      .catch(() => {
        if (!isActive) return;
        setJobs([]);
        setSyncJobs([]);
        setLoadState("error");
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, refreshKey, workspaceId]);

  return (
    <div className="knowledge-base-rag-processing-status">
      <div
        className="knowledge-base-rag-processing-status-metrics"
        aria-label="Processing status summary"
      >
        <KnowledgeBaseMetricCard
          label="Total jobs"
          value={metrics.total}
          helperText="Document processing jobs"
        />
        <KnowledgeBaseMetricCard
          label="Queued"
          value={metrics.queued}
          helperText="Jobs waiting to start"
        />
        <KnowledgeBaseMetricCard
          label="Processing"
          value={metrics.processing}
          helperText="Jobs currently preparing content"
        />
        <KnowledgeBaseMetricCard
          label="Completed"
          value={metrics.completed}
          helperText="Jobs ready for review"
        />
        <KnowledgeBaseMetricCard
          label="Failed"
          value={metrics.failed}
          helperText="Jobs needing attention"
        />
      </div>

      <KnowledgeBaseSectionCard
        title="Document processing"
        eyebrow="Processing status"
        description="Review ingestion and indexing progress for uploaded and synchronized workspace documents."
      >
        <div className="knowledge-base-rag-processing-status-actions" aria-label="Processing actions">
          <button
            type="button"
            disabled={loadState === "loading"}
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            <RefreshCw aria-hidden="true" size={16} />
            {loadState === "loading" ? "Refreshing..." : "Refresh status"}
          </button>
        </div>

        {loadState === "loading" ? (
          <div className="knowledge-base-rag-processing-status-feedback" role="status">
            Loading processing status...
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="knowledge-base-rag-processing-status-feedback" role="alert">
            <div>
              <h3>Unable to load processing status</h3>
              <p>Processing status is temporarily unavailable. Try again.</p>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}

        {loadState === "loaded" && jobs.length > 0 ? (
          <div className="knowledge-base-rag-processing-status-list" role="list">
            {jobs.map((job) => (
              <ProcessingJobCard
                isSelected={selectedJob?.jobId === job.jobId}
                job={job}
                key={job.jobId}
                onViewDetails={() => setSelectedJobId(job.jobId)}
              />
            ))}
          </div>
        ) : null}

        {loadState === "loaded" && jobs.length === 0 ? (
          <KnowledgeBaseEmptyState
            title="No processing jobs"
            description="Processing jobs will appear when workspace documents are prepared for ingestion and indexing."
          />
        ) : null}
      </KnowledgeBaseSectionCard>

      {loadState === "loaded" ? (
        <KnowledgeBaseSectionCard
          title="Google Drive synchronization"
          eyebrow="External source jobs"
          description="Manual and automatic Google Drive sync lifecycle and safe import summary."
        >
          {syncJobs.length > 0 ? (
            <div className="knowledge-base-rag-processing-status-list" role="list">
              {syncJobs.map((job) => (
                <article className="knowledge-base-rag-processing-job" role="listitem" key={job.jobId}>
                  <div className="knowledge-base-rag-processing-job__header">
                    <div>
                      <h3>Google Drive sync</h3>
                      <p>{syncCurrentStep(job.status)}</p>
                    </div>
                    <ProcessingStatusBadge status={mapSyncStatus(job.status)} />
                  </div>
                  <KnowledgeBaseMetadataList
                    items={[
                      { label: "Source", value: "Google Drive" },
                      {
                        label: "Job type",
                        value:
                          job.syncMode === "scheduled"
                            ? "Automatic sync"
                            : "Manual sync"
                      },
                      { label: "Started", value: job.startedAt ? formatDateTime(job.startedAt) : "Queued" },
                      { label: "Completed", value: job.finishedAt ? formatDateTime(job.finishedAt) : "Not completed" },
                      { label: "Discovered", value: job.scannedItemCount },
                      { label: "Imported", value: job.importedItemCount ?? 0 },
                      { label: "Updated", value: job.updatedItemCount ?? 0 },
                      { label: "Skipped unchanged", value: job.skippedUnchangedItemCount ?? 0 },
                      { label: "Skipped unsupported", value: job.skippedUnsupportedItemCount ?? 0 },
                      { label: "Removed", value: job.removedItemCount ?? 0 },
                      { label: "Failed files", value: job.failedItemCount ?? 0 }
                    ]}
                  />
                  {job.failure ? (
                    <p className="knowledge-base-rag-processing-job__error">
                      {getSafeFailureMessage(job.failure.errorMessage)}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <KnowledgeBaseEmptyState
              title="No Google Drive sync jobs"
              description="Run a manual sync or enable Auto Sync after configuring Google Drive scope."
            />
          )}
        </KnowledgeBaseSectionCard>
      ) : null}

      {loadState === "loaded" && selectedJob ? (
        <ProcessingJobDetails
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
        />
      ) : null}
    </div>
  );
}

function mapSyncStatus(status: SyncJobDto["status"]): KnowledgeBaseProcessingJobStatus {
  if (status === "pending") return "queued";
  if (status === "syncing") return "processing";
  return status;
}

function syncCurrentStep(status: SyncJobDto["status"]): string {
  const labels: Record<SyncJobDto["status"], string> = {
    pending: "Queued for synchronization",
    syncing: "Importing scoped Drive files",
    completed: "Synchronization completed",
    failed: "Synchronization failed"
  };
  return labels[status];
}

export function mapProcessingJobStatus(
  status: KnowledgeIndexStatus
): KnowledgeBaseProcessingJobStatus {
  const statuses: Record<KnowledgeIndexStatus, KnowledgeBaseProcessingJobStatus> = {
    pending: "queued",
    ingesting: "processing",
    ready: "completed",
    failed: "failed"
  };
  return statuses[status];
}

function toProcessingJob(
  job: IngestionJobDto,
  document?: KnowledgeDocumentDto
): ProcessingJob {
  const status = mapProcessingJobStatus(job.status);
  return {
    jobId: job.jobId,
    documentId: job.documentId,
    documentName: document?.name ?? job.documentId,
    documentStatus: mapDocumentStatus(document?.status ?? job.status),
    mediaType: document?.mediaType ?? "Unknown",
    fileType: inferDocumentType(document),
    sourceName: document ? formatSourceName(document.source) : "Workspace",
    status,
    progress: mapProgress(status, job.progressPercent),
    currentStep: job.currentStep ?? getCurrentStep(status),
    startedAt: formatDateTime(job.startedAt ?? job.queuedAt),
    ...(status === "completed" && job.finishedAt
      ? { completedAt: formatDateTime(job.finishedAt) }
      : {}),
    ...(status === "failed" && job.finishedAt
      ? { failedAt: formatDateTime(job.finishedAt) }
      : {}),
    ...(status === "failed"
      ? { safeErrorMessage: getSafeFailureMessage(job.failure?.errorMessage) }
      : {}),
    ...(document
      ? {
          chunkCount: document.chunkCount,
          indexedChunkCount: document.indexedChunkCount
        }
      : {})
  };
}

function mapDocumentStatus(status: KnowledgeIndexStatus): ProcessingJob["documentStatus"] {
  const statuses: Record<KnowledgeIndexStatus, ProcessingJob["documentStatus"]> = {
    pending: "pending",
    ingesting: "processing",
    ready: "ready",
    failed: "failed"
  };
  return statuses[status];
}

function mapProgress(
  status: KnowledgeBaseProcessingJobStatus,
  progress: number
): number {
  const value = clampProgress(progress);
  if (status === "queued") return 0;
  if (status === "completed") return 100;
  if (status === "processing") return value > 0 ? Math.min(99, value) : 50;
  return Math.min(99, value);
}

function getCurrentStep(status: KnowledgeBaseProcessingJobStatus): string {
  const steps: Record<KnowledgeBaseProcessingJobStatus, string> = {
    queued: "Queued for processing",
    processing: "Processing document",
    completed: "Ready for retrieval",
    failed: "Processing failed"
  };
  return steps[status];
}

function getSafeFailureMessage(message?: string): string {
  const fallback = "Processing failed. Review the document and try again.";
  if (!message?.trim()) return fallback;
  if (
    /storageKey|privateUrl|filePath|absolutePath|queuePayload|workerPayload|runtimeInternals|rawEmbedding|rawVector|vectorRef|providerPayload|stackTrace|secret|token|credential/i.test(
      message
    )
  ) {
    return fallback;
  }
  return message.trim().slice(0, 240);
}

function inferDocumentType(
  document?: KnowledgeDocumentDto
): ProcessingJob["fileType"] {
  if (!document) return "page";
  const mediaType = document.mediaType.toLowerCase();
  const name = document.name.toLowerCase();
  if (mediaType.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mediaType.includes("word") ||
    mediaType.includes("officedocument") ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mediaType.includes("csv") || name.endsWith(".csv")) return "csv";
  if (mediaType.includes("text") || name.endsWith(".txt")) return "txt";
  return "page";
}

function formatSourceName(source: KnowledgeDocumentDto["source"]): string {
  const sources: Record<KnowledgeDocumentDto["source"], string> = {
    upload: "Upload",
    google_drive: "Google Drive",
    notion: "Notion",
    confluence: "Confluence"
  };
  return sources[source];
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

type ProcessingJobCardProps = {
  isSelected: boolean;
  job: ProcessingJob;
  onViewDetails: () => void;
};

function ProcessingJobCard({ isSelected, job, onViewDetails }: ProcessingJobCardProps) {
  return (
    <article
      className={`knowledge-base-rag-processing-job${
        isSelected ? " knowledge-base-rag-processing-job--selected" : ""
      }`}
      role="listitem"
    >
      <div className="knowledge-base-rag-processing-job__header">
        <div>
          <h3>{job.documentName}</h3>
          <p>{job.currentStep}</p>
        </div>
        <div className="knowledge-base-rag-processing-job__badges">
          <KnowledgeBaseFileTypeBadge type={job.fileType} />
          <ProcessingStatusBadge status={job.status} />
        </div>
      </div>

      <ProcessingProgressBar
        label="Progress"
        status={job.status}
        value={job.progress}
        className="knowledge-base-rag-processing-job__progress"
      />

      <KnowledgeBaseMetadataList
        className="knowledge-base-rag-processing-job__metadata"
        items={createJobMetadata(job)}
      />

      {job.safeErrorMessage ? (
        <p className="knowledge-base-rag-processing-job__error">{job.safeErrorMessage}</p>
      ) : null}

      <div className="knowledge-base-rag-processing-job__actions">
        <button type="button" onClick={onViewDetails}>
          View details
        </button>
        {job.status === "failed" ? (
          <button
            type="button"
            disabled
            title="Retry is not implemented yet."
          >
            Retry failed job
          </button>
        ) : null}
      </div>
    </article>
  );
}

function createProcessingStatusMetrics(jobs: ProcessingJob[]): ProcessingStatusMetrics {
  return {
    total: jobs.length,
    queued: countJobsByStatus(jobs, "queued"),
    processing: countJobsByStatus(jobs, "processing"),
    completed: countJobsByStatus(jobs, "completed"),
    failed: countJobsByStatus(jobs, "failed")
  };
}

function countJobsByStatus(
  jobs: ProcessingJob[],
  status: KnowledgeBaseProcessingJobStatus
): number {
  return jobs.filter((job) => job.status === status).length;
}

function createJobMetadata(job: ProcessingJob) {
  return [
    { label: "Source", value: job.sourceName },
    { label: "MIME / type", value: job.mediaType },
    { label: "Started", value: job.startedAt },
    ...(job.completedAt ? [{ label: "Completed", value: job.completedAt }] : []),
    ...(job.failedAt ? [{ label: "Failed", value: job.failedAt }] : []),
    { label: "Current step", value: job.currentStep }
  ];
}

function ProcessingJobDetails({
  job,
  onClose
}: {
  job: ProcessingJob;
  onClose: () => void;
}) {
  const indexingSummary =
    job.chunkCount === undefined
      ? "Not available"
      : `${job.indexedChunkCount ?? 0} of ${job.chunkCount} chunks indexed`;

  return (
    <div
      className="knowledge-base-rag-processing-details-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-job-details-title"
    >
      <div className="knowledge-base-rag-processing-details-modal__backdrop" onClick={onClose} />
      <section className="knowledge-base-rag-processing-details-modal__panel">
        <header className="knowledge-base-rag-processing-details-modal__header">
          <div>
            <p>Processing job details</p>
            <h2 id="processing-job-details-title">{job.documentName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close processing job details">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="knowledge-base-rag-processing-details-modal__statuses">
          <div>
            <span>Document status</span>
            <strong>{formatDocumentStatus(job.documentStatus)}</strong>
          </div>
          <div>
            <span>Processing job status</span>
            <ProcessingStatusBadge status={job.status} />
          </div>
          <div>
            <span>Current step</span>
            <strong>{job.currentStep}</strong>
          </div>
        </div>

        <ProcessingProgressBar
          label="Processing progress"
          status={job.status}
          value={job.progress}
          className="knowledge-base-rag-processing-status-details__progress"
        />

        <KnowledgeBaseMetadataList
          className="knowledge-base-rag-processing-status-details__metadata"
          items={[
            ...createJobMetadata(job),
            { label: "Chunks", value: job.chunkCount ?? "Not available" },
            { label: "Indexing", value: indexingSummary },
            {
              label: "Retry",
              value:
                job.status === "failed"
                  ? "Not implemented yet"
                  : "Only available for failed jobs"
            }
          ]}
        />

        {job.safeErrorMessage ? (
          <div className="knowledge-base-rag-processing-status-details__error" role="alert">
            <strong>Failure reason</strong>
            <p>{job.safeErrorMessage}</p>
          </div>
        ) : null}

        <details className="knowledge-base-rag-processing-details-modal__debug">
          <summary>Debug details</summary>
          <dl>
            <div><dt>Job ID</dt><dd>{job.jobId}</dd></div>
            <div><dt>Document ID</dt><dd>{job.documentId}</dd></div>
          </dl>
        </details>

        <footer>
          {job.status === "failed" ? (
            <button type="button" disabled title="Retry is not implemented yet.">
              Retry failed job
            </button>
          ) : null}
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}

function formatDocumentStatus(status: ProcessingJob["documentStatus"]): string {
  const labels: Record<ProcessingJob["documentStatus"], string> = {
    pending: "Pending",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed"
  };
  return labels[status];
}

function ProcessingStatusBadge({ status }: { status: KnowledgeBaseProcessingJobStatus }) {
  return (
    <span className={`kb-rag-status-badge ${getProcessingStatusBadgeClassName(status)}`}>
      {getProcessingStatusLabel(status)}
    </span>
  );
}

type ProcessingProgressBarProps = {
  className?: string;
  label: string;
  status: KnowledgeBaseProcessingJobStatus;
  value: number;
};

function ProcessingProgressBar(props: ProcessingProgressBarProps) {
  const { className, label, status, value } = props;
  const progressValue = clampProgress(value);

  return (
    <div className={`knowledge-base-rag-processing-progress${className ? ` ${className}` : ""}`}>
      <div className="knowledge-base-rag-processing-progress__header">
        <span className="knowledge-base-rag-processing-progress__label">{label}</span>
        <span className="knowledge-base-rag-processing-progress__value">{progressValue}%</span>
      </div>
      <div
        className="knowledge-base-rag-processing-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressValue}
        aria-label={label}
      >
        <span
          className={`knowledge-base-rag-processing-progress__fill knowledge-base-rag-processing-progress__fill--${status}`}
          style={{ width: `${progressValue}%` }}
        />
      </div>
    </div>
  );
}

function getProcessingStatusLabel(status: KnowledgeBaseProcessingJobStatus): string {
  const labels: Record<KnowledgeBaseProcessingJobStatus, string> = {
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed"
  };

  return labels[status];
}

function getProcessingStatusBadgeClassName(
  status: KnowledgeBaseProcessingJobStatus
): string {
  if (status === "queued") return "kb-rag-status-badge--pending";
  return `kb-rag-status-badge--${status}`;
}

function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}
