import assert from "node:assert/strict";

import {
  GoogleDriveOAuthService,
  GoogleDriveOAuthStateStore,
  GOOGLE_DRIVE_OAUTH_SCOPES,
  googleDriveOAuthScopes
} from "@vcp/backend/modules/knowledge-base-rag/application/google-drive-oauth-service.ts";
import { InMemoryGoogleDriveCredentialStore } from "@vcp/backend/modules/knowledge-base-rag/application/google-drive-credential-store.ts";
import { InMemoryKnowledgeDataSourceRepository } from "@vcp/backend/modules/knowledge-base-rag/infrastructure/in-memory-knowledge-base-rag-repositories.ts";

const dataSourceRepository = new InMemoryKnowledgeDataSourceRepository();
const credentialStore = new InMemoryGoogleDriveCredentialStore();
const requests = [];
const fetchImplementation = async (url, init = {}) => {
  requests.push({ url: String(url), init });
  if (String(url).endsWith("/token")) {
    return jsonResponse({
      access_token: "test-access-value",
      refresh_token: "test-refresh-value",
      expires_in: 3600,
      scope: GOOGLE_DRIVE_OAUTH_SCOPES.join(" ")
    });
  }
  if (String(url).includes("/userinfo")) {
    return jsonResponse({ email: "drive-user@example.test" });
  }
  return new Response(null, { status: 200 });
};
const service = new GoogleDriveOAuthService({
  config: {
    clientId: "client-id",
    clientSecret: "client-secret-value",
    redirectUri: "http://127.0.0.1:3001/oauth/callback"
  },
  dataSourceRepository,
  credentialStore,
  stateStore: new GoogleDriveOAuthStateStore(),
  now: () => "2026-07-05T00:00:00.000Z",
  generateSourceId: () => "source-google-drive",
  fetchImplementation
});

const started = await service.start("workspace-a", "user-a", "Company Drive");
const authorizationUrl = new URL(started.authorizationUrl);
assert.equal(authorizationUrl.origin, "https://accounts.google.com");
assert.equal(authorizationUrl.searchParams.get("access_type"), "offline");
assert.equal(authorizationUrl.searchParams.get("scope"), GOOGLE_DRIVE_OAUTH_SCOPES.join(" "));
assert.equal(
  authorizationUrl.searchParams.get("scope").includes("https://www.googleapis.com/auth/drive "),
  false
);

const readonlyService = new GoogleDriveOAuthService({
  config: {
    clientId: "client-id",
    clientSecret: "client-secret-value",
    redirectUri: "http://127.0.0.1:3001/oauth/callback",
    scopeMode: "readonly"
  },
  dataSourceRepository: new InMemoryKnowledgeDataSourceRepository(),
  credentialStore: new InMemoryGoogleDriveCredentialStore(),
  stateStore: new GoogleDriveOAuthStateStore(),
  now: () => "2026-07-05T00:00:00.000Z",
  generateSourceId: () => "source-google-drive-readonly",
  fetchImplementation
});
const readonlyUrl = new URL(
  (
    await readonlyService.start(
      "workspace-readonly",
      "user-a",
      "Read-only Drive"
    )
  ).authorizationUrl
);
assert.equal(
  readonlyUrl.searchParams.get("scope"),
  googleDriveOAuthScopes("readonly").join(" ")
);
assert.equal(
  readonlyUrl.searchParams.get("scope").includes("/auth/drive.file"),
  false
);

const callback = await service.callback({
  workspaceId: "workspace-a",
  code: "authorization-code",
  state: authorizationUrl.searchParams.get("state")
});
assert.equal(callback.connected, true);
assert.equal(callback.source.provider, "google_drive");
assert.equal(callback.source.connectedAccountEmail, "drive-user@example.test");
assert.equal(callback.source.oauthConfigured, true);
assertNoSecrets(callback);

const stored = await credentialStore.get("workspace-a", "source-google-drive");
assert.equal(stored.accessToken, "test-access-value");
assert.equal(stored.refreshToken, "test-refresh-value");

const disconnected = await service.disconnect("workspace-a", "source-google-drive");
assert.equal(disconnected.status, "not_connected");
assert.equal(await credentialStore.get("workspace-a", "source-google-drive"), null);
assertNoSecrets(disconnected);

await assert.rejects(
  () =>
    service.callback({
      workspaceId: "workspace-a",
      code: "code",
      state: "invalid-state"
    }),
  /invalid or expired/
);

const serializedRequests = JSON.stringify(
  requests.map(({ url, init }) => ({
    url: url.replace(/token=[^&]+/, "token=[redacted]"),
    method: init.method
  }))
);
assert.equal(serializedRequests.includes("test-access-value"), false);
assert.equal(serializedRequests.includes("test-refresh-value"), false);

console.log("knowledge-base-rag Google Drive OAuth checks passed");

function assertNoSecrets(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "accessToken",
    "refreshToken",
    "test-access-value",
    "test-refresh-value",
    "client-secret-value"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}
