import { describe, it, expect } from "vitest";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { toDomain, toPrismaCreateInput } from "./prisma-session-mapper.ts";

describe("prisma-session-mapper", () => {
  const prismaRowActive = {
    sessionId: "ses-1",
    userId: "usr-1",
    tokenHash: "hash-abc",
    createdAt: "2026-06-24T00:00:00.000Z",
    expiresAt: "2026-06-24T01:00:00.000Z",
    revokedAt: null
  };

  const prismaRowRevoked = {
    sessionId: "ses-2",
    userId: "usr-1",
    tokenHash: "hash-xyz",
    createdAt: "2026-06-24T00:00:00.000Z",
    expiresAt: "2026-06-24T01:00:00.000Z",
    revokedAt: "2026-06-24T00:30:00.000Z"
  };

  it("toDomain maps an active Prisma row to a Session domain entity without revokedAt", () => {
    const session = toDomain(prismaRowActive);

    expect(session.sessionId).toBe("ses-1");
    expect(session.userId).toBe("usr-1");
    expect(session.tokenHash).toBe("hash-abc");
    expect(session.createdAt).toBe("2026-06-24T00:00:00.000Z");
    expect(session.expiresAt).toBe("2026-06-24T01:00:00.000Z");
    expect(session.revokedAt).toBe(undefined);
  });

  it("toDomain maps a revoked Prisma row to a Session domain entity with revokedAt", () => {
    const session = toDomain(prismaRowRevoked);

    expect(session.sessionId).toBe("ses-2");
    expect(session.revokedAt).toBe("2026-06-24T00:30:00.000Z");
  });

  it("toPrismaCreateInput maps an active Session to Prisma create shape without revokedAt", () => {
    const session = toDomain(prismaRowActive);
    const input = toPrismaCreateInput(session);

    expect(input.sessionId).toBe("ses-1");
    expect(input.userId).toBe("usr-1");
    expect(input.tokenHash).toBe("hash-abc");
    expect(input.createdAt).toBe("2026-06-24T00:00:00.000Z");
    expect(input.expiresAt).toBe("2026-06-24T01:00:00.000Z");
    expect(input.revokedAt).toBe(undefined);
  });

  it("toPrismaCreateInput maps a revoked Session to Prisma create shape with revokedAt", () => {
    const session = toDomain(prismaRowRevoked);
    const input = toPrismaCreateInput(session);

    expect(input.revokedAt).toBe("2026-06-24T00:30:00.000Z");
  });

  it("toDomain and toPrismaCreateInput round-trip preserves all fields", () => {
    const session = toDomain(prismaRowRevoked);
    const input = toPrismaCreateInput(session);

    expect(input.sessionId).toBe(prismaRowRevoked.sessionId);
    expect(input.userId).toBe(prismaRowRevoked.userId);
    expect(input.tokenHash).toBe(prismaRowRevoked.tokenHash);
    expect(input.createdAt).toBe(prismaRowRevoked.createdAt);
    expect(input.expiresAt).toBe(prismaRowRevoked.expiresAt);
    expect(input.revokedAt).toBe(prismaRowRevoked.revokedAt);
  });

  it("toDomain correctly casts sessionId and userId as EntityId", () => {
    const session = toDomain(prismaRowActive);
    const sessionId: EntityId<"sessionId"> = session.sessionId;
    const userId: EntityId<"userId"> = session.userId;

    expect(sessionId).toBe("ses-1");
    expect(userId).toBe("usr-1");
  });
});
