import type {
  PrepareUploadRequest,
  PrepareUploadResponse,
  UploadCandidateFileDto,
  UploadValidationRequest,
  UploadValidationResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentRepository } from "./knowledge-document-repository.ts";
import type { KnowledgeIngestionJobRepository } from "./knowledge-ingestion-job-repository.ts";
import { toIngestionJobDto, toKnowledgeDocumentDto } from "./dto-mappers.ts";
import { KnowledgeBaseRagValidationError } from "./knowledge-base-rag-errors.ts";

export const SUPPORTED_UPLOAD_MEDIA_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv"
] as const;

export const MAX_UPLOAD_CANDIDATE_SIZE_BYTES = 25 * 1024 * 1024;

export type KnowledgeUploadUseCaseDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  now: () => string;
  generateDocumentId: () => EntityId<"documentId">;
  generateJobId: () => EntityId<"jobId">;
};

export class KnowledgeUploadUseCases {
  private readonly dependencies: KnowledgeUploadUseCaseDependencies;

  constructor(dependencies: KnowledgeUploadUseCaseDependencies) {
    this.dependencies = dependencies;
  }

  async validateUploadCandidates(
    workspaceId: EntityId<"workspaceId">,
    request: UploadValidationRequest
  ): Promise<UploadValidationResponse> {
    this.assertWorkspaceId(workspaceId);
    const files = this.requireCandidateFiles(request.files);
    const seenNames = new Set<string>();

    const results = files.map((file) => {
      const issue = this.validateCandidate(file, seenNames);
      seenNames.add(file.fileName.trim().toLowerCase());

      return issue
        ? {
            clientFileId: file.clientFileId,
            fileName: file.fileName,
            status: "rejected" as const,
            reasonCode: issue.reasonCode,
            message: issue.message
          }
        : {
            clientFileId: file.clientFileId,
            fileName: file.fileName,
            status: "accepted" as const
          };
    });

    const acceptedCount = results.filter((result) => result.status === "accepted").length;

    return {
      results,
      acceptedCount,
      rejectedCount: results.length - acceptedCount
    };
  }

  async prepareUpload(
    workspaceId: EntityId<"workspaceId">,
    actorId: EntityId<"userId">,
    request: PrepareUploadRequest
  ): Promise<PrepareUploadResponse> {
    this.assertWorkspaceId(workspaceId);
    if (!actorId) {
      throw new KnowledgeBaseRagValidationError(["actorId is required"]);
    }

    const validation = await this.validateUploadCandidates(workspaceId, {
      files: request.files
    });
    const rejected = validation.results.filter((result) => result.status === "rejected");
    if (rejected.length > 0) {
      throw new KnowledgeBaseRagValidationError(
        rejected.map((result) => `${result.fileName}: ${result.reasonCode}`)
      );
    }

    const timestamp = this.dependencies.now();
    const documents = [];
    const jobs = [];

    for (const file of request.files) {
      const documentId = this.dependencies.generateDocumentId();
      const document = await this.dependencies.documentRepository.saveDocument({
        documentId,
        workspaceId,
        uploadedByUserId: actorId,
        displayName: file.fileName.trim(),
        fileName: file.fileName.trim(),
        mimeType: file.mediaType,
        fileType: inferFileType(file),
        sizeBytes: file.sizeBytes,
        sourceType: "upload",
        status: "pending",
        ingestionStatus: "pending",
        indexingStatus: "pending",
        chunkCount: 0,
        indexedChunkCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      const ingestionJob = await this.dependencies.ingestionJobRepository.saveIngestionJob({
        jobId: this.dependencies.generateJobId(),
        workspaceId,
        documentId,
        status: "pending",
        progress: 0,
        queuedAt: timestamp,
        requestedByUserId: actorId,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      documents.push(toKnowledgeDocumentDto(document));
      jobs.push(toIngestionJobDto(ingestionJob));
    }

    return {
      documents,
      ingestionJobs: jobs
    };
  }

  private assertWorkspaceId(workspaceId: EntityId<"workspaceId">): void {
    if (!workspaceId) {
      throw new KnowledgeBaseRagValidationError(["workspaceId is required"]);
    }
  }

  private requireCandidateFiles(
    files: readonly UploadCandidateFileDto[] | undefined
  ): readonly UploadCandidateFileDto[] {
    if (!files || files.length === 0) {
      throw new KnowledgeBaseRagValidationError(["at least one upload candidate is required"]);
    }

    return files;
  }

  private validateCandidate(
    file: UploadCandidateFileDto,
    seenNames: ReadonlySet<string>
  ): { reasonCode: string; message: string } | null {
    const fileName = file.fileName.trim();

    if (!file.clientFileId.trim()) {
      return {
        reasonCode: "missing_client_file_id",
        message: "Client file ID is required."
      };
    }

    if (!fileName) {
      return {
        reasonCode: "missing_file_name",
        message: "File name is required."
      };
    }

    if (seenNames.has(fileName.toLowerCase())) {
      return {
        reasonCode: "duplicate_file_name",
        message: "Duplicate file names are not accepted in one upload batch."
      };
    }

    if (!SUPPORTED_UPLOAD_MEDIA_TYPES.includes(file.mediaType as never)) {
      return {
        reasonCode: "unsupported_media_type",
        message: "File type is not supported for knowledge ingestion."
      };
    }

    if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
      return {
        reasonCode: "invalid_size",
        message: "File size must be greater than zero."
      };
    }

    if (file.sizeBytes > MAX_UPLOAD_CANDIDATE_SIZE_BYTES) {
      return {
        reasonCode: "file_too_large",
        message: "File size exceeds the configured upload candidate limit."
      };
    }

    return null;
  }
}

function inferFileType(file: UploadCandidateFileDto): string {
  const lowerName = file.fileName.toLowerCase();
  const extension = lowerName.includes(".") ? lowerName.split(".").pop() : undefined;

  return extension || file.mediaType.split("/").pop() || "unknown";
}

