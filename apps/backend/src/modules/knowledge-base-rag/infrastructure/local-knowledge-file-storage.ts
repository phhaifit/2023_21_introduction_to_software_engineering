import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type {
  KnowledgeFileStorage,
  KnowledgeFileStorageInput,
  StoredKnowledgeFile
} from "../application/knowledge-file-storage.ts";

export const DEFAULT_KNOWLEDGE_FILE_STORAGE_ROOT = ".data/knowledge-base-rag/uploads";

export class LocalKnowledgeFileStorage implements KnowledgeFileStorage {
  private readonly rootDirectory: string;

  constructor(rootDirectory = resolveDefaultStorageRoot()) {
    this.rootDirectory = resolve(rootDirectory);
  }

  async store(input: KnowledgeFileStorageInput): Promise<StoredKnowledgeFile> {
    const content = Buffer.from(input.content);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const extension = inferSafeExtension(input.fileName, input.mediaType);
    const storageKey = [
      "workspaces",
      sanitizeSegment(input.workspaceId),
      "documents",
      sanitizeSegment(input.documentId),
      `${contentHash}${extension}`
    ].join("/");
    const targetPath = this.resolveStoragePath(storageKey);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, { flag: "wx" }).catch(async (error: unknown) => {
      if (isFileExistsError(error)) {
        await writeFile(targetPath, content);
        return;
      }
      throw error;
    });

    return {
      storageKey,
      contentHash,
      sizeBytes: content.byteLength
    };
  }

  async remove(storageKey: string): Promise<void> {
    const targetPath = this.resolveStoragePath(storageKey);
    await rm(targetPath, { force: true });
  }

  async read(storageKey: string): Promise<Uint8Array> {
    const targetPath = this.resolveStoragePath(storageKey);
    return readFile(targetPath);
  }

  private resolveStoragePath(storageKey: string): string {
    const segments = storageKey.split("/");
    if (
      segments.some(
        (segment) =>
          segment.trim() === "" ||
          segment === "." ||
          segment === ".." ||
          segment.includes("\\") ||
          isAbsolute(segment)
      )
    ) {
      throw new Error("Invalid storage key.");
    }

    const targetPath = resolve(this.rootDirectory, ...segments);
    const relativePath = relative(this.rootDirectory, targetPath);
    if (relativePath.startsWith("..") || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
      throw new Error("Invalid storage key.");
    }

    return targetPath;
  }
}

function isFileExistsError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}

function inferSafeExtension(fileName: string, mediaType: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf") || mediaType === "application/pdf") return ".pdf";
  if (
    lowerName.endsWith(".docx") ||
    mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ".docx";
  }
  if (lowerName.endsWith(".txt") || mediaType === "text/plain") return ".txt";
  return ".bin";
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "unknown";
}

function resolveDefaultStorageRoot(): string {
  if (process.env.KNOWLEDGE_FILE_STORAGE_DIR) {
    return resolve(process.env.KNOWLEDGE_FILE_STORAGE_DIR);
  }

  return join(findRepositoryRoot(process.cwd()), DEFAULT_KNOWLEDGE_FILE_STORAGE_ROOT);
}

function findRepositoryRoot(startDirectory: string): string {
  let current = resolve(startDirectory);

  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "apps")) &&
      existsSync(join(current, "packages"))
    ) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(startDirectory);
    }
    current = parent;
  }
}
