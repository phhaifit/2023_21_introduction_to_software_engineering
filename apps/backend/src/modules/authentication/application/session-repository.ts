import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Session } from "../domain/session.ts";

export type SessionRepository = {
  create(session: Session): Promise<Session>;
  findByTokenHash(tokenHash: string, now?: string): Promise<Session | null>;
  revoke(sessionId: EntityId<"sessionId">, revokedAt: string): Promise<Session | null>;
  revokeAllForUser(userId: EntityId<"userId">, revokedAt: string): Promise<number>;
};
