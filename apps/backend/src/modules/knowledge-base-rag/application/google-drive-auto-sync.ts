import type { SafeJsonValue } from "../domain/safe-json.ts";

export type GoogleDriveAutoSyncFrequency = "hourly" | "daily";

export type GoogleDriveAutoSyncSettings = {
  enabled: boolean;
  frequency?: GoogleDriveAutoSyncFrequency;
  lastAutoSyncAt?: string;
  nextAutoSyncAt?: string;
  lastSyncStatus?: "completed" | "failed";
};

export function readGoogleDriveAutoSyncSettings(
  metadata: SafeJsonValue | undefined
): GoogleDriveAutoSyncSettings {
  const value =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  const frequency =
    value.autoSyncFrequency === "hourly" || value.autoSyncFrequency === "daily"
      ? value.autoSyncFrequency
      : undefined;
  return {
    enabled: value.autoSyncEnabled === true,
    frequency,
    lastAutoSyncAt:
      typeof value.lastAutoSyncAt === "string" ? value.lastAutoSyncAt : undefined,
    nextAutoSyncAt:
      typeof value.nextAutoSyncAt === "string" ? value.nextAutoSyncAt : undefined,
    lastSyncStatus:
      value.lastSyncStatus === "completed" || value.lastSyncStatus === "failed"
        ? value.lastSyncStatus
        : undefined
  };
}

export function nextGoogleDriveAutoSyncAt(
  from: string,
  frequency: GoogleDriveAutoSyncFrequency
): string {
  const intervalMs = frequency === "hourly" ? 60 * 60_000 : 24 * 60 * 60_000;
  return new Date(new Date(from).getTime() + intervalMs).toISOString();
}
