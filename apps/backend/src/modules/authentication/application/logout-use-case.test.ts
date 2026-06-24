import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSession } from "../domain/session.ts";
import { BcryptPasswordHasher } from "../infrastructure/bcrypt-password-hasher.ts";
import { InMemorySessionRepository } from "../infrastructure/in-memory-session-repository.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";
import { Sha256TokenHasher } from "../infrastructure/sha256-token-hasher.ts";
import { LoginUseCase } from "./login-use-case.ts";
import { LogoutUseCase } from "./logout-use-case.ts";
import { RegisterUseCase } from "./register-use-case.ts";
import { SessionNotFoundError } from "../domain/errors.ts";

describe("LogoutUseCase", () => {
  function createDependencies() {
    const userRepository = new InMemoryUserRepository();
    const sessionRepository = new InMemorySessionRepository();
    const passwordHasher = new BcryptPasswordHasher(4);
    const tokenHasher = new Sha256TokenHasher();

    return {
      userRepository,
      sessionRepository,
      passwordHasher,
      tokenHasher,
    };
  }

  it("logs out a session created by login and revokes it in the repository", async () => {
    const deps = createDependencies();
    const registerUseCase = new RegisterUseCase(
      deps.userRepository,
      deps.passwordHasher,
    );
    const loginUseCase = new LoginUseCase(
      deps.userRepository,
      deps.sessionRepository,
      deps.passwordHasher,
      deps.tokenHasher,
    );
    const logoutUseCase = new LogoutUseCase(
      deps.sessionRepository,
      deps.tokenHasher,
    );

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    const loginResult = await loginUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    await logoutUseCase.execute({ rawToken: loginResult.session.token });

    const sessionAfterLogout = await deps.sessionRepository.findByTokenHash(
      deps.tokenHasher.hash(loginResult.session.token),
    );

    assert.equal(sessionAfterLogout, null);
  });

  it("throws SessionNotFoundError for a token that never existed", async () => {
    const deps = createDependencies();
    const logoutUseCase = new LogoutUseCase(
      deps.sessionRepository,
      deps.tokenHasher,
    );

    await assert.rejects(
      logoutUseCase.execute({ rawToken: "never-existed-token" }),
      SessionNotFoundError,
    );
  });

  it("throws SessionNotFoundError when the same token is logged out twice", async () => {
    const deps = createDependencies();
    const registerUseCase = new RegisterUseCase(
      deps.userRepository,
      deps.passwordHasher,
    );
    const loginUseCase = new LoginUseCase(
      deps.userRepository,
      deps.sessionRepository,
      deps.passwordHasher,
      deps.tokenHasher,
    );
    const logoutUseCase = new LogoutUseCase(
      deps.sessionRepository,
      deps.tokenHasher,
    );

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    const loginResult = await loginUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    await logoutUseCase.execute({ rawToken: loginResult.session.token });

    await assert.rejects(
      logoutUseCase.execute({ rawToken: loginResult.session.token }),
      SessionNotFoundError,
    );
  });

  it("throws SessionNotFoundError for an expired session", async () => {
    const deps = createDependencies();
    const logoutUseCase = new LogoutUseCase(
      deps.sessionRepository,
      deps.tokenHasher,
    );
    const rawToken = "expired-token";
    const tokenHash = deps.tokenHasher.hash(rawToken);

    await deps.sessionRepository.create(
      createSession({
        sessionId: "ses-expired" as any,
        userId: "usr-1" as any,
        tokenHash,
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-06-23T23:59:59.000Z",
      }),
    );

    await assert.rejects(
      logoutUseCase.execute({ rawToken }),
      SessionNotFoundError,
    );
  });
});
