import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type Session = {
  sessionId: EntityId<"sessionId">;
  userId: EntityId<"userId">;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type SessionDraft = {
  sessionId: EntityId<"sessionId">;
  userId: EntityId<"userId">;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export function createSession(draft: SessionDraft): Session {
  return { ...draft };
}

export function isSessionRevoked(session: Pick<Session, "revokedAt">): boolean {
  return typeof session.revokedAt === "string" && session.revokedAt.length > 0;
}

export function isSessionExpired(
  session: Pick<Session, "expiresAt">,
  now: string = new Date().toISOString()
): boolean {
  return Date.parse(session.expiresAt) <= Date.parse(now);
}

export function isSessionActive(
  session: Pick<Session, "expiresAt" | "revokedAt">,
  now: string = new Date().toISOString()
): boolean {
  return !isSessionRevoked(session) && !isSessionExpired(session, now);
}
