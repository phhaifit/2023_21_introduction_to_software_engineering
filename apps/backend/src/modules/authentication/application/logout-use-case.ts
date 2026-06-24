import { SessionNotFoundError } from "../domain/errors.ts";
import type { SessionRepository } from "./session-repository.ts";
import type { TokenHasher } from "./token-hasher.ts";

export type LogoutInput = {
  rawToken: string;
};

export class LogoutUseCase {
  private readonly sessionRepository: SessionRepository;
  private readonly tokenHasher: TokenHasher;

  constructor(sessionRepository: SessionRepository, tokenHasher: TokenHasher) {
    this.sessionRepository = sessionRepository;
    this.tokenHasher = tokenHasher;
  }

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = this.tokenHasher.hash(input.rawToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new SessionNotFoundError();
    }

    await this.sessionRepository.revoke(
      session.sessionId,
      new Date().toISOString(),
    );
  }
}
