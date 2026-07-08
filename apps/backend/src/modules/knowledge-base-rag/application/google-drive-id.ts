import { KnowledgeBaseRagValidationError } from "./knowledge-base-rag-errors.ts";

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{3,200}$/;

export function normalizeGoogleDriveItemId(value: string): string {
  const input = value.trim();
  if (!input) {
    throw invalidDriveItem();
  }

  let candidate = input;
  try {
    const url = new URL(input);
    const pathMatch = url.pathname.match(
      /\/(?:document\/d|spreadsheets\/d|presentation\/d|file\/d|drive\/folders)\/([^/]+)/
    );
    candidate = pathMatch?.[1] ?? "";
  } catch {
    candidate = input.split(/[/?#]/, 1)[0] ?? "";
  }

  if (!DRIVE_ID_PATTERN.test(candidate)) {
    throw invalidDriveItem();
  }
  return candidate;
}

function invalidDriveItem(): KnowledgeBaseRagValidationError {
  return new KnowledgeBaseRagValidationError([
    "Enter a valid Google Drive file or folder ID or URL."
  ]);
}
