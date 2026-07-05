import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type KnowledgeDocumentAttribution = {
  workspaceId: EntityId<"workspaceId">;
  documentId: EntityId<"documentId">;
  fileName: string;
  mediaType: string;
};

export type KnowledgeDocumentExtractionInput = {
  content: Uint8Array;
  attribution: KnowledgeDocumentAttribution;
};

export type ExtractedKnowledgeText = {
  text: string;
  characterCount: number;
  attribution: KnowledgeDocumentAttribution;
};

export type KnowledgeDocumentTextExtractor = {
  extract(input: KnowledgeDocumentExtractionInput): Promise<ExtractedKnowledgeText>;
};

export class KnowledgeDocumentParserError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "KnowledgeDocumentParserError";
    this.errorCode = errorCode;
  }
}
