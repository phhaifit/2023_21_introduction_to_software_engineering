import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SessionRepository } from "../application/session-repository.ts";
import { isSessionActive, type Session } from "../domain/session.ts";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();
  private readonly sessionIdsByTokenHash = new Map<string, EntityId<"sessionId">>();

  async create(session: Session): Promise<Session> {
    if (this.sessions.has(session.sessionId)) {
      throw new Error(`Session already exists: ${session.sessionId}`);
    }

    if (this.sessionIdsByTokenHash.has(session.tokenHash)) {
      throw new Error(`Session token hash already exists: ${session.tokenHash}`);
    }

    const storedSession = this.copy(session);
    this.sessions.set(session.sessionId, storedSession);
    this.sessionIdsByTokenHash.set(session.tokenHash, session.sessionId);
    return this.copy(storedSession);
  }

  async findByTokenHash(tokenHash: string, now?: string): Promise<Session | null> {
    const sessionId = this.sessionIdsByTokenHash.get(tokenHash);
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session || !isSessionActive(session, now)) {
      return null;
    }

    return this.copy(session);
  }

  async revoke(
    sessionId: EntityId<"sessionId">,
    revokedAt: string
  ): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = session.revokedAt ? this.copy(session) : this.copy({ ...session, revokedAt });
    this.sessions.set(sessionId, updatedSession);
    return this.copy(updatedSession);
  }

  async revokeAllForUser(userId: EntityId<"userId">, revokedAt: string): Promise<number> {
    let revokedCount = 0;

    for (const session of this.sessions.values()) {
      if (session.userId !== userId || session.revokedAt) {
        continue;
      }

      session.revokedAt = revokedAt;
      revokedCount += 1;
    }

    return revokedCount;
  }

  private copy(session: Session): Session {
    return { ...session };
  }
}
