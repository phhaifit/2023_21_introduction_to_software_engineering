import { useMemo, useRef, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  PrepareUploadResponse,
  UploadCandidateFileDto,
  UploadValidationResponse,
  UploadValidationStatus as UploadValidationDtoStatus
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseFileTypeBadge,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import type {
  KnowledgeDocumentType,
  UploadValidationStatus
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-upload.css";

const supportedFileTypes: KnowledgeDocumentType[] = ["pdf", "docx", "txt", "csv", "page"];
const defaultApiClient = createKnowledgeBaseRagApiClient();

type UploadValidationDisplayStatus = UploadValidationStatus | "pending";

type UploadCandidateFileView = {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  validationStatus: UploadValidationDisplayStatus;
  validationMessage: string;
};

export type KnowledgeBaseUploadScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  onUploadPrepared?: (response: PrepareUploadResponse) => void;
  workspaceId?: EntityId<"workspaceId">;
};

export function KnowledgeBaseUploadScreen(props: KnowledgeBaseUploadScreenProps) {
  const {
    apiClient = defaultApiClient,
    onUploadPrepared,
    workspaceId = DEMO_WORKSPACE_ID
  } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [candidateFiles, setCandidateFiles] = useState<UploadCandidateFileDto[]>([]);
  const [validationResponse, setValidationResponse] =
    useState<UploadValidationResponse | null>(null);
  const [operationState, setOperationState] = useState<"idle" | "validating" | "preparing">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const candidateFileViews = useMemo(
    () => createCandidateFileViews(candidateFiles, validationResponse),
    [candidateFiles, validationResponse]
  );
  const validCandidateFiles = useMemo(
    () => getAcceptedCandidates(candidateFiles, validationResponse),
    [candidateFiles, validationResponse]
  );
  const metrics = useMemo(() => createUploadMetrics(candidateFileViews), [candidateFileViews]);
  const isBusy = operationState !== "idle";

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelection(files: FileList | null) {
    const nextCandidates = files ? Array.from(files).map(toUploadCandidateFileDto) : [];

    setCandidateFiles(nextCandidates);
    setValidationResponse(null);
    setSuccessMessage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (nextCandidates.length === 0) {
      setErrorMessage(null);
      return;
    }

    await validateCandidates(nextCandidates);
  }

  async function validateCandidates(files: UploadCandidateFileDto[]) {
    setOperationState("validating");
    setErrorMessage(null);

    try {
      const response = await apiClient.validateUploadCandidates(workspaceId, { files });
      setValidationResponse(response);
    } catch (error: unknown) {
      setValidationResponse(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationState("idle");
    }
  }

  async function handlePrepareUpload() {
    if (validCandidateFiles.length === 0 || isBusy) return;

    setOperationState("preparing");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiClient.prepareUpload(workspaceId, {
        files: validCandidateFiles
      });
      const preparedCount = response.documents.length;
      setSuccessMessage(
        `Prepared ${preparedCount} ${preparedCount === 1 ? "document" : "documents"} for ingestion.`
      );
      onUploadPrepared?.(response);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationState("idle");
    }
  }

  return (
    <div className="knowledge-base-rag-upload">
      <section className="knowledge-base-rag-upload-zone" aria-labelledby="kb-rag-upload-title">
        <div className="knowledge-base-rag-upload-zone__icon" aria-hidden="true" />
        <div>
          <h2 id="kb-rag-upload-title">Drop files here or browse from your workspace</h2>
          <p>Supported formats: PDF, DOCX, TXT. Files are reviewed before ingestion.</p>
        </div>
        <input
          ref={fileInputRef}
          aria-label="Choose documents to validate"
          className="knowledge-base-rag-upload-zone__input"
          multiple
          onChange={(event) => void handleFileSelection(event.currentTarget.files)}
          type="file"
        />
        <button type="button" disabled={isBusy} onClick={handleBrowseClick}>
          {operationState === "validating" ? "Validating..." : "Browse workspace files"}
        </button>
      </section>

      {errorMessage ? (
        <div className="knowledge-base-rag-upload-feedback" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="knowledge-base-rag-upload-feedback knowledge-base-rag-upload-feedback--success"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

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
        {operationState === "validating" ? (
          <div className="knowledge-base-rag-upload-feedback" role="status">
            Validating selected files...
          </div>
        ) : null}

        {candidateFileViews.length > 0 ? (
          <div className="knowledge-base-rag-upload-list" role="list">
            {candidateFileViews.map((file) => (
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
        <button
          type="button"
          disabled={validCandidateFiles.length === 0 || isBusy}
          onClick={() => void handlePrepareUpload()}
        >
          {operationState === "preparing" ? "Preparing..." : "Prepare valid files"}
        </button>
      </section>
    </div>
  );
}

type UploadCandidateFileItemProps = {
  file: UploadCandidateFileView;
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

function createUploadMetrics(files: UploadCandidateFileView[]) {
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
  files: UploadCandidateFileView[],
  status: UploadValidationStatus
): number {
  return files.filter((file) => file.validationStatus === status).length;
}

function getValidationLabel(status: UploadValidationDisplayStatus): string {
  if (status === "pending") return "Pending";
  return status === "valid" ? "Ready" : "Needs attention";
}

function getFileTypeLabel(type: string): string {
  return isSupportedFileType(type) ? type.toUpperCase() : "Unsupported";
}

function isSupportedFileType(type: string): type is KnowledgeDocumentType {
  return supportedFileTypes.includes(type as KnowledgeDocumentType);
}

function toUploadCandidateFileDto(file: File, index: number): UploadCandidateFileDto {
  return {
    clientFileId: createClientFileId(file, index),
    fileName: file.name,
    mediaType: file.type || inferMediaType(file.name),
    sizeBytes: file.size
  };
}

function createCandidateFileViews(
  files: UploadCandidateFileDto[],
  validationResponse: UploadValidationResponse | null
): UploadCandidateFileView[] {
  const resultsById = new Map(
    validationResponse?.results.map((result) => [result.clientFileId, result]) ?? []
  );

  return files.map((file) => {
    const result = resultsById.get(file.clientFileId);
    const validationStatus = mapValidationStatus(result?.status);

    return {
      id: file.clientFileId,
      name: file.fileName,
      type: inferDocumentType(file.mediaType, file.fileName),
      sizeLabel: formatFileSize(file.sizeBytes),
      validationStatus,
      validationMessage:
        result?.message ??
        (validationStatus === "pending"
          ? "Waiting for API validation."
          : "File metadata passed validation.")
    };
  });
}

function getAcceptedCandidates(
  files: UploadCandidateFileDto[],
  validationResponse: UploadValidationResponse | null
): UploadCandidateFileDto[] {
  const acceptedIds = new Set(
    validationResponse?.results
      .filter((result) => result.status === "accepted")
      .map((result) => result.clientFileId) ?? []
  );

  return files.filter((file) => acceptedIds.has(file.clientFileId));
}

function mapValidationStatus(status?: UploadValidationDtoStatus): UploadValidationDisplayStatus {
  if (!status) return "pending";
  return status === "accepted" ? "valid" : "invalid";
}

function createClientFileId(file: File, index: number): string {
  return `candidate-${index}-${hashString(`${file.name}:${file.size}:${file.lastModified}`)}`;
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function inferMediaType(fileName: string): string {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith(".pdf")) return "application/pdf";
  if (normalizedName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (normalizedName.endsWith(".csv")) return "text/csv";
  if (normalizedName.endsWith(".txt")) return "text/plain";

  return "application/octet-stream";
}

function inferDocumentType(mediaType: string, fileName: string): KnowledgeDocumentType | string {
  const normalizedMediaType = mediaType.toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (normalizedMediaType.includes("pdf") || normalizedName.endsWith(".pdf")) return "pdf";
  if (
    normalizedMediaType.includes("word") ||
    normalizedMediaType.includes("officedocument") ||
    normalizedName.endsWith(".docx")
  ) {
    return "docx";
  }
  if (normalizedMediaType.includes("csv") || normalizedName.endsWith(".csv")) return "csv";
  if (normalizedMediaType.includes("text") || normalizedName.endsWith(".txt")) return "txt";

  return "unsupported";
}

function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Knowledge Base / RAG API could not be reached.";
}
