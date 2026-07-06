import { describe, it, expect, vi } from "vitest";

import { AuthenticateSessionUseCase } from "./authenticate-session-use-case.ts";
import { SessionExpiredError, SessionNotFoundError } from "../domain/errors.ts";
import type { SessionRepository } from "./session-repository.ts";
import type { UserRepository } from "./user-repository.ts";
import type { TokenHasher } from "./token-hasher.ts";
import type { Session } from "../domain/session.ts";
import type { User } from "../domain/user.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const STUB_USER_ID = "user-abc" as EntityId<"userId">;
const STUB_TOKEN_HASH = "hashed-token-xyz";

const STUB_SESSION: Session = {
  sessionId: "session-001" as EntityId<"sessionId">,
  userId: STUB_USER_ID,
  tokenHash: STUB_TOKEN_HASH,
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h in future
};

const STUB_USER: User = {
  userId: STUB_USER_ID,
  email: "alice@example.com",
  displayName: "Alice",
  passwordHash: "irrelevant",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeSessionRepository(
  session: Session | null
): SessionRepository {
  return {
    create: vi.fn(),
    findByTokenHash: vi.fn().mockResolvedValue(session),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  } as unknown as SessionRepository;
}

function makeUserRepository(user: User | null): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(user),
    findByEmail: vi.fn(),
    create: vi.fn(),
  } as unknown as UserRepository;
}

function makeTokenHasher(): TokenHasher {
  return { hash: vi.fn().mockReturnValue(STUB_TOKEN_HASH) } as unknown as TokenHasher;
}

// ---------------------------------------------------------------------------
// AuthenticateSessionUseCase
// ---------------------------------------------------------------------------

describe("AuthenticateSessionUseCase", () => {
  it("happy path: valid token + active session + existing user → returns AuthenticatedUser", async () => {
    const useCase = new AuthenticateSessionUseCase(
      makeSessionRepository(STUB_SESSION),
      makeUserRepository(STUB_USER),
      makeTokenHasher()
    );

    const result = await useCase.execute({ rawToken: "raw-token" });

    expect(result.userId).toBe(STUB_USER_ID);
    expect(result.email).toBe("alice@example.com");
    expect(result.displayName).toBe("Alice");
    expect("passwordHash" in result).toBe(false);
  });

  it("session not found → throws SessionNotFoundError", async () => {
    const useCase = new AuthenticateSessionUseCase(
      makeSessionRepository(null),
      makeUserRepository(STUB_USER),
      makeTokenHasher()
    );

    await expect(useCase.execute({ rawToken: "bad-token" })).rejects.toThrow(SessionNotFoundError);
  });

  it("session expired → throws SessionExpiredError", async () => {
    const expiredSession: Session = {
      ...STUB_SESSION,
      expiresAt: "2020-01-01T00:00:00.000Z", // in the past
    };
    const useCase = new AuthenticateSessionUseCase(
      makeSessionRepository(expiredSession),
      makeUserRepository(STUB_USER),
      makeTokenHasher()
    );

    await expect(useCase.execute({ rawToken: "expired-token" })).rejects.toThrow(SessionExpiredError);
  });

  it("session revoked → throws SessionExpiredError (isSessionActive returns false)", async () => {
    const revokedSession: Session = {
      ...STUB_SESSION,
      revokedAt: "2026-01-02T00:00:00.000Z",
    };
    const useCase = new AuthenticateSessionUseCase(
      makeSessionRepository(revokedSession),
      makeUserRepository(STUB_USER),
      makeTokenHasher()
    );

    await expect(useCase.execute({ rawToken: "revoked-token" })).rejects.toThrow(SessionExpiredError);
  });

  it("user not found (session orphaned) → throws SessionNotFoundError", async () => {
    const useCase = new AuthenticateSessionUseCase(
      makeSessionRepository(STUB_SESSION),
      makeUserRepository(null),
      makeTokenHasher()
    );

    await expect(useCase.execute({ rawToken: "orphaned-token" })).rejects.toThrow(SessionNotFoundError);
  });
});
