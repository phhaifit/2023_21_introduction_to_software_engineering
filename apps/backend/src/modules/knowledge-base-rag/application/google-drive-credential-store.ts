import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type GoogleDriveCredential = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scopes: string[];
  accountEmail?: string;
};

export type GoogleDriveCredentialStore = {
  save(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string,
    credential: GoogleDriveCredential
  ): Promise<void>;
  get(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<GoogleDriveCredential | null>;
  delete(workspaceId: EntityId<"workspaceId">, sourceId: string): Promise<void>;
};

export class InMemoryGoogleDriveCredentialStore
  implements GoogleDriveCredentialStore
{
  private readonly credentials = new Map<string, GoogleDriveCredential>();

  async save(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string,
    credential: GoogleDriveCredential
  ): Promise<void> {
    this.credentials.set(key(workspaceId, sourceId), structuredClone(credential));
  }

  async get(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<GoogleDriveCredential | null> {
    const credential = this.credentials.get(key(workspaceId, sourceId));
    return credential ? structuredClone(credential) : null;
  }

  async delete(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<void> {
    this.credentials.delete(key(workspaceId, sourceId));
  }
}

function key(workspaceId: EntityId<"workspaceId">, sourceId: string): string {
  return `${workspaceId}:${sourceId}`;
}
