import { describe, expect, it, vi } from "vitest";

import {
  AuthApiClientError,
  createAuthenticationApiClient
} from "@vcp/frontend/features/authentication/authentication-api-client.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const meta = { requestId: "test", timestamp: "2026-01-01T00:00:00.000Z" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function successResponse(data: unknown): Response {
  return jsonResponse({ ok: true, data, meta });
}

function failureResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: { code, message }, meta }, status);
}

const validUser = {
  userId: "user-1",
  email: "alice@example.com",
  displayName: "Alice"
};

const validSession = {
  token: "raw-token-abc",
  expiresAt: "2026-12-31T00:00:00.000Z"
};

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("Authentication API client — login", () => {
  it("parses user and maps session.token to sessionToken", async () => {
    const fetchImplementation = vi.fn(async () =>
      successResponse({ user: validUser, session: validSession })
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    const result = await client.login({ email: "alice@example.com", password: "password1" });

    expect(result.user).toEqual(validUser);
    expect(result.session.sessionToken).toBe("raw-token-abc");
    expect(result.session.expiresAt).toBe(validSession.expiresAt);
  });

  it("calls POST /api/auth/login with JSON body", async () => {
    const fetchImplementation = vi.fn(async () =>
      successResponse({ user: validUser, session: validSession })
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    await client.login({ email: "alice@example.com", password: "password1" });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com", password: "password1" })
      })
    );
  });

  it("throws AuthApiClientError with API code when ok is false", async () => {
    const fetchImplementation = vi.fn(async () =>
      failureResponse("auth.invalid_credentials", "Invalid email or password.", 401)
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    await expect(
      client.login({ email: "wrong@example.com", password: "badpass" })
    ).rejects.toMatchObject({
      code: "auth.invalid_credentials",
      kind: "api",
      status: 401
    });
  });

  it("throws AuthApiClientError with kind network on fetch failure", async () => {
    const fetchImplementation = vi.fn(async () => {
      throw new Error("Network offline");
    });
    const client = createAuthenticationApiClient({ fetchImplementation });

    await expect(
      client.login({ email: "alice@example.com", password: "password1" })
    ).rejects.toMatchObject({
      kind: "network",
      code: "system.unexpected_error"
    });
  });

  it("throws AuthApiClientError with kind malformed-response when body is not the expected envelope", async () => {
    const fetchImplementation = vi.fn(async () =>
      new Response("not json {{{{", { status: 200, headers: { "content-type": "application/json" } })
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    await expect(
      client.login({ email: "alice@example.com", password: "password1" })
    ).rejects.toMatchObject({
      kind: "malformed-response",
      code: "system.unexpected_error"
    });
  });

  it("throws malformed-response when envelope is missing ok field", async () => {
    const fetchImplementation = vi.fn(async () =>
      jsonResponse({ result: "unexpected" })
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    await expect(
      client.login({ email: "alice@example.com", password: "password1" })
    ).rejects.toMatchObject({ kind: "malformed-response" });
  });
});

describe("Authentication API client — register", () => {
  it("calls POST /api/auth/register with email and password (no passwordConfirmation in body)", async () => {
    const fetchImplementation = vi.fn(async () =>
      successResponse({ userId: "user-2", email: "bob@example.com" })
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    const result = await client.register({
      email: "bob@example.com",
      password: "password1",
      passwordConfirmation: "password1"
    });

    expect(result.userId).toBe("user-2");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "bob@example.com", password: "password1" })
      })
    );
  });

  it("throws AuthApiClientError with code validation.invalid_input on duplicate email", async () => {
    const fetchImplementation = vi.fn(async () =>
      failureResponse("validation.invalid_input", "Validation failed", 422)
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    await expect(
      client.register({ email: "existing@example.com", password: "password1", passwordConfirmation: "password1" })
    ).rejects.toMatchObject({
      code: "validation.invalid_input",
      kind: "api",
      status: 422
    });
  });

  it("throws network error kind when fetch throws", async () => {
    const client = createAuthenticationApiClient({
      fetchImplementation: vi.fn(async () => { throw new Error("offline"); })
    });

    await expect(
      client.register({ email: "a@b.com", password: "password1", passwordConfirmation: "password1" })
    ).rejects.toMatchObject({ kind: "network" });
  });
});

describe("Authentication API client — logout", () => {
  it("calls POST /api/auth/logout with Authorization Bearer header", async () => {
    const fetchImplementation = vi.fn(async () =>
      successResponse({ success: true })
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    const result = await client.logout("my-token");

    expect(result.success).toBe(true);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer my-token" })
      })
    );
  });
});

describe("Authentication API client — getMe", () => {
  it("calls GET /api/auth/me with Authorization Bearer header and returns CurrentUser", async () => {
    const fetchImplementation = vi.fn(async () =>
      successResponse(validUser)
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    const user = await client.getMe("session-token");

    expect(user).toEqual(validUser);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ authorization: "Bearer session-token" })
      })
    );
  });

  it("throws with code auth.session_expired on expired token", async () => {
    const fetchImplementation = vi.fn(async () =>
      failureResponse("auth.session_expired", "Session has expired", 401)
    );
    const client = createAuthenticationApiClient({ fetchImplementation });

    await expect(client.getMe("expired-token")).rejects.toMatchObject({
      code: "auth.session_expired",
      kind: "api"
    });
  });
});

describe("AuthApiClientError", () => {
  it("defaults code to system.unexpected_error when none is provided", () => {
    const error = new AuthApiClientError({ message: "oops", kind: "network" });
    expect(error.code).toBe("system.unexpected_error");
    expect(error.kind).toBe("network");
    expect(error.name).toBe("AuthApiClientError");
  });
});
