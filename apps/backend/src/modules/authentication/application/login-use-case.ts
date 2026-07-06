import { randomBytes, randomUUID } from "node:crypto";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { InvalidCredentialsError } from "../domain/errors.ts";
import { createSession } from "../domain/session.ts";
import { normalizeUserEmail } from "../domain/user.ts";
import type { UserPublicProfile } from "../domain/user-public-profile.ts";
import type { PasswordHasher } from "./password-hasher.ts";
import type { SessionRepository } from "./session-repository.ts";
import type { TokenHasher } from "./token-hasher.ts";
import type { UserRepository } from "./user-repository.ts";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: UserPublicProfile;
  session: {
    token: string;
    expiresAt: string;
  };
};

export class LoginUseCase {
  private readonly userRepository: UserRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly tokenHasher: TokenHasher;
  private readonly sessionTtlMs: number;

  constructor(
    userRepository: UserRepository,
    sessionRepository: SessionRepository,
    passwordHasher: PasswordHasher,
    tokenHasher: TokenHasher,
    sessionTtlMs = 7 * 24 * 60 * 60 * 1000,
  ) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.passwordHasher = passwordHasher;
    this.tokenHasher = tokenHasher;
    this.sessionTtlMs = sessionTtlMs;
  }

  async execute(input: LoginInput): Promise<LoginResult> {
    const normalizedEmail = normalizeUserEmail(input.email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.verify(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.tokenHasher.hash(rawToken);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs).toISOString();

    await this.sessionRepository.create(
      createSession({
        sessionId: randomUUID() as EntityId<"sessionId">,
        userId: user.userId,
        tokenHash,
        createdAt,
        expiresAt,
      }),
    );

    return {
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        createdAt: user.createdAt,
      },
      session: {
        token: rawToken,
        expiresAt,
      },
    };
  }
}
