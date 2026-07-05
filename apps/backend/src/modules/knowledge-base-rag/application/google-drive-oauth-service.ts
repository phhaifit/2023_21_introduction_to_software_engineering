import { randomBytes } from "node:crypto";

import type {
  GoogleDriveOAuthCallbackResponse,
  GoogleDriveOAuthStartResponse
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDataSourceRepository } from "./knowledge-data-source-repository.ts";
import type {
  GoogleDriveCredential,
  GoogleDriveCredentialStore
} from "./google-drive-credential-store.ts";
import { toKnowledgeDataSourceDto } from "./dto-mappers.ts";

export const GOOGLE_DRIVE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file"
] as const;

type OAuthState = {
  workspaceId: EntityId<"workspaceId">;
  sourceId: string;
  actorId: EntityId<"userId">;
  expiresAt: number;
};

export type GoogleDriveOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export class GoogleDriveOAuthStateStore {
  private readonly states = new Map<string, OAuthState>();

  create(value: Omit<OAuthState, "expiresAt">): string {
    const state = randomBytes(32).toString("base64url");
    this.states.set(state, { ...value, expiresAt: Date.now() + 10 * 60_000 });
    return state;
  }

  consume(state: string): OAuthState | null {
    const value = this.states.get(state);
    this.states.delete(state);
    return value && value.expiresAt >= Date.now() ? value : null;
  }
}

export class GoogleDriveOAuthService {
  private readonly dependencies: {
    config: GoogleDriveOAuthConfig;
    dataSourceRepository: KnowledgeDataSourceRepository;
    credentialStore: GoogleDriveCredentialStore;
    stateStore: GoogleDriveOAuthStateStore;
    now: () => string;
    generateSourceId: () => string;
    fetchImplementation?: typeof fetch;
  };

  constructor(
    dependencies: {
      config: GoogleDriveOAuthConfig;
      dataSourceRepository: KnowledgeDataSourceRepository;
      credentialStore: GoogleDriveCredentialStore;
      stateStore: GoogleDriveOAuthStateStore;
      now: () => string;
      generateSourceId: () => string;
      fetchImplementation?: typeof fetch;
    }
  ) {
    this.dependencies = dependencies;
  }

  async start(
    workspaceId: EntityId<"workspaceId">,
    actorId: EntityId<"userId">,
    displayName = "Google Drive"
  ): Promise<GoogleDriveOAuthStartResponse> {
    const existing = (
      await this.dependencies.dataSourceRepository.listDataSources(workspaceId, {
        provider: "google_drive"
      })
    )[0];
    const timestamp = this.dependencies.now();
    const source =
      existing ??
      (await this.dependencies.dataSourceRepository.saveDataSource({
        sourceId: this.dependencies.generateSourceId(),
        workspaceId,
        provider: "google_drive",
        displayName: displayName.trim() || "Google Drive",
        connectionStatus: "not_connected",
        selectedScopeNodeCount: 0,
        connectedByUserId: actorId,
        safeMetadata: { oauthConfigured: true },
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    const state = this.dependencies.stateStore.create({
      workspaceId,
      sourceId: source.sourceId,
      actorId
    });
    const query = new URLSearchParams({
      client_id: this.dependencies.config.clientId,
      redirect_uri: this.dependencies.config.redirectUri,
      response_type: "code",
      scope: GOOGLE_DRIVE_OAUTH_SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state
    });
    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`
    };
  }

  async callback(input: {
    workspaceId: EntityId<"workspaceId">;
    code?: string;
    state?: string;
    error?: string;
  }): Promise<GoogleDriveOAuthCallbackResponse> {
    if (input.error || !input.code || !input.state) {
      throw new GoogleDriveOAuthError(
        "google_drive.oauth_denied",
        "Google Drive authorization was denied or canceled."
      );
    }
    const state = this.dependencies.stateStore.consume(input.state);
    if (!state || state.workspaceId !== input.workspaceId) {
      throw new GoogleDriveOAuthError(
        "google_drive.oauth_state_invalid",
        "Google Drive authorization state is invalid or expired."
      );
    }

    const credential = await this.exchangeCode(input.code);
    const accountEmail = await this.fetchAccountEmail(credential.accessToken);
    const storedCredential = { ...credential, accountEmail };
    await this.dependencies.credentialStore.save(
      state.workspaceId,
      state.sourceId,
      storedCredential
    );
    const source = await this.dependencies.dataSourceRepository.getDataSourceById(
      state.workspaceId,
      state.sourceId
    );
    if (!source) {
      throw new GoogleDriveOAuthError(
        "google_drive.source_missing",
        "Google Drive data source no longer exists."
      );
    }
    const saved = await this.dependencies.dataSourceRepository.saveDataSource({
      ...source,
      connectionStatus: "connected",
      connectedByUserId: state.actorId,
      safeMetadata: {
        connectedAccountEmail: accountEmail,
        oauthConfigured: true
      },
      updatedAt: this.dependencies.now()
    });
    return { source: toKnowledgeDataSourceDto(saved), connected: true };
  }

  async disconnect(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ) {
    const source =
      await this.dependencies.dataSourceRepository.getDataSourceById(
        workspaceId,
        sourceId
      );
    if (!source || source.provider !== "google_drive") {
      throw new GoogleDriveOAuthError(
        "google_drive.source_missing",
        "Google Drive data source was not found."
      );
    }
    const credential = await this.dependencies.credentialStore.get(
      workspaceId,
      sourceId
    );
    if (credential) {
      await this.revokeBestEffort(credential);
    }
    await this.dependencies.credentialStore.delete(workspaceId, sourceId);
    const saved = await this.dependencies.dataSourceRepository.saveDataSource({
      ...source,
      connectionStatus: "not_connected",
      safeMetadata: { oauthConfigured: true },
      updatedAt: this.dependencies.now()
    });
    return toKnowledgeDataSourceDto(saved);
  }

  async getAccessToken(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<string> {
    const credential = await this.dependencies.credentialStore.get(
      workspaceId,
      sourceId
    );
    if (!credential) {
      throw new GoogleDriveOAuthError(
        "google_drive.credential_missing",
        "Google Drive must be connected before synchronization."
      );
    }
    if (new Date(credential.expiresAt).getTime() > Date.now() + 60_000) {
      return credential.accessToken;
    }
    if (!credential.refreshToken) {
      throw new GoogleDriveOAuthError(
        "google_drive.credential_expired",
        "Google Drive authorization expired. Reconnect the data source."
      );
    }
    const refreshed = await this.refresh(credential);
    await this.dependencies.credentialStore.save(
      workspaceId,
      sourceId,
      refreshed
    );
    return refreshed.accessToken;
  }

  private async exchangeCode(code: string): Promise<GoogleDriveCredential> {
    const response = await this.fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.dependencies.config.clientId,
        client_secret: this.dependencies.config.clientSecret,
        redirect_uri: this.dependencies.config.redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!response.ok) {
      throw new GoogleDriveOAuthError(
        "google_drive.oauth_exchange_failed",
        "Google Drive authorization could not be completed."
      );
    }
    return tokenResponse(await response.json());
  }

  private async refresh(
    credential: GoogleDriveCredential
  ): Promise<GoogleDriveCredential> {
    const response = await this.fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: credential.refreshToken!,
        client_id: this.dependencies.config.clientId,
        client_secret: this.dependencies.config.clientSecret,
        grant_type: "refresh_token"
      })
    });
    if (!response.ok) {
      throw new GoogleDriveOAuthError(
        "google_drive.credential_revoked",
        "Google Drive authorization was revoked. Reconnect the data source."
      );
    }
    const refreshed = tokenResponse(await response.json());
    return {
      ...refreshed,
      refreshToken: credential.refreshToken,
      accountEmail: credential.accountEmail
    };
  }

  private async fetchAccountEmail(accessToken: string): Promise<string | undefined> {
    const response = await this.fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return undefined;
    const body = (await response.json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : undefined;
  }

  private async revokeBestEffort(credential: GoogleDriveCredential): Promise<void> {
    const token = credential.refreshToken ?? credential.accessToken;
    await this.fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" }
      }
    ).catch(() => undefined);
  }

  private fetch(input: string, init?: RequestInit): Promise<Response> {
    return (this.dependencies.fetchImplementation ?? fetch)(input, init);
  }
}

export class GoogleDriveOAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleDriveOAuthError";
    this.code = code;
  }
}

function tokenResponse(value: unknown): GoogleDriveCredential {
  const response = value as Record<string, unknown>;
  if (typeof response.access_token !== "string") {
    throw new GoogleDriveOAuthError(
      "google_drive.oauth_exchange_failed",
      "Google Drive authorization returned an invalid response."
    );
  }
  return {
    accessToken: response.access_token,
    refreshToken:
      typeof response.refresh_token === "string"
        ? response.refresh_token
        : undefined,
    expiresAt: new Date(
      Date.now() +
        (typeof response.expires_in === "number" ? response.expires_in : 3600) *
          1000
    ).toISOString(),
    scopes:
      typeof response.scope === "string"
        ? response.scope.split(/\s+/).filter(Boolean)
        : [...GOOGLE_DRIVE_OAUTH_SCOPES]
  };
}
