import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { User } from "../domain/user.ts";
import {
  DuplicateUserEmailError,
  type UserRepository
} from "../application/user-repository.ts";
import { normalizeUserEmail } from "../domain/user.ts";
import { toDomain, toPrismaCreateInput } from "./prisma-user-mapper.ts";

export class PrismaUserRepository implements UserRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findById(userId: EntityId<"userId">): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { userId }
    });

    return record ? toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeUserEmail(email);

    const record = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    return record ? toDomain(record) : null;
  }

  async create(user: User): Promise<User> {
    const data = toPrismaCreateInput(user);

    try {
      const record = await this.prisma.user.create({ data });
      return toDomain(record);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === "P2002"
      ) {
        throw new DuplicateUserEmailError(user.email);
      }

      throw error;
    }
  }
}
