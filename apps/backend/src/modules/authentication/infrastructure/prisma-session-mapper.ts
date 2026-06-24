import type { PrismaClient } from "@vcp/database";
import type { Session } from "../domain/session.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

type PrismaSession = Awaited<ReturnType<PrismaClient["session"]["findUniqueOrThrow"]>>;

export function toDomain(record: PrismaSession): Session {
  return {
    sessionId: record.sessionId as EntityId<"sessionId">,
    userId: record.userId as EntityId<"userId">,
    tokenHash: record.tokenHash,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    ...(record.revokedAt !== null ? { revokedAt: record.revokedAt } : {})
  };
}

export function toPrismaCreateInput(session: Session): {
  sessionId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
} {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    tokenHash: session.tokenHash,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    ...(session.revokedAt !== undefined ? { revokedAt: session.revokedAt } : {})
  };
}
