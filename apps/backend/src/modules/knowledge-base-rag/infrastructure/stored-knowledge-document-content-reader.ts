import type { KnowledgeDocumentTextExtractor } from "../application/knowledge-document-text-extractor.ts";
import type { KnowledgeFileStorage } from "../application/knowledge-file-storage.ts";
import { KnowledgeDocumentParserError } from "../application/knowledge-document-text-extractor.ts";
import type {
  KnowledgeDocumentContentReader,
  KnowledgeDocumentContentReaderInput
} from "../worker/knowledge-document-content-reader.ts";

export class StoredKnowledgeDocumentContentReader
  implements KnowledgeDocumentContentReader
{
  private readonly storage: Pick<KnowledgeFileStorage, "read">;
  private readonly extractor: KnowledgeDocumentTextExtractor;

  constructor(
    storage: Pick<KnowledgeFileStorage, "read">,
    extractor: KnowledgeDocumentTextExtractor
  ) {
    this.storage = storage;
    this.extractor = extractor;
  }

  async readText(input: KnowledgeDocumentContentReaderInput): Promise<string> {
    const storageKey = input.document.storageKey;
    if (!storageKey) {
      throw new KnowledgeDocumentParserError(
        "knowledge.document_storage_missing",
        "Knowledge document content is unavailable."
      );
    }

    let content: Uint8Array;
    try {
      content = await this.storage.read(storageKey);
    } catch {
      throw new KnowledgeDocumentParserError(
        "knowledge.document_storage_read_failed",
        "Knowledge document content is unavailable."
      );
    }

    const result = await this.extractor.extract({
      content,
      attribution: {
        workspaceId: input.workspaceId,
        documentId: input.document.documentId,
        fileName: input.document.fileName,
        mediaType: input.document.mimeType
      }
    });
    return result.text;
  }
}
