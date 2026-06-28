export type SafeKnowledgeIndexingFailure = {
  errorCode: string;
  errorMessage: string;
};

export class KnowledgeDocumentIndexingError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeDocumentIndexingError";
    this.errorCode = errorCode;
  }
}

export function toSafeKnowledgeIndexingFailure(
  error: unknown
): SafeKnowledgeIndexingFailure {
  if (error instanceof KnowledgeDocumentIndexingError) {
    return {
      errorCode: error.errorCode,
      errorMessage: error.message
    };
  }

  return {
    errorCode: "knowledge.indexing_failed",
    errorMessage: "Knowledge document indexing failed."
  };
}
