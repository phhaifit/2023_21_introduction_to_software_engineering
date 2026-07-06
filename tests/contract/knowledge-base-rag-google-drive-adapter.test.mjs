import assert from "node:assert/strict";

import {
  GoogleDriveApiProvider
} from "@vcp/backend/modules/knowledge-base-rag/infrastructure/google-drive-api-provider.ts";
import { GoogleDriveProviderError } from "@vcp/backend/modules/knowledge-base-rag/application/google-drive-provider.ts";

const calls = [];
const provider = new GoogleDriveApiProvider(async (url, init) => {
  calls.push({ url: String(url), authorization: init?.headers?.authorization });
  const value = String(url);
  if (value.includes("/files?")) {
    return jsonResponse({
      files: [
        file("blob-1", "policy.pdf", "application/pdf"),
        file("doc-1", "Handbook", "application/vnd.google-apps.document"),
        file("unsupported-1", "Slides", "application/vnd.google-apps.presentation")
      ]
    });
  }
  if (value.includes("blob-1?alt=media")) {
    return new Response(Buffer.from("%PDF-test"), { status: 200 });
  }
  if (value.includes("doc-1/export")) {
    return new Response(Buffer.from("Google Docs exported text"), { status: 200 });
  }
  return jsonResponse(file("file-direct", "direct.txt", "text/plain"));
});

const files = await provider.listFiles("access-value", {
  folderIds: ["folder-1"],
  fileIds: [],
  recursive: false,
  allowedMimeTypes: [],
  maxFiles: 10
});
assert.equal(files.length, 3);
const blob = await provider.downloadFile(
  "access-value",
  files.find((item) => item.fileId === "blob-1")
);
assert.equal(blob.mediaType, "application/pdf");
assert.match(Buffer.from(blob.content).toString(), /PDF/);
const doc = await provider.downloadFile(
  "access-value",
  files.find((item) => item.fileId === "doc-1")
);
assert.equal(doc.mediaType, "text/plain");
assert.equal(doc.fileName, "Handbook.txt");
assert.match(Buffer.from(doc.content).toString(), /exported text/);
await assert.rejects(
  () =>
    provider.downloadFile(
      "access-value",
      files.find((item) => item.fileId === "unsupported-1")
    ),
  (error) =>
    error instanceof GoogleDriveProviderError &&
    error.code === "unsupported_file"
);
assert.ok(calls.some((call) => call.url.includes("alt=media")));
assert.ok(calls.some((call) => call.url.includes("/export?mimeType=text%2Fplain")));

const rawFolderCalls = [];
const rawFolderProvider = new GoogleDriveApiProvider(async (url) => {
  rawFolderCalls.push(String(url));
  if (String(url).includes("/files/raw-folder?")) {
    return jsonResponse(
      file("raw-folder", "Policies", "application/vnd.google-apps.folder")
    );
  }
  return jsonResponse({
    files: [file("nested-file", "nested.txt", "text/plain")]
  });
});
const rawFolderFiles = await rawFolderProvider.listFiles("access-value", {
  folderIds: [],
  fileIds: ["raw-folder"],
  recursive: false,
  allowedMimeTypes: [],
  maxFiles: 10
});
assert.deepEqual(rawFolderFiles.map((item) => item.fileId), ["nested-file"]);
assert.ok(rawFolderCalls.some((url) => url.includes("%27raw-folder%27+in+parents")));

const treeProvider = new GoogleDriveApiProvider(async (url) => {
  const value = String(url);
  if (value.includes("/files/folder-tree?")) {
    return jsonResponse(
      file("folder-tree", "HR Policies", "application/vnd.google-apps.folder")
    );
  }
  if (value.includes("%27folder-tree%27+in+parents")) {
    return jsonResponse({
      files: [
        file("tree-file", "Equipment Policy.txt", "text/plain"),
        file("tree-subfolder", "Archive", "application/vnd.google-apps.folder")
      ]
    });
  }
  if (value.includes("%27tree-subfolder%27+in+parents")) {
    return jsonResponse({
      files: [file("nested-file", "Leave Policy.pdf", "application/pdf")]
    });
  }
  throw new Error("unexpected fake Drive request");
});
const tree = await treeProvider.listScopeTree("access-value", {
  folderIds: ["folder-tree"],
  fileIds: [],
  recursive: true,
  allowedMimeTypes: [],
  maxFiles: 10
});
assert.equal(tree[0].file.name, "HR Policies");
assert.deepEqual(
  tree[0].children.map((node) => node.file.name),
  ["Equipment Policy.txt", "Archive"]
);
assert.equal(tree[0].children[1].children[0].file.name, "Leave Policy.pdf");
assert.equal(JSON.stringify(tree).includes("access-value"), false);

for (const [status, code] of [
  [401, "credential_invalid"],
  [403, "permission_denied"],
  [404, "not_found"],
  [500, "provider_unavailable"],
  [429, "rate_limited"]
]) {
  const failing = new GoogleDriveApiProvider(async () =>
    jsonResponse({ error: { message: "private provider payload token" } }, status)
  );
  await assert.rejects(
    () =>
      failing.listFiles("secret-access-token", {
        folderIds: [],
        fileIds: ["file-1"],
        recursive: false,
        allowedMimeTypes: [],
        maxFiles: 1
      }),
    (error) =>
      error instanceof GoogleDriveProviderError &&
      error.code === code &&
      !error.message.includes("private provider payload") &&
      !error.message.includes("secret-access-token")
  );
}

for (const [reason, code, message] of [
  [
    "accessNotConfigured",
    "api_disabled",
    "Google Drive API is not enabled"
  ],
  [
    "insufficientPermissions",
    "insufficient_scope",
    "Google Drive OAuth scope is insufficient"
  ],
  ["userRateLimitExceeded", "rate_limited", "rate limit reached"]
]) {
  const failing = new GoogleDriveApiProvider(async () =>
    jsonResponse(
      {
        error: {
          message: "private provider payload token",
          errors: [{ reason }]
        }
      },
      403
    )
  );
  await assert.rejects(
    () =>
      failing.listFiles("secret-access-token", {
        folderIds: [],
        fileIds: ["file-1"],
        recursive: false,
        allowedMimeTypes: [],
        maxFiles: 1
      }),
    (error) =>
      error instanceof GoogleDriveProviderError &&
      error.code === code &&
      error.message.includes(message) &&
      !error.message.includes("private provider payload") &&
      !error.message.includes("secret-access-token")
  );
}

const networkFailure = new GoogleDriveApiProvider(async () => {
  throw new Error("socket failed with secret-access-token");
});
await assert.rejects(
  () =>
    networkFailure.listFiles("secret-access-token", {
      folderIds: [],
      fileIds: ["file-1"],
      recursive: false,
      allowedMimeTypes: [],
      maxFiles: 1
    }),
  (error) =>
    error instanceof GoogleDriveProviderError &&
    error.code === "provider_unavailable" &&
    error.message === "Google Drive is temporarily unavailable. Try again later."
);

console.log("knowledge-base-rag Google Drive adapter checks passed");

function file(id, name, mimeType) {
  return {
    id,
    name,
    mimeType,
    modifiedTime: "2026-07-05T00:00:00.000Z",
    size: "20",
    trashed: false,
    capabilities: { canDownload: true },
    parents: ["folder-1"]
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}
