import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { DuplicateUserEmailError } from "../application/user-repository.ts";
import { createUser } from "../domain/user.ts";
import { PrismaUserRepository } from "./prisma-user-repository.ts";

const hasDatabase = !!process.env.DATABASE_URL;

describe.skipIf(!hasDatabase)("PrismaUserRepository", () => {
  const prisma = new PrismaClient();
  const repository = new PrismaUserRepository(prisma);

  beforeAll(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
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

    expect(created.userId).toBe(user.userId);
    expect(created.email).toBe(user.email);
    expect(created.passwordHash).toBe(user.passwordHash);
    expect(created.status).toBe("active");
    expect(found).toEqual(created);
  });

  it("findByEmail is case-insensitive", async () => {
    const found = await repository.findByEmail("ALICE@EXAMPLE.COM");

    expect(found).not.toBe(null);
    expect(found?.email).toBe("alice@example.com");
  });

  it("findById returns null for a missing user", async () => {
    const result = await repository.findById("usr-missing" as EntityId<"userId">);

    expect(result).toBe(null);
  });

  it("findByEmail returns null for a missing email", async () => {
    const result = await repository.findByEmail("nobody@example.com");

    expect(result).toBe(null);
  });

  it("create throws DuplicateUserEmailError on duplicate email", async () => {
    const duplicate = createUser({
      userId: "usr-prisma-2" as EntityId<"userId">,
      email: "alice@example.com",
      passwordHash: "hash-2",
      createdAt: "2026-06-24T00:05:00.000Z",
      updatedAt: "2026-06-24T00:05:00.000Z"
    });

    await expect(repository.create(duplicate)).rejects.toThrow(DuplicateUserEmailError);
  });
});
