export type GoogleDriveFile = {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  sizeBytes?: number;
  md5Checksum?: string;
  trashed: boolean;
  canDownload: boolean;
  parentIds: string[];
};

export type GoogleDriveDownloadedFile = {
  content: Uint8Array;
  mediaType: string;
  fileName: string;
};

export type GoogleDriveScope = {
  folderIds: string[];
  fileIds: string[];
  recursive: boolean;
  allowedMimeTypes: string[];
  maxFiles: number;
};

export type GoogleDriveProvider = {
  listFiles(accessToken: string, scope: GoogleDriveScope): Promise<GoogleDriveFile[]>;
  downloadFile(
    accessToken: string,
    file: GoogleDriveFile
  ): Promise<GoogleDriveDownloadedFile>;
};

export class GoogleDriveProviderError extends Error {
  readonly code:
    | "permission_denied"
    | "credential_invalid"
    | "rate_limited"
    | "quota_exceeded"
    | "api_disabled"
    | "insufficient_scope"
    | "not_found"
    | "unsupported_file"
    | "provider_unavailable";

  constructor(code: GoogleDriveProviderError["code"], message: string) {
    super(message);
    this.name = "GoogleDriveProviderError";
    this.code = code;
  }
}
