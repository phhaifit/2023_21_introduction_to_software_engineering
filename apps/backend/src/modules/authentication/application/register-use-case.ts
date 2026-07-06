import { randomUUID } from "node:crypto";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { EmailAlreadyUsedError, ValidationError } from "../domain/errors.ts";
import { createUser, normalizeUserEmail } from "../domain/user.ts";
import type { UserPublicProfile } from "../domain/user-public-profile.ts";
import type { PasswordHasher } from "./password-hasher.ts";
import type { UserRepository } from "./user-repository.ts";

export type RegisterUserInput = {
  email: string;
  password: string;
  displayName?: string;
};

export class RegisterUseCase {
  private readonly userRepository: UserRepository;
  private readonly passwordHasher: PasswordHasher;

  constructor(userRepository: UserRepository, passwordHasher: PasswordHasher) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute(input: RegisterUserInput): Promise<UserPublicProfile> {
    const validationErrors = this.validate(input);

    if (Object.keys(validationErrors).length > 0) {
      throw new ValidationError(validationErrors);
    }

    const normalizedEmail = normalizeUserEmail(input.email);
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new EmailAlreadyUsedError(normalizedEmail);
    }

    const timestamp = new Date().toISOString();
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = createUser({
      userId: randomUUID() as EntityId<"userId">,
      email: normalizedEmail,
      displayName: input.displayName,
      passwordHash,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const createdUser = await this.userRepository.create(user);

    return {
      userId: createdUser.userId,
      email: createdUser.email,
      displayName: createdUser.displayName,
      status: createdUser.status,
      createdAt: createdUser.createdAt,
    };
  }

  private validate(input: RegisterUserInput): Record<string, string> {
    const details: Record<string, string> = {};

    if (!this.isValidEmail(input.email)) {
      details.email = "Email format is invalid";
    }

    if (input.password.length < 8) {
      details.password = "Password must be at least 8 characters";
    }

    if (
      typeof input.displayName === "string" &&
      input.displayName.length > 100
    ) {
      details.displayName = "Display name must be at most 100 characters";
    }

    return details;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }
}
