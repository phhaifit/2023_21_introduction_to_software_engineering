import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { DuplicateUserEmailError } from "../application/user-repository.ts";
import { createUser } from "../domain/user.ts";
import { PrismaUserRepository } from "./prisma-user-repository.ts";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set — skipping PrismaUserRepository integration tests");
  process.exit(0);
}

const prisma = new PrismaClient();
const repository = new PrismaUserRepository(prisma);

describe("PrismaUserRepository", () => {
  before(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("creates a user and finds it by id", async () => {
    const user = createUser({
      userId: "usr-prisma-1" as EntityId<"userId">,
      email: "alice@example.com",
      passwordHash: "hash-1",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z"
    });

    const created = await repository.create(user);
    const found = await repository.findById(user.userId);

    assert.equal(created.userId, user.userId);
    assert.equal(created.email, user.email);
    assert.equal(created.passwordHash, user.passwordHash);
    assert.equal(created.status, "active");
    assert.deepEqual(found, created);
  });

  it("findByEmail is case-insensitive", async () => {
    const found = await repository.findByEmail("ALICE@EXAMPLE.COM");

    assert.ok(found !== null);
    assert.equal(found.email, "alice@example.com");
  });

  it("findById returns null for a missing user", async () => {
    const result = await repository.findById("usr-missing" as EntityId<"userId">);

    assert.equal(result, null);
  });

  it("findByEmail returns null for a missing email", async () => {
    const result = await repository.findByEmail("nobody@example.com");

    assert.equal(result, null);
  });

  it("create throws DuplicateUserEmailError on duplicate email", async () => {
    const duplicate = createUser({
      userId: "usr-prisma-2" as EntityId<"userId">,
      email: "alice@example.com",
      passwordHash: "hash-2",
      createdAt: "2026-06-24T00:05:00.000Z",
      updatedAt: "2026-06-24T00:05:00.000Z"
    });

    await assert.rejects(
      repository.create(duplicate),
      DuplicateUserEmailError
    );
  });
});
