import type { User as PrismaUser } from "@vcp/database";
import type { User } from "../domain/user.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { UserStatus } from "../domain/user.ts";

export function toDomain(record: PrismaUser): User {
  return {
    userId: record.userId as EntityId<"userId">,
    email: record.email,
    passwordHash: record.passwordHash,
    status: record.status as UserStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toPrismaCreateInput(user: User): {
  userId: string;
  email: string;
  passwordHash: string;
  status: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    userId: user.userId,
    email: user.email,
    passwordHash: user.passwordHash,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
