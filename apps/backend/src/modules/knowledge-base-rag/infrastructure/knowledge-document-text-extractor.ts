import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import {
  KnowledgeDocumentParserError,
  type ExtractedKnowledgeText,
  type KnowledgeDocumentExtractionInput,
  type KnowledgeDocumentTextExtractor
} from "../application/knowledge-document-text-extractor.ts";
import { normalizeKnowledgeDocumentText } from "../worker/knowledge-document-text-normalizer.ts";

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class RuntimeKnowledgeDocumentTextExtractor
  implements KnowledgeDocumentTextExtractor
{
  async extract(
    input: KnowledgeDocumentExtractionInput
  ): Promise<ExtractedKnowledgeText> {
    const mediaType = input.attribution.mediaType.toLowerCase();

    try {
      const rawText =
        mediaType === "text/plain" ||
        mediaType === "text/markdown" ||
        mediaType === "text/csv"
          ? extractTxt(input.content)
          : mediaType === DOCX_MEDIA_TYPE
            ? await extractDocx(input.content)
            : mediaType === "application/pdf"
              ? await extractPdf(input.content)
              : unsupportedType();
      const text = normalizeKnowledgeDocumentText(rawText);

      if (!text) {
        throw new KnowledgeDocumentParserError(
          "knowledge.document_extraction_empty",
          "Knowledge document contains no usable text."
        );
      }

      return {
        text,
        characterCount: text.length,
        attribution: { ...input.attribution }
      };
    } catch (error) {
      if (error instanceof KnowledgeDocumentParserError) {
        throw error;
      }

      throw new KnowledgeDocumentParserError(
        "knowledge.document_extraction_failed",
        "Knowledge document text could not be extracted."
      );
    }
  }
}

function extractTxt(content: Uint8Array): string {
  if (content.includes(0)) {
    throw new KnowledgeDocumentParserError(
      "knowledge.document_extraction_invalid",
      "Knowledge document content is invalid or unreadable."
    );
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new KnowledgeDocumentParserError(
      "knowledge.document_extraction_invalid",
      "Knowledge document content is invalid or unreadable."
    );
  }
}

async function extractDocx(content: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(content) });
  return result.value;
}

async function extractPdf(content: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: content });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => page.text).join("\n\n");
  } finally {
    await parser.destroy();
  }
}

function unsupportedType(): never {
  throw new KnowledgeDocumentParserError(
    "knowledge.document_type_unsupported",
    "Knowledge document type is not supported for text extraction."
  );
}
