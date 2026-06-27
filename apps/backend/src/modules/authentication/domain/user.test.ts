import { describe, it, expect } from "vitest";
import { normalizeUserEmail, createUser, UserDraft } from "./user.ts";

describe("user domain pure functions", () => {
  describe("normalizeUserEmail", () => {
    it("lowercases and trims email", () => {
      expect(normalizeUserEmail("  Alice@Gmail.COM  ")).toBe("alice@gmail.com");
    });

    it("keeps already normalized email unchanged", () => {
      expect(normalizeUserEmail("bob@example.com")).toBe("bob@example.com");
    });
  });

  describe("createUser", () => {
    it("defaults status to active if not provided", () => {
      const draft: UserDraft = {
        userId: "user_123" as any,
        email: "alice@example.com",
        displayName: "Alice",
        passwordHash: "hash123",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const user = createUser(draft);
      
      expect(user.status).toBe("active");
      expect(user.userId).toBe(draft.userId);
      expect(user.email).toBe(draft.email);
      expect(user.displayName).toBe(draft.displayName);
      expect(user.passwordHash).toBe(draft.passwordHash);
      expect(user.createdAt).toBe(draft.createdAt);
      expect(user.updatedAt).toBe(draft.updatedAt);
    });

    it("keeps disabled status if provided", () => {
      const draft: UserDraft = {
        userId: "user_123" as any,
        email: "bob@example.com",
        passwordHash: "hash123",
        status: "disabled",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const user = createUser(draft);
      
      expect(user.status).toBe("disabled");
      expect(user.userId).toBe(draft.userId);
      expect(user.email).toBe(draft.email);
    });
  });
});
