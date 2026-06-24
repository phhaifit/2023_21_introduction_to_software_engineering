import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { toDomain, toPrismaCreateInput } from "./prisma-user-mapper.ts";

describe("prisma-user-mapper", () => {
  const prismaRow = {
    userId: "usr-1",
    email: "alice@example.com",
    passwordHash: "hash-abc",
    status: "active",
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z"
  };

  it("toDomain maps a Prisma row to a User domain entity", () => {
    const user = toDomain(prismaRow);

    assert.equal(user.userId, "usr-1");
    assert.equal(user.email, "alice@example.com");
    assert.equal(user.passwordHash, "hash-abc");
    assert.equal(user.status, "active");
    assert.equal(user.createdAt, "2026-06-24T00:00:00.000Z");
    assert.equal(user.updatedAt, "2026-06-24T00:00:00.000Z");
  });

  it("toPrismaCreateInput maps a User domain entity to a Prisma create shape", () => {
    const user = toDomain(prismaRow);
    const input = toPrismaCreateInput(user);

    assert.equal(input.userId, "usr-1");
    assert.equal(input.email, "alice@example.com");
    assert.equal(input.passwordHash, "hash-abc");
    assert.equal(input.status, "active");
    assert.equal(input.createdAt, "2026-06-24T00:00:00.000Z");
    assert.equal(input.updatedAt, "2026-06-24T00:00:00.000Z");
  });

  it("toDomain and toPrismaCreateInput round-trip preserves all fields", () => {
    const user = toDomain(prismaRow);
    const input = toPrismaCreateInput(user);

    assert.equal(input.userId, prismaRow.userId);
    assert.equal(input.email, prismaRow.email);
    assert.equal(input.passwordHash, prismaRow.passwordHash);
    assert.equal(input.status, prismaRow.status);
    assert.equal(input.createdAt, prismaRow.createdAt);
    assert.equal(input.updatedAt, prismaRow.updatedAt);
  });

  it("toDomain correctly casts userId as EntityId", () => {
    const user = toDomain(prismaRow);
    const userId: EntityId<"userId"> = user.userId;

    assert.equal(userId, "usr-1");
  });
});
