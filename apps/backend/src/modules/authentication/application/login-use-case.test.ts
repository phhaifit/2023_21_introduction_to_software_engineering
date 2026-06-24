import { describe, it, expect } from "vitest";
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

    expect(result.user.email).toBe("alice@example.com");
    expect(result.user.displayName).toBe("Alice");
    expect(result.user.status).toBe("active");
    expect("passwordHash" in result.user).toBe(false);
    expect(typeof result.session.token).toBe("string");
    expect(result.session.token.length).toBeGreaterThan(0);
    expect(result.session.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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

    await expect(
      loginUseCase.execute({
        email: "alice@example.com",
        password: "wrong password",
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the user does not exist", async () => {
    const deps = createDependencies();
    const loginUseCase = new LoginUseCase(
      deps.userRepository,
      deps.sessionRepository,
      deps.passwordHasher,
      deps.tokenHasher,
    );

    await expect(
      loginUseCase.execute({
        email: "missing@example.com",
        password: "correct horse battery staple",
      })
    ).rejects.toThrow(InvalidCredentialsError);
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

    await expect(
      loginUseCase.execute({
        email: "alice@example.com",
        password: "wrong password",
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(InvalidCredentialsError);
      wrongPasswordMessage = (error as InvalidCredentialsError).message;
      return true;
    });

    await expect(
      loginUseCase.execute({
        email: "missing@example.com",
        password: "correct horse battery staple",
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(InvalidCredentialsError);
      missingUserMessage = (error as InvalidCredentialsError).message;
      return true;
    });

    expect(missingUserMessage).toBe(wrongPasswordMessage);
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

    expect(result.user.email).toBe("foo@bar.com");
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

    expect(byRawToken).toBe(null);
    expect(byHashedToken).toBeTruthy();
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

    expect(first.session.token).not.toBe(second.session.token);
  });
});
