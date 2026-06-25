import { act, cleanup, renderHook } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthProvider,
  useAuth
} from "@vcp/frontend/features/authentication/authentication-context.tsx";
import type { AuthenticationApiClient } from "@vcp/frontend/features/authentication/authentication-api-client.ts";
import { AuthApiClientError } from "@vcp/frontend/features/authentication/authentication-api-client.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TOKEN_KEY = "vcp.auth.token";

const validUser = {
  userId: "user-1",
  email: "alice@example.com",
  displayName: "Alice"
};

const validSession = {
  sessionToken: "tok-abc",
  expiresAt: "2026-12-31T00:00:00.000Z"
};

function makeApiClient(overrides: Partial<AuthenticationApiClient> = {}): AuthenticationApiClient {
  return {
    register: vi.fn(async () => ({ userId: "user-2", email: "bob@example.com" })),
    login: vi.fn(async () => ({ user: validUser, session: validSession })),
    logout: vi.fn(async () => ({ success: true })),
    getMe: vi.fn(async () => validUser),
    ...overrides
  };
}

function makeApiError(code: string, message = "API error"): AuthApiClientError {
  return new AuthApiClientError({ message, code, kind: "api", status: 401 });
}

function wrapper(apiClient: AuthenticationApiClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider apiClient={apiClient}>{children}</AuthProvider>;
  };
}

function renderAuth(apiClient: AuthenticationApiClient) {
  return renderHook(() => useAuth(), { wrapper: wrapper(apiClient) });
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

describe("AuthProvider — bootstrap", () => {
  it("starts as not authenticated when localStorage is empty", async () => {
    const apiClient = makeApiClient();
    const { result } = renderAuth(apiClient);

    // Wait for initializing -> idle transition
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.sessionToken).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(apiClient.getMe).not.toHaveBeenCalled();
  });

  it("restores user when a valid token exists in localStorage", async () => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    const apiClient = makeApiClient({
      getMe: vi.fn(async () => validUser)
    });

    const { result } = renderAuth(apiClient);
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser).toEqual(validUser);
    expect(result.current.sessionToken).toBe("stored-token");
    expect(result.current.status).toBe("idle");
    expect(apiClient.getMe).toHaveBeenCalledWith("stored-token");
  });

  it("clears localStorage and stays unauthenticated when stored token is invalid", async () => {
    localStorage.setItem(TOKEN_KEY, "bad-token");
    const apiClient = makeApiClient({
      getMe: vi.fn(async () => { throw makeApiError("auth.session_expired"); })
    });

    const { result } = renderAuth(apiClient);
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.sessionToken).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// signIn
// -----------------------------------------------------------------------------

describe("AuthProvider — signIn", () => {
  it("returns ok:true and sets isAuthenticated + currentUser + persists token", async () => {
    const apiClient = makeApiClient();
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await act(async () => {
      signInResult = await result.current.signIn({ email: "alice@example.com", password: "password1" });
    });

    expect(signInResult!.ok).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUser).toEqual(validUser);
    expect(result.current.sessionToken).toBe("tok-abc");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok-abc");
    expect(result.current.status).toBe("idle");
  });

  it("returns ok:false with code when API returns invalid credentials", async () => {
    const apiClient = makeApiClient({
      login: vi.fn(async () => { throw makeApiError("auth.invalid_credentials"); })
    });
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await act(async () => {
      signInResult = await result.current.signIn({ email: "wrong@example.com", password: "bad" });
    });

    expect(signInResult!.ok).toBe(false);
    if (!signInResult!.ok) {
      expect(signInResult!.code).toBe("auth.invalid_credentials");
    }
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.status).toBe("error");
  });

  it("returns ok:false with system.unexpected_error code on network failure", async () => {
    const apiClient = makeApiClient({
      login: vi.fn(async () => { throw new Error("offline"); })
    });
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await act(async () => {
      signInResult = await result.current.signIn({ email: "a@b.com", password: "password1" });
    });

    expect(signInResult!.ok).toBe(false);
    if (!signInResult!.ok) {
      expect(signInResult!.code).toBe("system.unexpected_error");
    }
  });
});

// -----------------------------------------------------------------------------
// signUp
// -----------------------------------------------------------------------------

describe("AuthProvider — signUp", () => {
  it("returns ok:true and does NOT set isAuthenticated (no auto-login)", async () => {
    const apiClient = makeApiClient();
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      signUpResult = await result.current.signUp({
        email: "new@example.com",
        password: "password1",
        passwordConfirmation: "password1"
      });
    });

    expect(signUpResult!.ok).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.sessionToken).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    // login should NOT have been called
    expect(apiClient.login).not.toHaveBeenCalled();
  });

  it("returns ok:false with code when email is already registered", async () => {
    const apiClient = makeApiClient({
      register: vi.fn(async () => { throw makeApiError("validation.invalid_input"); })
    });
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      signUpResult = await result.current.signUp({
        email: "existing@example.com",
        password: "password1",
        passwordConfirmation: "password1"
      });
    });

    expect(signUpResult!.ok).toBe(false);
    if (!signUpResult!.ok) {
      expect(signUpResult!.code).toBe("validation.invalid_input");
    }
  });
});

// -----------------------------------------------------------------------------
// signOut
// -----------------------------------------------------------------------------

describe("AuthProvider — signOut", () => {
  it("clears state and localStorage after a successful logout", async () => {
    const apiClient = makeApiClient();
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    // First sign in
    await act(async () => {
      await result.current.signIn({ email: "alice@example.com", password: "password1" });
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Then sign out
    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.sessionToken).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.status).toBe("idle");
  });

  it("clears state and localStorage even when logout API throws", async () => {
    const apiClient = makeApiClient({
      logout: vi.fn(async () => { throw new Error("network error"); })
    });
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    await act(async () => {
      await result.current.signIn({ email: "alice@example.com", password: "password1" });
    });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.sessionToken).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.status).toBe("idle");
  });

  it("does not call logout API when there is no session token", async () => {
    const apiClient = makeApiClient();
    const { result } = renderAuth(apiClient);
    await act(async () => {});

    await act(async () => {
      await result.current.signOut();
    });

    expect(apiClient.logout).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// useAuth outside provider
// -----------------------------------------------------------------------------

describe("useAuth", () => {
  it("throws when called outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      /useAuth must be called inside an <AuthProvider>/
    );
  });
});
