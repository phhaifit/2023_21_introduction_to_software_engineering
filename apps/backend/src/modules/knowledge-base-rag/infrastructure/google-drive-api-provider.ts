import {
  GoogleDriveProviderError,
  type GoogleDriveDownloadedFile,
  type GoogleDriveFile,
  type GoogleDriveProvider,
  type GoogleDriveScope
} from "../application/google-drive-provider.ts";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";

export class GoogleDriveApiProvider implements GoogleDriveProvider {
  private readonly fetchImplementation: typeof fetch;

  constructor(fetchImplementation: typeof fetch = fetch) {
    this.fetchImplementation = fetchImplementation;
  }

  async listFiles(
    accessToken: string,
    scope: GoogleDriveScope
  ): Promise<GoogleDriveFile[]> {
    const files = new Map<string, GoogleDriveFile>();
    for (const fileId of scope.fileIds) {
      const file = await this.getMetadata(accessToken, fileId);
      files.set(file.fileId, file);
    }
    for (const folderId of scope.folderIds) {
      const discovered = await this.listFolder(accessToken, folderId, scope);
      for (const file of discovered) files.set(file.fileId, file);
    }
    return [...files.values()]
      .filter((file) => !file.trashed)
      .filter(
        (file) =>
          scope.allowedMimeTypes.length === 0 ||
          scope.allowedMimeTypes.includes(file.mimeType)
      )
      .slice(0, scope.maxFiles);
  }

  async downloadFile(
    accessToken: string,
    file: GoogleDriveFile
  ): Promise<GoogleDriveDownloadedFile> {
    if (!file.canDownload) {
      throw new GoogleDriveProviderError(
        "permission_denied",
        "Google Drive does not allow this file to be downloaded."
      );
    }

    let url: string;
    let mediaType = file.mimeType;
    let fileName = file.name;
    if (file.mimeType === GOOGLE_DOC) {
      mediaType = "text/plain";
      fileName = file.name.endsWith(".txt") ? file.name : `${file.name}.txt`;
      url = `${DRIVE_API}/files/${encodeURIComponent(file.fileId)}/export?mimeType=${encodeURIComponent(mediaType)}`;
    } else if (file.mimeType === GOOGLE_SHEET) {
      mediaType = "text/csv";
      fileName = file.name.endsWith(".csv") ? file.name : `${file.name}.csv`;
      url = `${DRIVE_API}/files/${encodeURIComponent(file.fileId)}/export?mimeType=${encodeURIComponent(mediaType)}`;
    } else if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      throw new GoogleDriveProviderError(
        "unsupported_file",
        "This Google Workspace file type is not supported for synchronization."
      );
    } else {
      url = `${DRIVE_API}/files/${encodeURIComponent(file.fileId)}?alt=media`;
    }

    const response = await this.fetchImplementation(url, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw await providerError(response);
    return {
      content: new Uint8Array(await response.arrayBuffer()),
      mediaType,
      fileName
    };
  }

  private async listFolder(
    accessToken: string,
    folderId: string,
    scope: GoogleDriveScope
  ): Promise<GoogleDriveFile[]> {
    const result: GoogleDriveFile[] = [];
    const pending = [folderId];
    while (pending.length > 0 && result.length < scope.maxFiles) {
      const parentId = pending.shift()!;
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({
          q: `'${parentId.replace(/'/g, "\\'")}' in parents and trashed = false`,
          fields:
            "nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum,trashed,capabilities(canDownload),parents)",
          pageSize: String(Math.min(100, scope.maxFiles))
        });
        if (pageToken) query.set("pageToken", pageToken);
        const response = await this.fetchImplementation(
          `${DRIVE_API}/files?${query.toString()}`,
          { headers: { authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) throw await providerError(response);
        const body = (await response.json()) as {
          files?: unknown[];
          nextPageToken?: string;
        };
        for (const raw of body.files ?? []) {
          const file = mapFile(raw);
          if (file.mimeType === "application/vnd.google-apps.folder") {
            if (scope.recursive) pending.push(file.fileId);
          } else {
            result.push(file);
          }
        }
        pageToken = body.nextPageToken;
      } while (pageToken && result.length < scope.maxFiles);
    }
    return result;
  }

  private async getMetadata(
    accessToken: string,
    fileId: string
  ): Promise<GoogleDriveFile> {
    const fields =
      "id,name,mimeType,modifiedTime,size,md5Checksum,trashed,capabilities(canDownload),parents";
    const response = await this.fetchImplementation(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw await providerError(response);
    return mapFile(await response.json());
  }
}

function mapFile(value: unknown): GoogleDriveFile {
  const file = value as Record<string, unknown>;
  if (
    typeof file.id !== "string" ||
    typeof file.name !== "string" ||
    typeof file.mimeType !== "string" ||
    typeof file.modifiedTime !== "string"
  ) {
    throw new GoogleDriveProviderError(
      "provider_unavailable",
      "Google Drive returned invalid file metadata."
    );
  }
  return {
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    sizeBytes: typeof file.size === "string" ? Number(file.size) : undefined,
    md5Checksum: typeof file.md5Checksum === "string" ? file.md5Checksum : undefined,
    trashed: file.trashed === true,
    canDownload:
      (file.capabilities as { canDownload?: unknown } | undefined)?.canDownload !== false,
    parentIds: Array.isArray(file.parents)
      ? file.parents.filter((item): item is string => typeof item === "string")
      : []
  };
}

async function providerError(response: Response): Promise<GoogleDriveProviderError> {
  const status = response.status;
  const safeMessage =
    status === 401
      ? "Google Drive authorization has expired or was revoked."
      : status === 403
        ? "Google Drive access was denied or quota was exceeded."
        : status === 429
          ? "Google Drive rate limit was reached. Try again later."
          : "Google Drive is temporarily unavailable.";
  return new GoogleDriveProviderError(
    status === 401
      ? "credential_invalid"
      : status === 429
        ? "rate_limited"
        : status === 403
          ? "permission_denied"
          : "provider_unavailable",
    safeMessage
  );
}
