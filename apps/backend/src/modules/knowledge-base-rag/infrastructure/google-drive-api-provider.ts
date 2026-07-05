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
const GOOGLE_FOLDER = "application/vnd.google-apps.folder";

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
      if (file.mimeType === GOOGLE_FOLDER) {
        const discovered = await this.listFolder(accessToken, file.fileId, scope);
        for (const discoveredFile of discovered) {
          files.set(discoveredFile.fileId, discoveredFile);
        }
      } else {
        files.set(file.fileId, file);
      }
    }
    for (const folderId of scope.folderIds) {
      const discovered = await this.listFolder(accessToken, folderId, scope);
      for (const file of discovered) files.set(file.fileId, file);
    }
    return [...files.values()]
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

    const response = await this.request(url, {
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
        const response = await this.request(
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
          if (file.mimeType === GOOGLE_FOLDER) {
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
    const response = await this.request(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw await providerError(response);
    return mapFile(await response.json());
  }

  private async request(input: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.fetchImplementation(input, init);
    } catch {
      throw new GoogleDriveProviderError(
        "provider_unavailable",
        "Google Drive is temporarily unavailable. Try again later."
      );
    }
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
  const details = await safeProviderErrorDetails(response);
  if (status === 401) {
    return new GoogleDriveProviderError(
      "credential_invalid",
      "Google Drive credentials are invalid or expired. Reconnect Google Drive."
    );
  }
  if (status === 404) {
    return new GoogleDriveProviderError(
      "not_found",
      "The selected Drive file or folder could not be found or is not accessible."
    );
  }
  if (status === 429 || isRateLimit(details)) {
    return new GoogleDriveProviderError(
      "rate_limited",
      "Google Drive rate limit reached. Try again later."
    );
  }
  if (status === 403 && isApiDisabled(details)) {
    return new GoogleDriveProviderError(
      "api_disabled",
      "Google Drive API is not enabled for this Google Cloud project."
    );
  }
  if (status === 403 && isInsufficientScope(details)) {
    return new GoogleDriveProviderError(
      "insufficient_scope",
      "Google Drive OAuth scope is insufficient for this file or folder. Reconnect Google Drive after updating OAuth scopes."
    );
  }
  if (status === 403) {
    return new GoogleDriveProviderError(
      "permission_denied",
      "Google Drive did not grant this app access to the selected file or folder. Reconnect Google Drive or choose a file the app can access."
    );
  }
  return new GoogleDriveProviderError(
    "provider_unavailable",
    "Google Drive is temporarily unavailable. Try again later."
  );
}

type SafeProviderErrorDetails = {
  message: string;
  reasons: string[];
};

async function safeProviderErrorDetails(
  response: Response
): Promise<SafeProviderErrorDetails> {
  try {
    const body = (await response.json()) as {
      error?: {
        message?: unknown;
        status?: unknown;
        errors?: Array<{ reason?: unknown }>;
      };
    };
    return {
      message:
        typeof body.error?.message === "string"
          ? body.error.message.toLowerCase()
          : "",
      reasons: Array.isArray(body.error?.errors)
        ? body.error.errors
            .map((item) =>
              typeof item.reason === "string" ? item.reason.toLowerCase() : ""
            )
            .filter(Boolean)
        : []
    };
  } catch {
    return { message: "", reasons: [] };
  }
}

function isApiDisabled(details: SafeProviderErrorDetails): boolean {
  return (
    details.reasons.some((reason) =>
      ["accessnotconfigured", "servicedisabled"].includes(reason)
    ) ||
    details.message.includes("has not been used") ||
    details.message.includes("is disabled")
  );
}

function isInsufficientScope(details: SafeProviderErrorDetails): boolean {
  return (
    details.reasons.some((reason) =>
      ["insufficientpermissions", "autherror"].includes(reason)
    ) ||
    details.message.includes("insufficient authentication scopes") ||
    details.message.includes("insufficient permission")
  );
}

function isRateLimit(details: SafeProviderErrorDetails): boolean {
  return details.reasons.some((reason) =>
    [
      "dailylimitexceeded",
      "quotaexceeded",
      "ratelimitexceeded",
      "userratelimitexceeded"
    ].includes(reason)
  );
}
