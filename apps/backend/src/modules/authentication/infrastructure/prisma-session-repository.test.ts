import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { createUser } from "../domain/user.ts";
import { createSession } from "../domain/session.ts";
import { PrismaUserRepository } from "./prisma-user-repository.ts";
import { PrismaSessionRepository } from "./prisma-session-repository.ts";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set — skipping PrismaSessionRepository integration tests");
  process.exit(0);
}

const prisma = new PrismaClient();
const userRepository = new PrismaUserRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);

const TEST_USER_ID = "usr-ses-test-1" as EntityId<"userId">;
const FUTURE = "2099-01-01T00:00:00.000Z";

describe("PrismaSessionRepository", () => {
  before(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await userRepository.create(
      createUser({
        userId: TEST_USER_ID,
        email: "session-test@example.com",
        passwordHash: "hash-1",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z"
      })
    );
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("creates a session and finds it by tokenHash", async () => {
    const session = createSession({
      sessionId: "ses-1" as EntityId<"sessionId">,
      userId: TEST_USER_ID,
      tokenHash: "token-hash-1",
      createdAt: "2026-06-24T00:00:00.000Z",
      expiresAt: FUTURE
    });

    const created = await sessionRepository.create(session);
    const found = await sessionRepository.findByTokenHash("token-hash-1", "2026-06-24T00:01:00.000Z");

    assert.equal(created.sessionId, session.sessionId);
    assert.equal(created.userId, session.userId);
    assert.equal(created.tokenHash, session.tokenHash);
    assert.equal(created.revokedAt, undefined);
    assert.ok(found !== null);
    assert.equal(found.sessionId, session.sessionId);
  });

  it("findByTokenHash returns null for a revoked session", async () => {
    const session = createSession({
      sessionId: "ses-2" as EntityId<"sessionId">,
      userId: TEST_USER_ID,
      tokenHash: "token-hash-2",
      createdAt: "2026-06-24T00:00:00.000Z",
      expiresAt: FUTURE
    });

    await sessionRepository.create(session);
    await sessionRepository.revoke(session.sessionId, "2026-06-24T00:10:00.000Z");

    const found = await sessionRepository.findByTokenHash("token-hash-2", "2026-06-24T00:15:00.000Z");

    assert.equal(found, null);
  });

  it("findByTokenHash returns null for an expired session", async () => {
    const session = createSession({
      sessionId: "ses-3" as EntityId<"sessionId">,
      userId: TEST_USER_ID,
      tokenHash: "token-hash-3",
      createdAt: "2026-06-24T00:00:00.000Z",
      expiresAt: "2026-06-24T00:05:00.000Z"
    });

    await sessionRepository.create(session);

    const found = await sessionRepository.findByTokenHash("token-hash-3", "2026-06-24T00:06:00.000Z");

    assert.equal(found, null);
  });

  it("revoke sets revokedAt on the session", async () => {
    const session = createSession({
      sessionId: "ses-4" as EntityId<"sessionId">,
      userId: TEST_USER_ID,
      tokenHash: "token-hash-4",
      createdAt: "2026-06-24T00:00:00.000Z",
      expiresAt: FUTURE
    });

    await sessionRepository.create(session);
    const revoked = await sessionRepository.revoke(session.sessionId, "2026-06-24T00:20:00.000Z");

    assert.ok(revoked !== null);
    assert.equal(revoked.revokedAt, "2026-06-24T00:20:00.000Z");
  });

  it("revokeAllForUser only revokes sessions for the target user", async () => {
    const otherUserId = "usr-ses-test-2" as EntityId<"userId">;

    await userRepository.create(
      createUser({
        userId: otherUserId,
        email: "other-session-test@example.com",
        passwordHash: "hash-2",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z"
      })
    );

    const sessionA = createSession({
      sessionId: "ses-5" as EntityId<"sessionId">,
      userId: TEST_USER_ID,
      tokenHash: "token-hash-5",
      createdAt: "2026-06-24T00:00:00.000Z",
      expiresAt: FUTURE
    });

    const sessionB = createSession({
      sessionId: "ses-6" as EntityId<"sessionId">,
      userId: TEST_USER_ID,
      tokenHash: "token-hash-6",
      createdAt: "2026-06-24T00:01:00.000Z",
      expiresAt: FUTURE
    });

    const sessionC = createSession({
      sessionId: "ses-7" as EntityId<"sessionId">,
      userId: otherUserId,
      tokenHash: "token-hash-7",
      createdAt: "2026-06-24T00:02:00.000Z",
      expiresAt: FUTURE
    });

    await sessionRepository.create(sessionA);
    await sessionRepository.create(sessionB);
    await sessionRepository.create(sessionC);

    const revokedCount = await sessionRepository.revokeAllForUser(
      TEST_USER_ID,
      "2026-06-24T00:30:00.000Z"
    );

    assert.ok(revokedCount >= 2);

    const foundA = await sessionRepository.findByTokenHash("token-hash-5", "2026-06-24T00:31:00.000Z");
    const foundB = await sessionRepository.findByTokenHash("token-hash-6", "2026-06-24T00:31:00.000Z");
    const foundC = await sessionRepository.findByTokenHash("token-hash-7", "2026-06-24T00:31:00.000Z");

    assert.equal(foundA, null);
    assert.equal(foundB, null);
    assert.ok(foundC !== null);
  });
});
