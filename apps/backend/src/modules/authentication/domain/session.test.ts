import { describe, it, expect } from "vitest";
import {
  createSession,
  isSessionRevoked,
  isSessionExpired,
  isSessionActive,
  SessionDraft,
  Session,
} from "./session.ts";

describe("session domain pure functions", () => {
  describe("createSession", () => {
    it("preserves all fields without revokedAt", () => {
      const draft: SessionDraft = {
        sessionId: "sess_123" as any,
        userId: "user_123" as any,
        tokenHash: "hash123",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-02T00:00:00.000Z",
      };

      const session = createSession(draft);
      expect(session).toEqual(draft);
    });

    it("preserves all fields including revokedAt", () => {
      const draft: SessionDraft = {
        sessionId: "sess_123" as any,
        userId: "user_123" as any,
        tokenHash: "hash123",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-02T00:00:00.000Z",
        revokedAt: "2026-01-01T12:00:00.000Z",
      };

      const session = createSession(draft);
      expect(session).toEqual(draft);
    });
  });

  describe("isSessionRevoked", () => {
    it("returns false if revokedAt is undefined", () => {
      expect(isSessionRevoked({} as Session)).toBe(false);
    });

    it("returns false if revokedAt is empty string", () => {
      expect(isSessionRevoked({ revokedAt: "" } as Session)).toBe(false);
    });

    it("returns true if revokedAt is a date string", () => {
      expect(isSessionRevoked({ revokedAt: "2026-01-01T00:00:00.000Z" } as Session)).toBe(true);
    });
  });

  describe("isSessionExpired", () => {
    const NOW = "2026-01-02T00:00:00.000Z";

    it("returns true if expiresAt is in the past", () => {
      expect(isSessionExpired({ expiresAt: "2026-01-01T00:00:00.000Z" } as Session, NOW)).toBe(true);
    });

    it("returns false if expiresAt is in the future", () => {
      expect(isSessionExpired({ expiresAt: "2026-01-03T00:00:00.000Z" } as Session, NOW)).toBe(false);
    });

    it("returns true if expiresAt is exactly now", () => {
      expect(isSessionExpired({ expiresAt: NOW } as Session, NOW)).toBe(true);
    });
  });

  describe("isSessionActive", () => {
    const NOW = "2026-01-02T00:00:00.000Z";

    it("returns true if not revoked and not expired", () => {
      expect(
        isSessionActive(
          { expiresAt: "2026-01-03T00:00:00.000Z" } as Session,
          NOW
        )
      ).toBe(true);
    });

    it("returns false if revoked and not expired", () => {
      expect(
        isSessionActive(
          {
            expiresAt: "2026-01-03T00:00:00.000Z",
            revokedAt: "2026-01-01T00:00:00.000Z",
          } as Session,
          NOW
        )
      ).toBe(false);
    });

    it("returns false if not revoked but expired", () => {
      expect(
        isSessionActive(
          { expiresAt: "2026-01-01T00:00:00.000Z" } as Session,
          NOW
        )
      ).toBe(false);
    });

    it("returns false if revoked and expired", () => {
      expect(
        isSessionActive(
          {
            expiresAt: "2026-01-01T00:00:00.000Z",
            revokedAt: "2026-01-01T00:00:00.000Z",
          } as Session,
          NOW
        )
      ).toBe(false);
    });
  });
});
