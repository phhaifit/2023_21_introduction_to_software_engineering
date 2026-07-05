import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  GoogleDriveCredential,
  GoogleDriveCredentialStore
} from "../application/google-drive-credential-store.ts";

type EncryptedCredentialEnvelope = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

export class EncryptedFileGoogleDriveCredentialStore
  implements GoogleDriveCredentialStore
{
  private readonly root: string;
  private readonly encryptionKey: Buffer;

  constructor(input: { rootDirectory: string; encryptionSecret: string }) {
    if (input.encryptionSecret.trim().length < 32) {
      throw new Error("Google Drive credential encryption secret must be at least 32 characters.");
    }
    this.root = resolve(input.rootDirectory);
    this.encryptionKey = createHash("sha256")
      .update(input.encryptionSecret, "utf8")
      .digest();
  }

  async save(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string,
    credential: GoogleDriveCredential
  ): Promise<void> {
    const path = this.path(workspaceId, sourceId);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(credential), "utf8"),
      cipher.final()
    ]);
    const envelope: EncryptedCredentialEnvelope = {
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64")
    };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(envelope), { mode: 0o600 });
  }

  async get(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<GoogleDriveCredential | null> {
    let raw: string;
    try {
      raw = await readFile(this.path(workspaceId, sourceId), "utf8");
    } catch (error) {
      if (isNotFound(error)) return null;
      throw new Error("Google Drive credential storage is unavailable.");
    }
    try {
      const envelope = JSON.parse(raw) as EncryptedCredentialEnvelope;
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        Buffer.from(envelope.iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
      return JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(envelope.ciphertext, "base64")),
          decipher.final()
        ]).toString("utf8")
      ) as GoogleDriveCredential;
    } catch {
      throw new Error("Google Drive credential could not be decrypted.");
    }
  }

  async delete(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<void> {
    await rm(this.path(workspaceId, sourceId), { force: true });
  }

  private path(workspaceId: EntityId<"workspaceId">, sourceId: string): string {
    return resolve(
      this.root,
      sanitize(workspaceId),
      `${sanitize(sourceId)}.credential`
    );
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
