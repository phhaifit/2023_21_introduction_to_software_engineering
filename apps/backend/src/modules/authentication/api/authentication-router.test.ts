import { describe, it, expect, vi, type MockedFunction } from "vitest";
import type { Request, Response } from "express";

import { EmailAlreadyUsedError, InvalidCredentialsError, SessionExpiredError, SessionNotFoundError, ValidationError } from "../domain/errors.ts";
import type { RegisterUseCase } from "../application/register-use-case.ts";
import type { LoginUseCase } from "../application/login-use-case.ts";
import type { LogoutUseCase } from "../application/logout-use-case.ts";
import type { AuthenticateSessionUseCase } from "../application/authenticate-session-use-case.ts";
import type { UserPublicProfile } from "../domain/user-public-profile.ts";
import type { LoginResult } from "../application/login-use-case.ts";
import { createAuthenticationRouter } from "./authentication-router.ts";

// ---------------------------------------------------------------------------
// Helpers to build mock Express req/res pairs
// ---------------------------------------------------------------------------

function makeMockRequest(body: unknown = {}): Request {
  return {
    body,
    header: (_name: string) => undefined,
  } as unknown as Request;
}

function makeMockRequestWithHeader(
  body: unknown,
  headers: Record<string, string | undefined>
): Request {
  return {
    body,
    header: (name: string) => headers[name],
  } as unknown as Request;
}

type MockResponse = {
  status: MockedFunction<(code: number) => MockResponse>;
  json: MockedFunction<(body: unknown) => MockResponse>;
  _statusCode?: number;
  _body?: unknown;
};

function makeMockResponse(): MockResponse {
  const res: MockResponse = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res._statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res._body = body;
    return res;
  });
  return res;
}

// ---------------------------------------------------------------------------
// Stub use cases
// ---------------------------------------------------------------------------

const STUB_USER_PROFILE: UserPublicProfile = {
  userId: "user-123" as any,
  email: "alice@example.com",
  displayName: "Alice",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const STUB_LOGIN_RESULT: LoginResult = {
  user: STUB_USER_PROFILE,
  session: {
    token: "raw-token-abc",
    expiresAt: "2026-01-08T00:00:00.000Z",
  },
};

function makeRegisterUseCase(
  impl: RegisterUseCase["execute"]
): RegisterUseCase {
  return { execute: impl } as unknown as RegisterUseCase;
}

function makeLoginUseCase(impl: LoginUseCase["execute"]): LoginUseCase {
  return { execute: impl } as unknown as LoginUseCase;
}

function makeLogoutUseCase(impl: LogoutUseCase["execute"]): LogoutUseCase {
  return { execute: impl } as unknown as LogoutUseCase;
}

function makeAuthenticateSessionUseCase(
  impl: AuthenticateSessionUseCase["execute"]
): AuthenticateSessionUseCase {
  return { execute: impl } as unknown as AuthenticateSessionUseCase;
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

describe("POST /register controller", () => {
  it("happy path: calls use case and returns user summary without password fields", async () => {
    const registerExecute = vi.fn().mockResolvedValue(STUB_USER_PROFILE);
    const loginExecute = vi.fn();

    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(registerExecute),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({
      email: "alice@example.com",
      password: "correct horse battery staple",
      displayName: "Alice",
    });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/register");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(registerExecute).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "correct horse battery staple",
      displayName: "Alice",
    });

    expect(res._statusCode).toBe(200);
    const body = res._body as any;
    expect(body.ok).toBe(true);
    expect(body.data.userId).toBe("user-123");
    expect(body.data.email).toBe("alice@example.com");
    expect(body.data.displayName).toBe("Alice");
    expect(body.data.status).toBe("active");
    expect("password" in body.data).toBe(false);
    expect("passwordHash" in body.data).toBe(false);
  });

  it("missing email field → validation.invalid_input (422)", async () => {
    const registerExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(registerExecute),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({ password: "correct horse battery staple" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/register");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation.invalid_input");
    expect(registerExecute).not.toHaveBeenCalled();
  });

  it("missing password field → validation.invalid_input (422)", async () => {
    const registerExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(registerExecute),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({ email: "alice@example.com" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/register");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation.invalid_input");
  });

  it("use case throws ValidationError (domain validation) → validation.invalid_input (422)", async () => {
    const registerExecute = vi
      .fn()
      .mockRejectedValue(new ValidationError({ email: "Email format is invalid" }));
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(registerExecute),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({ email: "bad-email", password: "12345678" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/register");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation.invalid_input");
  });

  it("use case throws EmailAlreadyUsedError → validation.invalid_input (422)", async () => {
    const registerExecute = vi
      .fn()
      .mockRejectedValue(new EmailAlreadyUsedError("alice@example.com"));
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(registerExecute),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/register");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation.invalid_input");
    expect(body.error.message).toBe("Email already used: alice@example.com");
  });

  it("unexpected error → system.unexpected_error (500)", async () => {
    const registerExecute = vi.fn().mockRejectedValue(new Error("DB down"));
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(registerExecute),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/register");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(500);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("system.unexpected_error");
  });
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

describe("POST /login controller", () => {
  it("happy path: calls use case and returns user summary + session token", async () => {
    const loginExecute = vi.fn().mockResolvedValue(STUB_LOGIN_RESULT);
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/login");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(loginExecute).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });

    expect(res._statusCode).toBe(200);
    const body = res._body as any;
    expect(body.ok).toBe(true);
    expect(body.data.user.userId).toBe("user-123");
    expect(body.data.user.email).toBe("alice@example.com");
    expect(body.data.session.token).toBe("raw-token-abc");
    expect(body.data.session.expiresAt).toBe("2026-01-08T00:00:00.000Z");
    expect("password" in body.data.user).toBe(false);
    expect("passwordHash" in body.data.user).toBe(false);
  });

  it("invalid credentials → auth.invalid_credentials (401)", async () => {
    const loginExecute = vi
      .fn()
      .mockRejectedValue(new InvalidCredentialsError());
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({
      email: "alice@example.com",
      password: "wrong-password",
    });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/login");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(401);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("auth.invalid_credentials");
  });

  it("missing email field → validation.invalid_input (422)", async () => {
    const loginExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({ password: "correct horse battery staple" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/login");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation.invalid_input");
    expect(loginExecute).not.toHaveBeenCalled();
  });

  it("missing password field → validation.invalid_input (422)", async () => {
    const loginExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({ email: "alice@example.com" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/login");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation.invalid_input");
    expect(loginExecute).not.toHaveBeenCalled();
  });

  it("empty body → validation.invalid_input (422)", async () => {
    const loginExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({});
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/login");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(422);
    expect(loginExecute).not.toHaveBeenCalled();
  });

  it("unexpected error → system.unexpected_error (500)", async () => {
    const loginExecute = vi.fn().mockRejectedValue(new Error("DB down"));
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(loginExecute),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequest({
      email: "alice@example.com",
      password: "correct horse battery staple",
    });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/login");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(500);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("system.unexpected_error");
  });
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

describe("POST /logout controller", () => {
  it("happy path: valid Bearer token → calls use case with rawToken → 200 success", async () => {
    const logoutExecute = vi.fn().mockResolvedValue(undefined);
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(logoutExecute),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequestWithHeader({}, { Authorization: "Bearer my-secret-token" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/logout");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(logoutExecute).toHaveBeenCalledWith({ rawToken: "my-secret-token" });
    expect(res._statusCode).toBe(200);
    const body = res._body as any;
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it("idempotent: use case throws SessionNotFoundError → still 200 success", async () => {
    const logoutExecute = vi.fn().mockRejectedValue(new SessionNotFoundError());
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(logoutExecute),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequestWithHeader({}, { Authorization: "Bearer already-revoked-token" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/logout");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(200);
    const body = res._body as any;
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it("missing Authorization header → auth.unauthorized (401)", async () => {
    const logoutExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(logoutExecute),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequestWithHeader({}, {});
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/logout");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(401);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("auth.unauthorized");
    expect(logoutExecute).not.toHaveBeenCalled();
  });

  it("Authorization header without Bearer prefix → auth.unauthorized (401)", async () => {
    const logoutExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(logoutExecute),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequestWithHeader({}, { Authorization: "Basic dXNlcjpwYXNz" });
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "POST", "/logout");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(401);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("auth.unauthorized");
    expect(logoutExecute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /me controller
// ---------------------------------------------------------------------------

const STUB_AUTH_USER = {
  userId: "user-123" as any,
  email: "alice@example.com",
  displayName: "Alice",
};

describe("GET /me controller", () => {
  it("authenticated user in context → 200 with userId, email, displayName (no passwordHash)", async () => {
    const authenticateExecute = vi.fn().mockResolvedValue(STUB_AUTH_USER);
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(authenticateExecute),
    });

    // Simulate middleware having already resolved and set context.user
    const req = makeMockRequestWithHeader({}, { Authorization: "Bearer valid-token" }) as any;
    req.context = { requestId: "req-1", user: STUB_AUTH_USER };
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "GET", "/me");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(200);
    const body = res._body as any;
    expect(body.ok).toBe(true);
    expect(body.data.userId).toBe("user-123");
    expect(body.data.email).toBe("alice@example.com");
    expect(body.data.displayName).toBe("Alice");
    expect("passwordHash" in body.data).toBe(false);
  });

  it("no user in context → 401 auth.unauthorized", async () => {
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(vi.fn()),
    });

    const req = makeMockRequestWithHeader({}, {}) as any;
    req.context = { requestId: "req-2" }; // no user
    const res = makeMockResponse();

    const handler = extractRouteHandler(router, "GET", "/me");
    await handler(req as Request, res as unknown as Response, vi.fn());

    expect(res._statusCode).toBe(401);
    const body = res._body as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("auth.unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Auth session middleware
// ---------------------------------------------------------------------------

describe("createAuthSessionMiddleware (via router GET /me)", () => {
  it("valid Bearer token → use case called → user merged into context", async () => {
    const authenticateExecute = vi.fn().mockResolvedValue(STUB_AUTH_USER);
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(authenticateExecute),
    });

    // Extract the middleware (second-to-last handler in /me route stack)
    const layers: any[] = (router as any).stack;
    const meLayer = layers.find(
      (l: any) => l.route && l.route.path === "/me" && l.route.methods["get"]
    );
    const middlewareHandle = meLayer.route.stack[0].handle as (
      req: Request,
      res: Response,
      next: () => void
    ) => Promise<void>;

    const req = makeMockRequestWithHeader({}, { Authorization: "Bearer my-token" }) as any;
    req.context = { requestId: "req-3" };
    const res = makeMockResponse();
    const next = vi.fn();

    await middlewareHandle(req as Request, res as unknown as Response, next);

    expect(authenticateExecute).toHaveBeenCalledWith({ rawToken: "my-token" });
    expect((req as any).context.user).toEqual(STUB_AUTH_USER);
    expect((req as any).context.requestId).toBe("req-3"); // requestId preserved
    expect(next).toHaveBeenCalled();
  });

  it("no Authorization header → next() called without setting user", async () => {
    const authenticateExecute = vi.fn();
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(authenticateExecute),
    });

    const layers: any[] = (router as any).stack;
    const meLayer = layers.find(
      (l: any) => l.route && l.route.path === "/me" && l.route.methods["get"]
    );
    const middlewareHandle = meLayer.route.stack[0].handle as (
      req: Request,
      res: Response,
      next: () => void
    ) => Promise<void>;

    const req = makeMockRequestWithHeader({}, {}) as any;
    req.context = { requestId: "req-4" };
    const res = makeMockResponse();
    const next = vi.fn();

    await middlewareHandle(req as Request, res as unknown as Response, next);

    expect(authenticateExecute).not.toHaveBeenCalled();
    expect((req as any).context.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("use case throws SessionExpiredError → next() called without user", async () => {
    const authenticateExecute = vi.fn().mockRejectedValue(new SessionExpiredError());
    const router = createAuthenticationRouter({
      registerUseCase: makeRegisterUseCase(vi.fn()),
      loginUseCase: makeLoginUseCase(vi.fn()),
      logoutUseCase: makeLogoutUseCase(vi.fn()),
      authenticateSessionUseCase: makeAuthenticateSessionUseCase(authenticateExecute),
    });

    const layers: any[] = (router as any).stack;
    const meLayer = layers.find(
      (l: any) => l.route && l.route.path === "/me" && l.route.methods["get"]
    );
    const middlewareHandle = meLayer.route.stack[0].handle as (
      req: Request,
      res: Response,
      next: () => void
    ) => Promise<void>;

    const req = makeMockRequestWithHeader({}, { Authorization: "Bearer expired-token" }) as any;
    req.context = { requestId: "req-5" };
    const res = makeMockResponse();
    const next = vi.fn();

    await middlewareHandle(req as Request, res as unknown as Response, next);

    expect((req as any).context.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Helper: extract route handler from Express Router layer stack
// ---------------------------------------------------------------------------

function extractRouteHandler(
  router: ReturnType<typeof createAuthenticationRouter>,
  method: string,
  path: string
) {
  const layers: any[] = (router as any).stack;
  const layer = layers.find(
    (l: any) =>
      l.route &&
      l.route.path === path &&
      l.route.methods[method.toLowerCase()]
  );
  if (!layer) {
    throw new Error(`Route ${method} ${path} not found in router`);
  }
  const routeLayer: any[] = layer.route.stack;
  // Return the last handler (the async handler, not middlewares)
  return routeLayer[routeLayer.length - 1].handle as (
    req: Request,
    res: Response,
    next: () => void
  ) => Promise<void>;
}
