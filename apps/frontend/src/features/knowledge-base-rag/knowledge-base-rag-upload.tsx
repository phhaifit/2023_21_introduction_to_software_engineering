import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseFileTypeBadge,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import { mockUploadCandidateFiles } from "./knowledge-base-rag-mock-data.ts";
import type {
  KnowledgeDocumentType,
  UploadCandidateFile,
  UploadValidationStatus
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-upload.css";

const supportedFileTypes: KnowledgeDocumentType[] = ["pdf", "docx", "txt", "csv", "page"];

export function KnowledgeBaseUploadScreen() {
  const candidateFiles = mockUploadCandidateFiles;
  const metrics = createUploadMetrics(candidateFiles);

  return (
    <div className="knowledge-base-rag-upload">
      <section className="knowledge-base-rag-upload-zone" aria-labelledby="kb-rag-upload-title">
        <div className="knowledge-base-rag-upload-zone__icon" aria-hidden="true" />
        <div>
          <h2 id="kb-rag-upload-title">Drop files here or browse from your workspace</h2>
          <p>Supported formats: PDF, DOCX, TXT. Files are reviewed before ingestion.</p>
        </div>
        <button type="button" disabled>
          Browse workspace files
        </button>
      </section>

      <div className="knowledge-base-rag-upload-metrics" aria-label="Upload validation summary">
        <KnowledgeBaseMetricCard
          label="Selected files"
          value={metrics.total}
          helperText="Files staged for review"
        />
        <KnowledgeBaseMetricCard
          label="Valid files"
          value={metrics.valid}
          helperText="Files ready for ingestion"
        />
        <KnowledgeBaseMetricCard
          label="Invalid files"
          value={metrics.invalid}
          helperText="Files requiring changes"
        />
        <KnowledgeBaseMetricCard
          label="Ready for ingestion"
          value={metrics.readyForIngestion}
          helperText="Valid files in the current selection"
        />
      </div>

      <KnowledgeBaseSectionCard
        title="Selected files"
        eyebrow="Validation review"
        description="Review selected workspace files before preparing them for ingestion."
      >
        {candidateFiles.length > 0 ? (
          <div className="knowledge-base-rag-upload-list" role="list">
            {candidateFiles.map((file) => (
              <UploadCandidateFileItem file={file} key={file.id} />
            ))}
          </div>
        ) : (
          <KnowledgeBaseEmptyState
            title="No files selected"
            description="Select workspace files to review format and size before ingestion."
          />
        )}
      </KnowledgeBaseSectionCard>

      <section className="knowledge-base-rag-upload-action" aria-label="Upload preparation">
        <div>
          <h2>{metrics.readyForIngestion} files ready to prepare</h2>
          <p>Only valid files are included when preparing documents for ingestion.</p>
        </div>
        <button type="button" disabled>
          Prepare valid files
        </button>
      </section>
    </div>
  );
}

type UploadCandidateFileItemProps = {
  file: UploadCandidateFile;
};

function UploadCandidateFileItem({ file }: UploadCandidateFileItemProps) {
  return (
    <article
      className={`knowledge-base-rag-upload-file knowledge-base-rag-upload-file--${file.validationStatus}`}
      role="listitem"
    >
      <div className="knowledge-base-rag-upload-file__main">
        <div className="knowledge-base-rag-upload-file__header">
          <div>
            <h3>{file.name}</h3>
            <p>{file.validationMessage}</p>
          </div>
          <div className="knowledge-base-rag-upload-file__badges">
            <UploadFileTypeBadge type={file.type} />
            <KnowledgeBaseStatusBadge status={file.validationStatus} />
          </div>
        </div>

        <KnowledgeBaseMetadataList
          className="knowledge-base-rag-upload-file__metadata"
          items={[
            { label: "File type", value: getFileTypeLabel(file.type) },
            { label: "File size", value: file.sizeLabel },
            { label: "Review status", value: getValidationLabel(file.validationStatus) }
          ]}
        />
      </div>
    </article>
  );
}

function UploadFileTypeBadge({ type }: { type: string }) {
  if (isSupportedFileType(type)) {
    return <KnowledgeBaseFileTypeBadge type={type} />;
  }

  return <span className="knowledge-base-rag-upload-file__unsupported">Unsupported</span>;
}

function createUploadMetrics(files: UploadCandidateFile[]) {
  const valid = countFilesByStatus(files, "valid");
  const invalid = countFilesByStatus(files, "invalid");

  return {
    total: files.length,
    valid,
    invalid,
    readyForIngestion: valid
  };
}

function countFilesByStatus(
  files: UploadCandidateFile[],
  status: UploadValidationStatus
): number {
  return files.filter((file) => file.validationStatus === status).length;
}

function getValidationLabel(status: UploadValidationStatus): string {
  return status === "valid" ? "Ready" : "Needs attention";
}

function getFileTypeLabel(type: string): string {
  return isSupportedFileType(type) ? type.toUpperCase() : "Unsupported";
}

function isSupportedFileType(type: string): type is KnowledgeDocumentType {
  return supportedFileTypes.includes(type as KnowledgeDocumentType);
}
