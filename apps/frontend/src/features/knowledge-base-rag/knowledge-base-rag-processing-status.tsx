import { useMemo, useState } from "react";

import { mockProcessingJobs } from "./knowledge-base-rag-mock-data.ts";
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

export type KnowledgeBaseProcessingStatusScreenProps = {
  jobs?: ProcessingJob[];
};

export function KnowledgeBaseProcessingStatusScreen({
  jobs = mockProcessingJobs
}: KnowledgeBaseProcessingStatusScreenProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.jobId ?? null);
  const metrics = useMemo(() => createProcessingStatusMetrics(jobs), [jobs]);
  const selectedJob =
    jobs.find((job) => job.jobId === selectedJobId) ?? jobs[0] ?? null;

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
          <button type="button">Refresh status</button>
          <button type="button">Clear completed</button>
        </div>

        {jobs.length > 0 ? (
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
        ) : (
          <KnowledgeBaseEmptyState
            title="No processing jobs"
            description="Processing jobs will appear when workspace documents are prepared for ingestion and indexing."
          />
        )}
      </KnowledgeBaseSectionCard>

      {selectedJob ? (
        <KnowledgeBaseSectionCard
          title="Job details"
          eyebrow="Selected document"
          description="Review the selected job status, timing, and current processing step."
          className="knowledge-base-rag-processing-status-details"
        >
          <div className="knowledge-base-rag-processing-status-details__header">
            <div>
              <h3>{selectedJob.documentName}</h3>
              <p>{selectedJob.currentStep}</p>
            </div>
            <ProcessingStatusBadge status={selectedJob.status} />
          </div>

          <ProcessingProgressBar
            label="Progress"
            status={selectedJob.status}
            value={selectedJob.progress}
            className="knowledge-base-rag-processing-status-details__progress"
          />

          <KnowledgeBaseMetadataList
            className="knowledge-base-rag-processing-status-details__metadata"
            items={createJobMetadata(selectedJob)}
          />

          {selectedJob.safeErrorMessage ? (
            <p className="knowledge-base-rag-processing-status-details__error">
              {selectedJob.safeErrorMessage}
            </p>
          ) : null}
        </KnowledgeBaseSectionCard>
      ) : null}
    </div>
  );
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
        <button type="button" disabled={job.status !== "failed"}>
          Retry failed job
        </button>
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
    { label: "Started", value: job.startedAt },
    ...(job.completedAt ? [{ label: "Completed", value: job.completedAt }] : []),
    ...(job.failedAt ? [{ label: "Failed", value: job.failedAt }] : []),
    { label: "Current step", value: job.currentStep }
  ];
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
