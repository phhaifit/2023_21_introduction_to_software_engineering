import { describe, it, expect } from "vitest";
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

    expect(user.userId).toBe("usr-1");
    expect(user.email).toBe("alice@example.com");
    expect(user.passwordHash).toBe("hash-abc");
    expect(user.status).toBe("active");
    expect(user.createdAt).toBe("2026-06-24T00:00:00.000Z");
    expect(user.updatedAt).toBe("2026-06-24T00:00:00.000Z");
  });

  it("toPrismaCreateInput maps a User domain entity to a Prisma create shape", () => {
    const user = toDomain(prismaRow);
    const input = toPrismaCreateInput(user);

    expect(input.userId).toBe("usr-1");
    expect(input.email).toBe("alice@example.com");
    expect(input.passwordHash).toBe("hash-abc");
    expect(input.status).toBe("active");
    expect(input.createdAt).toBe("2026-06-24T00:00:00.000Z");
    expect(input.updatedAt).toBe("2026-06-24T00:00:00.000Z");
  });

  it("toDomain and toPrismaCreateInput round-trip preserves all fields", () => {
    const user = toDomain(prismaRow);
    const input = toPrismaCreateInput(user);

    expect(input.userId).toBe(prismaRow.userId);
    expect(input.email).toBe(prismaRow.email);
    expect(input.passwordHash).toBe(prismaRow.passwordHash);
    expect(input.status).toBe(prismaRow.status);
    expect(input.createdAt).toBe(prismaRow.createdAt);
    expect(input.updatedAt).toBe(prismaRow.updatedAt);
  });

  it("toDomain correctly casts userId as EntityId", () => {
    const user = toDomain(prismaRow);
    const userId: EntityId<"userId"> = user.userId;

    expect(userId).toBe("usr-1");
  });
});
