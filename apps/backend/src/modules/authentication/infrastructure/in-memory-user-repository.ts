import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import {
  DuplicateUserEmailError,
  type UserRepository
} from "../application/user-repository.ts";
import { normalizeUserEmail, type User } from "../domain/user.ts";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly userIdsByEmail = new Map<string, EntityId<"userId">>();

  async findById(userId: EntityId<"userId">): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? this.copy(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.userIdsByEmail.get(normalizeUserEmail(email));
    if (!userId) {
      return null;
    }

    return this.findById(userId);
  }

  async create(user: User): Promise<User> {
    const emailKey = normalizeUserEmail(user.email);
    if (this.userIdsByEmail.has(emailKey)) {
      throw new DuplicateUserEmailError(user.email);
    }

    if (this.users.has(user.userId)) {
      throw new Error(`User already exists: ${user.userId}`);
    }

    const storedUser = this.copy(user);
    this.users.set(user.userId, storedUser);
    this.userIdsByEmail.set(emailKey, user.userId);
    return this.copy(storedUser);
  }

  private copy(user: User): User {
    return { ...user };
  }
}
