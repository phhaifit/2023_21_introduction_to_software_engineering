import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export class KnowledgeBaseRagValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid Knowledge Base / RAG request: ${issues.join(", ")}`);
    this.name = "KnowledgeBaseRagValidationError";
    this.issues = issues;
  }
}

export class KnowledgeFileStorageError extends Error {
  constructor(message = "Document storage is temporarily unavailable.") {
    super(message);
    this.name = "KnowledgeFileStorageError";
  }
}

export class KnowledgeDocumentNotFoundError extends Error {
  constructor(documentId: EntityId<"documentId">) {
    super(`Knowledge document not found: ${documentId}`);
    this.name = "KnowledgeDocumentNotFoundError";
  }
}

export class KnowledgeIngestionJobNotFoundError extends Error {
  constructor(jobId: EntityId<"jobId">) {
    super(`Knowledge ingestion job not found: ${jobId}`);
    this.name = "KnowledgeIngestionJobNotFoundError";
  }
}

export class KnowledgeDataSourceNotFoundError extends Error {
  constructor(sourceId: string) {
    super(`Knowledge data source not found: ${sourceId}`);
    this.name = "KnowledgeDataSourceNotFoundError";
  }
}

export class KnowledgeSyncJobNotFoundError extends Error {
  constructor(jobId: EntityId<"jobId">) {
    super(`Knowledge sync job not found: ${jobId}`);
    this.name = "KnowledgeSyncJobNotFoundError";
  }
}

export class KnowledgeRetrievalError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeRetrievalError";
    this.errorCode = errorCode;
  }
}

export class KnowledgeRagAnswerError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeRagAnswerError";
    this.errorCode = errorCode;
  }
}
