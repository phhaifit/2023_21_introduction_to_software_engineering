import { isSessionActive } from "../domain/session.ts";
import { SessionExpiredError, SessionNotFoundError } from "../domain/errors.ts";
import type { AuthenticatedUser } from "../../../shared/auth/request-context.ts";
import type { SessionRepository } from "./session-repository.ts";
import type { TokenHasher } from "./token-hasher.ts";
import type { UserRepository } from "./user-repository.ts";

export type AuthenticateSessionInput = {
  rawToken: string;
};

export class AuthenticateSessionUseCase {
  private readonly sessionRepository: SessionRepository;
  private readonly userRepository: UserRepository;
  private readonly tokenHasher: TokenHasher;

  constructor(
    sessionRepository: SessionRepository,
    userRepository: UserRepository,
    tokenHasher: TokenHasher
  ) {
    this.sessionRepository = sessionRepository;
    this.userRepository = userRepository;
    this.tokenHasher = tokenHasher;
  }

  async execute(input: AuthenticateSessionInput): Promise<AuthenticatedUser> {
    const tokenHash = this.tokenHasher.hash(input.rawToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new SessionNotFoundError();
    }

    const now = new Date().toISOString();
    if (!isSessionActive(session, now)) {
      throw new SessionExpiredError();
    }

    const user = await this.userRepository.findById(session.userId);

    if (!user) {
      throw new SessionNotFoundError();
    }

    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
