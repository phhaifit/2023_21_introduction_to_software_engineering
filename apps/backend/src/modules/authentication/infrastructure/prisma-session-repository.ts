import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Session } from "../domain/session.ts";
import type { SessionRepository } from "../application/session-repository.ts";
import { toDomain, toPrismaCreateInput } from "./prisma-session-mapper.ts";

export class PrismaSessionRepository implements SessionRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(session: Session): Promise<Session> {
    const data = toPrismaCreateInput(session);
    const record = await this.prisma.session.create({ data });
    return toDomain(record);
  }

  async findByTokenHash(tokenHash: string, now?: string): Promise<Session | null> {
    const currentTime = now ?? new Date().toISOString();

    const record = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: currentTime }
      }
    });

    return record ? toDomain(record) : null;
  }

  async revoke(
    sessionId: EntityId<"sessionId">,
    revokedAt: string
  ): Promise<Session | null> {
    const existing = await this.prisma.session.findUnique({
      where: { sessionId }
    });

    if (!existing) {
      return null;
    }

    const record = await this.prisma.session.update({
      where: { sessionId },
      data: { revokedAt }
    });

    return toDomain(record);
  }

  async revokeAllForUser(
    userId: EntityId<"userId">,
    revokedAt: string
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: { revokedAt }
    });

    return result.count;
  }
}
