import { Buffer } from "node:buffer";

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
import type { KnowledgeFileStorage } from "./knowledge-file-storage.ts";
import type { KnowledgeDocument } from "../domain/knowledge-document.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import { toIngestionJobDto, toKnowledgeDocumentDto } from "./dto-mappers.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeFileStorageError
} from "./knowledge-base-rag-errors.ts";

export const SUPPORTED_UPLOAD_MEDIA_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/csv",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream"
] as const;

export const MAX_UPLOAD_CANDIDATE_SIZE_BYTES = 25 * 1024 * 1024;

export type KnowledgeUploadUseCaseDependencies = {
  documentRepository: KnowledgeDocumentRepository;
  ingestionJobRepository: KnowledgeIngestionJobRepository;
  fileStorage?: KnowledgeFileStorage;
  now: () => string;
  generateDocumentId: () => EntityId<"documentId">;
  generateJobId: () => EntityId<"jobId">;
  postUploadProcessor?: {
    process(input: {
      workspaceId: EntityId<"workspaceId">;
      jobId: EntityId<"jobId">;
    }): Promise<{
      document: KnowledgeDocument;
      job: KnowledgeIngestionJob;
    }>;
  };
};

export type UploadedKnowledgeFile = {
  clientFileId: string;
  fileName: string;
  mediaType: string;
  content: Uint8Array;
};

export type ExternalKnowledgeFile = {
  sourceId: string;
  externalId: string;
  sourceModifiedAt: string;
  fileName: string;
  mediaType: string;
  content: Uint8Array;
  existingDocument?: KnowledgeDocument;
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

    for (const rawFile of request.files) {
      const file = normalizeManualUploadCandidate(rawFile);
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

  async uploadDocuments(
    workspaceId: EntityId<"workspaceId">,
    actorId: EntityId<"userId">,
    files: readonly UploadedKnowledgeFile[]
  ): Promise<PrepareUploadResponse> {
    this.assertWorkspaceId(workspaceId);
    if (!actorId) {
      throw new KnowledgeBaseRagValidationError(["actorId is required"]);
    }
    if (!this.dependencies.fileStorage) {
      throw new KnowledgeFileStorageError();
    }

    const normalizedFiles = files.map(normalizeManualUploadedFile);
    const candidates = normalizedFiles.map((file) => ({
      clientFileId: file.clientFileId,
      fileName: file.fileName,
      mediaType: file.mediaType,
      sizeBytes: file.content.byteLength
    }));
    const validation = await this.validateUploadCandidates(workspaceId, { files: candidates });
    const rejected = validation.results.filter((result) => result.status === "rejected");
    if (rejected.length > 0) {
      throw new KnowledgeBaseRagValidationError(
        rejected.map((result) => `${result.fileName}: ${result.reasonCode}`)
      );
    }

    const contentIssues = normalizedFiles.flatMap((file) =>
      this.validateUploadedContent(file)
    );
    if (contentIssues.length > 0) {
      throw new KnowledgeBaseRagValidationError(contentIssues);
    }

    const timestamp = this.dependencies.now();
    const documents = [];
    const jobs = [];

    for (const file of normalizedFiles) {
      const documentId = this.dependencies.generateDocumentId();
      const candidate = {
        clientFileId: file.clientFileId,
        fileName: file.fileName,
        mediaType: file.mediaType,
        sizeBytes: file.content.byteLength
      };
      let storedFile;

      try {
        storedFile = await this.dependencies.fileStorage.store({
          workspaceId,
          documentId,
          fileName: file.fileName.trim(),
          mediaType: file.mediaType,
          content: file.content
        });
      } catch {
        throw new KnowledgeFileStorageError();
      }

      try {
        const document = await this.dependencies.documentRepository.saveDocument({
          documentId,
          workspaceId,
          uploadedByUserId: actorId,
          displayName: candidate.fileName.trim(),
          fileName: candidate.fileName.trim(),
          mimeType: candidate.mediaType,
          fileType: inferFileType(candidate),
          sizeBytes: storedFile.sizeBytes,
          sourceType: "upload",
          storageKey: storedFile.storageKey,
          contentHash: storedFile.contentHash,
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

        if (this.dependencies.postUploadProcessor) {
          const processed = await this.dependencies.postUploadProcessor.process({
            workspaceId,
            jobId: ingestionJob.jobId
          });
          documents.push(toKnowledgeDocumentDto(processed.document));
          jobs.push(toIngestionJobDto(processed.job));
        } else {
          documents.push(toKnowledgeDocumentDto(document));
          jobs.push(toIngestionJobDto(ingestionJob));
        }
      } catch (error) {
        await this.cleanupStoredFile(storedFile.storageKey);
        throw error;
      }
    }

    return {
      documents,
      ingestionJobs: jobs
    };
  }

  async importExternalFile(
    workspaceId: EntityId<"workspaceId">,
    actorId: EntityId<"userId">,
    file: ExternalKnowledgeFile
  ): Promise<{ document: KnowledgeDocument; job: KnowledgeIngestionJob }> {
    if (!this.dependencies.fileStorage) throw new KnowledgeFileStorageError();
    const normalizedMediaType =
      file.mediaType === "text/csv" || file.mediaType === "text/markdown"
        ? "text/plain"
        : file.mediaType;
    const candidate = {
      clientFileId: file.externalId,
      fileName: normalizeExternalFileName(file.fileName, normalizedMediaType),
      mediaType: normalizedMediaType,
      content: file.content
    };
    const issues = this.validateUploadedContent(candidate);
    if (
      !SUPPORTED_UPLOAD_MEDIA_TYPES.includes(normalizedMediaType as never) ||
      issues.length > 0
    ) {
      throw new KnowledgeBaseRagValidationError([
        `${file.fileName}: unsupported_or_invalid_external_file`
      ]);
    }
    const now = this.dependencies.now();
    const documentId =
      file.existingDocument?.documentId ?? this.dependencies.generateDocumentId();
    const stored = await this.dependencies.fileStorage.store({
      workspaceId,
      documentId,
      fileName: candidate.fileName,
      mediaType: normalizedMediaType,
      content: candidate.content
    });
    if (file.existingDocument) {
      await this.dependencies.documentRepository.deleteDocumentChunks(
        workspaceId,
        documentId
      );
    }
    const document = await this.dependencies.documentRepository.saveDocument({
      documentId,
      workspaceId,
      uploadedByUserId: actorId,
      displayName: file.fileName,
      fileName: candidate.fileName,
      mimeType: normalizedMediaType,
      fileType: inferFileType({
        fileName: candidate.fileName,
        mediaType: normalizedMediaType
      }),
      sizeBytes: stored.sizeBytes,
      sourceType: "google_drive",
      sourceId: file.sourceId,
      storageKey: stored.storageKey,
      contentHash: stored.contentHash,
      externalId: file.externalId,
      sourceModifiedAt: file.sourceModifiedAt,
      lastSyncedAt: now,
      status: "pending",
      ingestionStatus: "pending",
      indexingStatus: "pending",
      chunkCount: 0,
      indexedChunkCount: 0,
      createdAt: file.existingDocument?.createdAt ?? now,
      updatedAt: now
    });
    const job = await this.dependencies.ingestionJobRepository.saveIngestionJob({
      jobId: this.dependencies.generateJobId(),
      workspaceId,
      documentId,
      status: "pending",
      progress: 0,
      queuedAt: now,
      requestedByUserId: actorId,
      createdAt: now,
      updatedAt: now
    });
    if (!this.dependencies.postUploadProcessor) return { document, job };
    return this.dependencies.postUploadProcessor.process({
      workspaceId,
      jobId: job.jobId
    });
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

    const mediaType = file.mediaType.trim().toLowerCase();
    if (!SUPPORTED_UPLOAD_MEDIA_TYPES.includes(mediaType as never)) {
      return {
        reasonCode: "unsupported_media_type",
        message: "File type is not supported for knowledge ingestion."
      };
    }

    if (!canonicalManualUploadMediaType(fileName, mediaType)) {
      return {
        reasonCode: "file_type_mismatch",
        message: "File extension does not match the declared media type."
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

  private validateUploadedContent(file: UploadedKnowledgeFile): string[] {
    const mediaType = file.mediaType;
    const content = file.content;
    const prefix = Buffer.from(content.subarray(0, 4)).toString("utf8");

    if (mediaType === "application/pdf" && !prefix.startsWith("%PDF")) {
      return [`${file.fileName}: invalid_file_content`];
    }
    if (
      mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      !(content[0] === 0x50 && content[1] === 0x4b)
    ) {
      return [`${file.fileName}: invalid_file_content`];
    }
    if (isUtf8TextMediaType(mediaType)) {
      if (content.includes(0)) {
        return [`${file.fileName}: invalid_file_content`];
      }
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(content);
      } catch {
        return [`${file.fileName}: invalid_file_content`];
      }
    }

    return [];
  }

  private async cleanupStoredFile(storageKey: string): Promise<void> {
    try {
      await this.dependencies.fileStorage?.remove(storageKey);
    } catch {
      // Best-effort cleanup only. The caller receives the original safe failure.
    }
  }
}

function normalizeExternalFileName(fileName: string, mediaType: string): string {
  if (mediaType === "text/plain" && !/\.(txt|md|csv)$/i.test(fileName)) {
    return `${fileName}.txt`;
  }
  return fileName;
}

function inferFileType(file: UploadCandidateFileDto): string {
  const lowerName = file.fileName.toLowerCase();
  const extension = lowerName.includes(".") ? lowerName.split(".").pop() : undefined;

  return extension || file.mediaType.split("/").pop() || "unknown";
}

function normalizeManualUploadCandidate<T extends UploadCandidateFileDto>(file: T): T {
  return {
    ...file,
    mediaType:
      canonicalManualUploadMediaType(file.fileName, file.mediaType) ??
      file.mediaType.trim().toLowerCase()
  };
}

function normalizeManualUploadedFile(file: UploadedKnowledgeFile): UploadedKnowledgeFile {
  return {
    ...file,
    mediaType:
      canonicalManualUploadMediaType(file.fileName, file.mediaType) ??
      file.mediaType.trim().toLowerCase()
  };
}

function canonicalManualUploadMediaType(
  fileName: string,
  declaredMediaType: string
): string | null {
  const mediaType = declaredMediaType.trim().toLowerCase();
  const extension = fileName.trim().toLowerCase().match(/(\.[^.]+)$/)?.[1];
  const octetStream = mediaType === "application/octet-stream";

  if (extension === ".pdf" && (mediaType === "application/pdf" || octetStream)) {
    return "application/pdf";
  }
  if (
    extension === ".docx" &&
    (mediaType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      octetStream)
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === ".txt" && (mediaType === "text/plain" || octetStream)) {
    return "text/plain";
  }
  if (
    extension === ".csv" &&
    (mediaType === "text/csv" ||
      mediaType === "application/csv" ||
      mediaType === "text/plain" ||
      octetStream)
  ) {
    return "text/csv";
  }
  if (
    (extension === ".md" || extension === ".markdown") &&
    (mediaType === "text/markdown" ||
      mediaType === "text/x-markdown" ||
      mediaType === "text/plain" ||
      octetStream)
  ) {
    return "text/markdown";
  }
  return null;
}

function isUtf8TextMediaType(mediaType: string): boolean {
  return (
    mediaType === "text/plain" ||
    mediaType === "text/csv" ||
    mediaType === "text/markdown"
  );
}
