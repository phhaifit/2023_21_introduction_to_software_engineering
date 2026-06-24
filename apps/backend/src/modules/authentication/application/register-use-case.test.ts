import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmailAlreadyUsedError, ValidationError } from "../domain/errors.ts";
import { BcryptPasswordHasher } from "../infrastructure/bcrypt-password-hasher.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";
import { RegisterUseCase } from "./register-use-case.ts";

describe("RegisterUseCase", () => {
  it("registers a user and returns a public profile without a password hash", async () => {
    const useCase = new RegisterUseCase(
      new InMemoryUserRepository(),
      new BcryptPasswordHasher(4),
    );

    const result = await useCase.execute({
      email: "Foo@Bar.com",
      password: "correct horse battery staple",
      displayName: "Foo Bar",
    });

    assert.equal(result.email, "foo@bar.com");
    assert.equal(result.displayName, "Foo Bar");
    assert.equal(result.status, "active");
    assert.equal(typeof result.userId, "string");
    assert.match(result.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal("passwordHash" in result, false);
  });

  it("rejects an invalid email format", async () => {
    const useCase = new RegisterUseCase(
      new InMemoryUserRepository(),
      new BcryptPasswordHasher(4),
    );

    await assert.rejects(
      useCase.execute({ email: "not-an-email", password: "12345678" }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.deepEqual(error.details, { email: "Email format is invalid" });
        return true;
      },
    );
  });

  it("rejects a short password", async () => {
    const useCase = new RegisterUseCase(
      new InMemoryUserRepository(),
      new BcryptPasswordHasher(4),
    );

    await assert.rejects(
      useCase.execute({ email: "alice@example.com", password: "short" }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.deepEqual(error.details, {
          password: "Password must be at least 8 characters",
        });
        return true;
      },
    );
  });

  it("rejects a display name that is too long", async () => {
    const useCase = new RegisterUseCase(
      new InMemoryUserRepository(),
      new BcryptPasswordHasher(4),
    );

    await assert.rejects(
      useCase.execute({
        email: "alice@example.com",
        password: "correct horse battery staple",
        displayName: "a".repeat(101),
      }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.deepEqual(error.details, {
          displayName: "Display name must be at most 100 characters",
        });
        return true;
      },
    );
  });

  it("collects all validation errors at once", async () => {
    const useCase = new RegisterUseCase(
      new InMemoryUserRepository(),
      new BcryptPasswordHasher(4),
    );

    await assert.rejects(
      useCase.execute({
        email: "bad-email",
        password: "short",
        displayName: "a".repeat(101),
      }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.deepEqual(error.details, {
          email: "Email format is invalid",
          password: "Password must be at least 8 characters",
          displayName: "Display name must be at most 100 characters",
        });
        return true;
      },
    );
  });

  it("rejects duplicate emails on the second registration", async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUseCase(
      repository,
      new BcryptPasswordHasher(4),
    );

    await useCase.execute({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    await assert.rejects(
      useCase.execute({
        email: "ALICE@example.com",
        password: "correct horse battery staple",
      }),
      EmailAlreadyUsedError,
    );
  });

  it("stores normalized email so it can be found by the lowercase address", async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new RegisterUseCase(
      repository,
      new BcryptPasswordHasher(4),
    );

    await useCase.execute({
      email: "Foo@Bar.com",
      password: "correct horse battery staple",
    });

    const storedUser = await repository.findByEmail("foo@bar.com");

    assert.ok(storedUser);
    assert.equal(storedUser.email, "foo@bar.com");
  });
});
