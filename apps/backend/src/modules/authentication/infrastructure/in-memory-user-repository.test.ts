import { describe, it, expect } from "vitest";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { DuplicateUserEmailError } from "../application/user-repository.ts";
import { createUser } from "../domain/user.ts";
import { InMemoryUserRepository } from "./in-memory-user-repository.ts";

describe("InMemoryUserRepository", () => {
  it("creates users and finds them by id and email", async () => {
    const repository = new InMemoryUserRepository();
    const user = createUser({
      userId: "usr-1" as EntityId<"userId">,
      email: "alice@example.com",
      displayName: "Alice",
      passwordHash: "hash-1",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z"
    });

    const created = await repository.create(user);
    const byId = await repository.findById(user.userId);
    const byEmail = await repository.findByEmail("alice@example.com");

    expect(created).toEqual(user);
    expect(byId).toEqual(user);
    expect(byEmail).toEqual(user);
  });

  it("rejects duplicate emails even when casing and whitespace differ", async () => {
    const repository = new InMemoryUserRepository();

    await repository.create(
      createUser({
        userId: "usr-1" as EntityId<"userId">,
        email: "alice@example.com",
        passwordHash: "hash-1",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z"
      })
    );

    await expect(
      repository.create(
        createUser({
          userId: "usr-2" as EntityId<"userId">,
          email: "  ALICE@EXAMPLE.COM  ",
          passwordHash: "hash-2",
          createdAt: "2026-06-24T00:05:00.000Z",
          updatedAt: "2026-06-24T00:05:00.000Z"
        })
      )
    ).rejects.toThrow(DuplicateUserEmailError);
  });

  it("returns null when a user id or email is missing", async () => {
    const repository = new InMemoryUserRepository();

    expect(await repository.findById("usr-missing" as EntityId<"userId">)).toBe(null);
    expect(await repository.findByEmail("missing@example.com")).toBe(null);
  });

  it("returns clones instead of mutable internal references", async () => {
    const repository = new InMemoryUserRepository();
    const created = await repository.create(
      createUser({
        userId: "usr-1" as EntityId<"userId">,
        email: "alice@example.com",
        displayName: "Alice",
        passwordHash: "hash-1",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z"
      })
    );

    created.displayName = "Mutated";
    const fetched = await repository.findById(created.userId);

    expect(fetched?.displayName).toBe("Alice");
  });
});
