// =============================================================================
// Tests for RequireAuth.
//
// Strategy: wrap RequireAuth in a real AuthProvider backed by a fake apiClient,
// matching the pattern established by authentication-context.test.tsx.
//
// Three cases:
//   1. Authenticated     — token in localStorage, getMe resolves → children shown.
//   2. Unauthenticated   — no token in localStorage → fallback shown.
//   3. Initializing      — token in localStorage, getMe never resolves → loading
//                          indicator shown; neither children nor fallback shown.
// =============================================================================

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./authentication-context.tsx";
import { RequireAuth } from "./authentication-require-auth.tsx";
import type { AuthenticationApiClient } from "./authentication-api-client.ts";
import type { CurrentUser, LoginFormValues, RegisterFormValues } from "./authentication-view.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TOKEN_STORAGE_KEY = "vcp.auth.token";

const FAKE_USER: CurrentUser = {
  userId: "user-1",
  email: "alice@example.com",
  displayName: "Alice"
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Builds a minimal fake apiClient. All methods are stubs unless overridden. */
function makeApiClient(
  overrides: Partial<AuthenticationApiClient> = {}
): AuthenticationApiClient {
  return {
    register: vi.fn<[RegisterFormValues], Promise<{ userId: string; email: string }>>(
      () => Promise.resolve({ userId: "u1", email: "a@b.com" })
    ),
    login: vi.fn<[LoginFormValues], Promise<{ user: CurrentUser; session: { sessionToken: string; expiresAt: string } }>>(
      () =>
        Promise.resolve({
          user: FAKE_USER,
          session: { sessionToken: "tok-123", expiresAt: "2099-01-01T00:00:00Z" }
        })
    ),
    logout: vi.fn<[string], Promise<{ success: boolean }>>(
      () => Promise.resolve({ success: true })
    ),
    getMe: vi.fn<[string], Promise<CurrentUser>>(
      () => Promise.resolve(FAKE_USER)
    ),
    ...overrides
  };
}

function renderWithAuth(
  ui: React.ReactNode,
  apiClient: AuthenticationApiClient
) {
  return render(
    <AuthProvider apiClient={apiClient}>{ui}</AuthProvider>
  );
}

// -----------------------------------------------------------------------------
// Setup / teardown
// -----------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("RequireAuth", () => {
  describe("when authenticated (valid token in localStorage, getMe resolves)", () => {
    it("renders children", async () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, "valid-token");

      const apiClient = makeApiClient({
        getMe: vi.fn().mockResolvedValue(FAKE_USER)
      });

      renderWithAuth(
        <RequireAuth fallback={<p>Please log in</p>}>
          <p>Secret content</p>
        </RequireAuth>,
        apiClient
      );

      // Wait for the initializing phase to complete.
      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Secret content")).toBeInTheDocument();
      expect(screen.queryByText("Please log in")).not.toBeInTheDocument();
    });
  });

  describe("when unauthenticated (no token in localStorage)", () => {
    it("renders fallback, not children", async () => {
      // No token — AuthProvider sets status to "idle" immediately.
      const apiClient = makeApiClient();

      renderWithAuth(
        <RequireAuth fallback={<p>Please log in</p>}>
          <p>Secret content</p>
        </RequireAuth>,
        apiClient
      );

      // Wait for initializing to resolve (no async work here, but keep consistent).
      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Please log in")).toBeInTheDocument();
      expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
    });
  });

  describe("while initializing (token present, getMe never resolves)", () => {
    it("renders the session-check indicator, not children or fallback", async () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, "pending-token");

      // getMe returns a promise that never settles — status stays "initializing".
      const apiClient = makeApiClient({
        getMe: vi.fn().mockReturnValue(new Promise<CurrentUser>(() => {}))
      });

      renderWithAuth(
        <RequireAuth fallback={<p>Please log in</p>}>
          <p>Secret content</p>
        </RequireAuth>,
        apiClient
      );

      // The loading indicator must be present immediately (synchronous render).
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Checking your session")).toBeInTheDocument();

      // Neither children nor fallback should appear.
      expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
      expect(screen.queryByText("Please log in")).not.toBeInTheDocument();
    });
  });
});
