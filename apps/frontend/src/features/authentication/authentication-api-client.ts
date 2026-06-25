// =============================================================================
// Authentication API client.
// Pattern mirrors agent-management-api-client.ts.
// =============================================================================

import type { CurrentUser, LoginFormValues, RegisterFormValues, SessionData } from "./authentication-view.ts";

// -----------------------------------------------------------------------------
// Error class
// -----------------------------------------------------------------------------

export type AuthApiClientErrorKind = "api" | "network" | "malformed-response";

export class AuthApiClientError extends Error {
  readonly code: string;
  readonly kind: AuthApiClientErrorKind;
  readonly status?: number;

  constructor(input: {
    message: string;
    code?: string;
    status?: number;
    kind: AuthApiClientErrorKind;
  }) {
    super(input.message);
    this.name = "AuthApiClientError";
    this.code = input.code ?? "system.unexpected_error";
    this.kind = input.kind;
    this.status = input.status;
  }
}

// -----------------------------------------------------------------------------
// Response shapes returned to callers
// -----------------------------------------------------------------------------

export type RegisterResult = {
  userId: string;
  email: string;
  displayName?: string;
};

export type LoginResult = {
  user: CurrentUser;
  session: SessionData;
};

export type LogoutResult = {
  success: boolean;
};

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

type FetchImplementation = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformedResponse(status: number): AuthApiClientError {
  return new AuthApiClientError({
    message: "The Authentication API returned an invalid response.",
    status,
    kind: "malformed-response"
  });
}

async function request<T>(
  path: string,
  init: RequestInit,
  fetchImplementation: FetchImplementation
): Promise<T> {
  let response: Response;

  try {
    response = await fetchImplementation(path, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers
      }
    });
  } catch {
    throw new AuthApiClientError({
      message: "Unable to reach the Authentication API.",
      kind: "network"
    });
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw malformedResponse(response.status);
  }

  if (!isRecord(body) || typeof body.ok !== "boolean") {
    throw malformedResponse(response.status);
  }

  if (body.ok === false) {
    const error = body.error;

    if (
      !isRecord(error) ||
      typeof error.code !== "string" ||
      typeof error.message !== "string"
    ) {
      throw malformedResponse(response.status);
    }

    throw new AuthApiClientError({
      code: error.code,
      message: error.message as string,
      status: response.status,
      kind: "api"
    });
  }

  if (!("data" in body)) {
    throw malformedResponse(response.status);
  }

  return body.data as T;
}

// -----------------------------------------------------------------------------
// Client factory
// -----------------------------------------------------------------------------

export type AuthenticationApiClient = {
  register(values: RegisterFormValues): Promise<RegisterResult>;
  login(values: LoginFormValues): Promise<LoginResult>;
  logout(token: string): Promise<LogoutResult>;
  getMe(token: string): Promise<CurrentUser>;
};

export function createAuthenticationApiClient(input: {
  fetchImplementation?: FetchImplementation;
  baseUrl?: string;
} = {}): AuthenticationApiClient {
  const doFetch = input.fetchImplementation ?? fetch;
  const baseUrl = input.baseUrl?.replace(/\/$/, "") ?? "";

  return {
    register(values) {
      return request<RegisterResult>(
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          body: JSON.stringify({
            email: values.email,
            password: values.password
          })
        },
        doFetch
      );
    },

    login(values) {
      return request<{ user: Record<string, unknown>; session: Record<string, unknown> }>(
        `${baseUrl}/api/auth/login`,
        {
          method: "POST",
          body: JSON.stringify({
            email: values.email,
            password: values.password
          })
        },
        doFetch
      ).then((raw) => ({
        user: {
          userId: raw.user.userId as string,
          email: raw.user.email as string,
          displayName:
            typeof raw.user.displayName === "string"
              ? raw.user.displayName
              : undefined
        },
        session: {
          sessionToken: raw.session.token as string,
          expiresAt: raw.session.expiresAt as string
        }
      }));
    },

    logout(token) {
      return request<LogoutResult>(
        `${baseUrl}/api/auth/logout`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}` }
        },
        doFetch
      );
    },

    getMe(token) {
      return request<CurrentUser>(
        `${baseUrl}/api/auth/me`,
        {
          method: "GET",
          headers: { authorization: `Bearer ${token}` }
        },
        doFetch
      );
    }
  };
}
