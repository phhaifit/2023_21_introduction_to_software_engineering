import { Buffer } from "node:buffer";
import type { Request } from "express";

import {
  MAX_UPLOAD_CANDIDATE_SIZE_BYTES,
  type UploadedKnowledgeFile
} from "../application/knowledge-upload-use-cases.ts";
import { KnowledgeBaseRagValidationError } from "../application/knowledge-base-rag-errors.ts";

const MAX_MULTIPART_FILE_COUNT = 10;
const MAX_MULTIPART_TOTAL_BYTES =
  MAX_UPLOAD_CANDIDATE_SIZE_BYTES * MAX_MULTIPART_FILE_COUNT + 1024 * 1024;

export async function parseKnowledgeUploadMultipartRequest(
  request: Request
): Promise<UploadedKnowledgeFile[]> {
  const contentType = request.header("content-type") ?? "";
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    throw new KnowledgeBaseRagValidationError(["upload request must be multipart/form-data"]);
  }

  const body = await readRequestBody(request);
  const files = parseMultipartFiles(body, boundary);
  if (files.length === 0) {
    throw new KnowledgeBaseRagValidationError(["upload request must include at least one file"]);
  }

  return files;
}

async function readRequestBody(request: Request): Promise<Buffer> {
  const declaredLength = Number(request.header("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_TOTAL_BYTES) {
    throw new KnowledgeBaseRagValidationError(["upload request exceeds the configured limit"]);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_MULTIPART_TOTAL_BYTES) {
      throw new KnowledgeBaseRagValidationError(["upload request exceeds the configured limit"]);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function parseMultipartFiles(body: Buffer, boundary: string): UploadedKnowledgeFile[] {
  const parts = splitBuffer(body, Buffer.from(`--${boundary}`));
  const files: UploadedKnowledgeFile[] = [];

  for (const rawPart of parts) {
    const part = trimPart(rawPart);
    if (part.byteLength === 0 || part.equals(Buffer.from("--"))) {
      continue;
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) {
      continue;
    }

    const headerBlock = part.subarray(0, headerEnd).toString("utf8");
    const content = trimTrailingLineBreak(part.subarray(headerEnd + 4));
    const headers = parseHeaders(headerBlock);
    const disposition = parseContentDisposition(headers.get("content-disposition") ?? "");
    const fileName = disposition.filename?.trim();
    const fieldName = disposition.name?.trim();

    if (!fileName || (fieldName !== "file" && fieldName !== "files" && fieldName !== "document")) {
      continue;
    }
    if (content.byteLength > MAX_UPLOAD_CANDIDATE_SIZE_BYTES) {
      throw new KnowledgeBaseRagValidationError(["uploaded file exceeds the configured limit"]);
    }

    files.push({
      clientFileId: `upload-${files.length + 1}`,
      fileName,
      mediaType: headers.get("content-type")?.trim() || inferMediaType(fileName),
      content
    });

    if (files.length > MAX_MULTIPART_FILE_COUNT) {
      throw new KnowledgeBaseRagValidationError(["upload request includes too many files"]);
    }
  }

  return files;
}

function parseBoundary(contentType: string): string | null {
  const match = contentType.match(/(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? (match[1] ?? match[2]).trim() : null;
}

function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);

  while (index >= 0) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.byteLength;
    index = buffer.indexOf(delimiter, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function trimPart(part: Buffer): Buffer {
  let start = 0;
  let end = part.byteLength;

  if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) {
    start = 2;
  }
  if (part.subarray(end - 2, end).equals(Buffer.from("\r\n"))) {
    end -= 2;
  }

  return part.subarray(start, end);
}

function trimTrailingLineBreak(content: Buffer): Buffer {
  if (content.subarray(content.byteLength - 2).equals(Buffer.from("\r\n"))) {
    return content.subarray(0, content.byteLength - 2);
  }
  return content;
}

function parseHeaders(headerBlock: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const line of headerBlock.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    headers.set(
      line.slice(0, separatorIndex).trim().toLowerCase(),
      line.slice(separatorIndex + 1).trim()
    );
  }
  return headers;
}

function parseContentDisposition(value: string): { name?: string; filename?: string } {
  const result: { name?: string; filename?: string } = {};
  for (const segment of value.split(";")) {
    const [rawKey, ...rawValueParts] = segment.trim().split("=");
    const rawValue = rawValueParts.join("=");
    if (!rawKey || !rawValue) continue;
    const key = rawKey.toLowerCase();
    const parsedValue = rawValue.replace(/^"|"$/g, "");
    if (key === "name") result.name = parsedValue;
    if (key === "filename") result.filename = parsedValue;
  }
  return result;
}

function inferMediaType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowerName.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}
