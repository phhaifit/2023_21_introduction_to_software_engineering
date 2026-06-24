export class ValidationError extends Error {
  readonly details: Record<string, string>;

  constructor(details: Record<string, string>) {
    super("Validation failed");
    this.name = "ValidationError";
    this.details = details;
  }
}

export class EmailAlreadyUsedError extends Error {
  constructor(email: string) {
    super(`Email already used: ${email}`);
    this.name = "EmailAlreadyUsedError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
    this.name = "SessionNotFoundError";
  }
}
