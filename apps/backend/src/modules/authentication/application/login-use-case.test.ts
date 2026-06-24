import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidCredentialsError } from "../domain/errors.ts";
import { BcryptPasswordHasher } from "../infrastructure/bcrypt-password-hasher.ts";
import { InMemorySessionRepository } from "../infrastructure/in-memory-session-repository.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";
import { Sha256TokenHasher } from "../infrastructure/sha256-token-hasher.ts";
import { RegisterUseCase } from "./register-use-case.ts";
import { LoginUseCase } from "./login-use-case.ts";

describe("LoginUseCase", () => {
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

  it("logs in a registered user and returns public user plus session token", async () => {
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

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
      displayName: "Alice",
    });

    const result = await loginUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    assert.equal(result.user.email, "alice@example.com");
    assert.equal(result.user.displayName, "Alice");
    assert.equal(result.user.status, "active");
    assert.equal("passwordHash" in result.user, false);
    assert.equal(typeof result.session.token, "string");
    assert.ok(result.session.token.length > 0);
    assert.match(result.session.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("throws InvalidCredentialsError for a wrong password", async () => {
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

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    await assert.rejects(
      loginUseCase.execute({
        email: "alice@example.com",
        password: "wrong password",
      }),
      InvalidCredentialsError,
    );
  });

  it("throws InvalidCredentialsError when the user does not exist", async () => {
    const deps = createDependencies();
    const loginUseCase = new LoginUseCase(
      deps.userRepository,
      deps.sessionRepository,
      deps.passwordHasher,
      deps.tokenHasher,
    );

    await assert.rejects(
      loginUseCase.execute({
        email: "missing@example.com",
        password: "correct horse battery staple",
      }),
      InvalidCredentialsError,
    );
  });

  it("uses the same invalid-credentials message for not-found and wrong-password", async () => {
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

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    let wrongPasswordMessage = "";
    let missingUserMessage = "";

    await assert.rejects(
      loginUseCase.execute({
        email: "alice@example.com",
        password: "wrong password",
      }),
      (error: unknown) => {
        assert.ok(error instanceof InvalidCredentialsError);
        wrongPasswordMessage = error.message;
        return true;
      },
    );

    await assert.rejects(
      loginUseCase.execute({
        email: "missing@example.com",
        password: "correct horse battery staple",
      }),
      (error: unknown) => {
        assert.ok(error instanceof InvalidCredentialsError);
        missingUserMessage = error.message;
        return true;
      },
    );

    assert.equal(missingUserMessage, wrongPasswordMessage);
  });

  it("supports case-insensitive email login", async () => {
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

    await registerUseCase.execute({
      email: "Foo@Bar.com",
      password: "correct horse battery staple",
    });

    const result = await loginUseCase.execute({
      email: "FOO@BAR.COM",
      password: "correct horse battery staple",
    });

    assert.equal(result.user.email, "foo@bar.com");
  });

  it("stores session by token hash, not raw token", async () => {
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

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    const result = await loginUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    const byRawToken = await deps.sessionRepository.findByTokenHash(
      result.session.token,
    );
    const byHashedToken = await deps.sessionRepository.findByTokenHash(
      deps.tokenHasher.hash(result.session.token),
    );

    assert.equal(byRawToken, null);
    assert.ok(byHashedToken);
  });

  it("returns different raw tokens for two logins of the same user", async () => {
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

    await registerUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    const first = await loginUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });
    const second = await loginUseCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    assert.notEqual(first.session.token, second.session.token);
  });
});
