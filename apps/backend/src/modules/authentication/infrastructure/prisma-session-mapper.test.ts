import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

    assert.equal(session.sessionId, "ses-1");
    assert.equal(session.userId, "usr-1");
    assert.equal(session.tokenHash, "hash-abc");
    assert.equal(session.createdAt, "2026-06-24T00:00:00.000Z");
    assert.equal(session.expiresAt, "2026-06-24T01:00:00.000Z");
    assert.equal(session.revokedAt, undefined);
  });

  it("toDomain maps a revoked Prisma row to a Session domain entity with revokedAt", () => {
    const session = toDomain(prismaRowRevoked);

    assert.equal(session.sessionId, "ses-2");
    assert.equal(session.revokedAt, "2026-06-24T00:30:00.000Z");
  });

  it("toPrismaCreateInput maps an active Session to Prisma create shape without revokedAt", () => {
    const session = toDomain(prismaRowActive);
    const input = toPrismaCreateInput(session);

    assert.equal(input.sessionId, "ses-1");
    assert.equal(input.userId, "usr-1");
    assert.equal(input.tokenHash, "hash-abc");
    assert.equal(input.createdAt, "2026-06-24T00:00:00.000Z");
    assert.equal(input.expiresAt, "2026-06-24T01:00:00.000Z");
    assert.equal(input.revokedAt, undefined);
  });

  it("toPrismaCreateInput maps a revoked Session to Prisma create shape with revokedAt", () => {
    const session = toDomain(prismaRowRevoked);
    const input = toPrismaCreateInput(session);

    assert.equal(input.revokedAt, "2026-06-24T00:30:00.000Z");
  });

  it("toDomain and toPrismaCreateInput round-trip preserves all fields", () => {
    const session = toDomain(prismaRowRevoked);
    const input = toPrismaCreateInput(session);

    assert.equal(input.sessionId, prismaRowRevoked.sessionId);
    assert.equal(input.userId, prismaRowRevoked.userId);
    assert.equal(input.tokenHash, prismaRowRevoked.tokenHash);
    assert.equal(input.createdAt, prismaRowRevoked.createdAt);
    assert.equal(input.expiresAt, prismaRowRevoked.expiresAt);
    assert.equal(input.revokedAt, prismaRowRevoked.revokedAt);
  });

  it("toDomain correctly casts sessionId and userId as EntityId", () => {
    const session = toDomain(prismaRowActive);
    const sessionId: EntityId<"sessionId"> = session.sessionId;
    const userId: EntityId<"userId"> = session.userId;

    assert.equal(sessionId, "ses-1");
    assert.equal(userId, "usr-1");
  });
});
