import { describe, it, expect } from "vitest";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { createSession } from "../domain/session.ts";
import { InMemorySessionRepository } from "./in-memory-session-repository.ts";

describe("InMemorySessionRepository", () => {
  it("creates a session, finds it by token hash, and revokes it", async () => {
    const repository = new InMemorySessionRepository();
    const session = createSession({
      sessionId: "ses-1" as EntityId<"sessionId">,
      userId: "usr-1" as EntityId<"userId">,
      tokenHash: "hash-1",
      createdAt: "2026-06-24T00:00:00.000Z",
      expiresAt: "2026-06-24T01:00:00.000Z"
    });

    const created = await repository.create(session);
    const active = await repository.findByTokenHash("hash-1", "2026-06-24T00:30:00.000Z");
    const revoked = await repository.revoke(session.sessionId, "2026-06-24T00:40:00.000Z");
    const afterRevoke = await repository.findByTokenHash("hash-1", "2026-06-24T00:45:00.000Z");

    expect(created).toEqual(session);
    expect(active).toEqual(session);
    expect(revoked?.revokedAt).toBe("2026-06-24T00:40:00.000Z");
    expect(afterRevoke).toBe(null);
  });

  it("returns null for expired sessions", async () => {
    const repository = new InMemorySessionRepository();

    await repository.create(
      createSession({
        sessionId: "ses-1" as EntityId<"sessionId">,
        userId: "usr-1" as EntityId<"userId">,
        tokenHash: "hash-1",
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-06-24T00:05:00.000Z"
      })
    );

    expect(await repository.findByTokenHash("hash-1", "2026-06-24T00:06:00.000Z")).toBe(null);
  });

  it("revokes all active sessions for a user without affecting others", async () => {
    const repository = new InMemorySessionRepository();

    await repository.create(
      createSession({
        sessionId: "ses-1" as EntityId<"sessionId">,
        userId: "usr-1" as EntityId<"userId">,
        tokenHash: "hash-1",
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-06-24T01:00:00.000Z"
      })
    );
    await repository.create(
      createSession({
        sessionId: "ses-2" as EntityId<"sessionId">,
        userId: "usr-1" as EntityId<"userId">,
        tokenHash: "hash-2",
        createdAt: "2026-06-24T00:01:00.000Z",
        expiresAt: "2026-06-24T01:00:00.000Z"
      })
    );
    await repository.create(
      createSession({
        sessionId: "ses-3" as EntityId<"sessionId">,
        userId: "usr-2" as EntityId<"userId">,
        tokenHash: "hash-3",
        createdAt: "2026-06-24T00:02:00.000Z",
        expiresAt: "2026-06-24T01:00:00.000Z"
      })
    );

    const revokedCount = await repository.revokeAllForUser(
      "usr-1" as EntityId<"userId">,
      "2026-06-24T00:30:00.000Z"
    );

    expect(revokedCount).toBe(2);
    expect(await repository.findByTokenHash("hash-1", "2026-06-24T00:31:00.000Z")).toBe(null);
    expect(await repository.findByTokenHash("hash-2", "2026-06-24T00:31:00.000Z")).toBe(null);
    expect(await repository.findByTokenHash("hash-3", "2026-06-24T00:31:00.000Z")).not.toBe(null);
  });

  it("returns clones instead of mutable internal references", async () => {
    const repository = new InMemorySessionRepository();
    const created = await repository.create(
      createSession({
        sessionId: "ses-1" as EntityId<"sessionId">,
        userId: "usr-1" as EntityId<"userId">,
        tokenHash: "hash-1",
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-06-24T01:00:00.000Z"
      })
    );

    created.revokedAt = "2026-06-24T00:10:00.000Z";
    const fetched = await repository.findByTokenHash("hash-1", "2026-06-24T00:20:00.000Z");

    expect(fetched?.revokedAt).toBe(undefined);
  });
});
