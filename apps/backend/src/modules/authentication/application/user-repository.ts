import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { User } from "../domain/user.ts";

export class DuplicateUserEmailError extends Error {
  constructor(email: string) {
    super(`User email already exists: ${email}`);
    this.name = "DuplicateUserEmailError";
  }
}

export type UserRepository = {
  findById(userId: EntityId<"userId">): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
};
