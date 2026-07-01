import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../../apps/frontend/src/features/authentication/authentication-context.tsx";
import type { AuthenticationApiClient } from "../../apps/frontend/src/features/authentication/authentication-api-client.ts";
import { AuthenticationPage } from "../../apps/frontend/src/features/authentication/authentication-page.tsx";
import {
  AUTH_FIELD_MESSAGES,
  PASSWORD_COMPLEXITY_REGEX,
  type CurrentUser,
  type LoginFormValues,
  type RegisterFormValues
} from "../../apps/frontend/src/features/authentication/authentication-view.ts";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function makeApiClient(overrides: Partial<AuthenticationApiClient> = {}): AuthenticationApiClient {
  const user: CurrentUser = {
    userId: "user-1",
    email: "new@example.com",
    displayName: "New User"
  };

  return {
    register: vi.fn<[RegisterFormValues], Promise<{ userId: string; email: string }>>(
      async () => ({ userId: user.userId, email: user.email })
    ),
    login: vi.fn<[LoginFormValues], Promise<{ user: CurrentUser; session: { sessionToken: string; expiresAt: string } }>>(
      async () => ({
        user,
        session: { sessionToken: "token-1", expiresAt: "2099-01-01T00:00:00Z" }
      })
    ),
    logout: vi.fn<[string], Promise<{ success: boolean }>>(async () => ({ success: true })),
    getMe: vi.fn<[string], Promise<CurrentUser>>(async () => user),
    ...overrides
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthenticationPage registration validation", () => {
  it("updates password field errors from the latest state instead of a stale render snapshot", () => {
    const page = source("apps/frontend/src/features/authentication/authentication-page.tsx");
    const passwordChangeBody = page.slice(
      page.indexOf("function handlePasswordChange"),
      page.indexOf("function handlePasswordConfirmationChange")
    );

    expect(passwordChangeBody).toContain("setFieldErrors((prev)");
    expect(passwordChangeBody).not.toContain("fieldErrors.password");
    expect(passwordChangeBody).not.toContain("fieldErrors.passwordConfirmation");
  });

  it("uses a non-global password regex so repeated validation is stable", () => {
    expect(PASSWORD_COMPLEXITY_REGEX.global).toBe(false);
    expect(PASSWORD_COMPLEXITY_REGEX.test("Password123")).toBe(true);
    expect(PASSWORD_COMPLEXITY_REGEX.test("Password123")).toBe(true);
  });

  it("clears the password validation error when the user types a valid password", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider apiClient={makeApiClient()}>
        <AuthenticationPage />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");

    const passwordInput = document.getElementById("auth-register-password") as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    await user.type(passwordInput, "abcdefgh");
    await user.tab();
    expect(screen.getByText(AUTH_FIELD_MESSAGES.passwordTooShort)).toBeInTheDocument();

    await user.clear(passwordInput);
    await user.type(passwordInput, "Password123");

    expect(screen.queryByText(AUTH_FIELD_MESSAGES.passwordTooShort)).not.toBeInTheDocument();
  });

  it("submits create account after replacing an invalid password with a valid one", async () => {
    const user = userEvent.setup();
    const register = vi.fn<[RegisterFormValues], Promise<{ userId: string; email: string }>>(
      async () => ({ userId: "user-1", email: "new@example.com" })
    );

    render(
      <AuthProvider apiClient={makeApiClient({ register })}>
        <AuthenticationPage />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(document.getElementById("auth-register-password") as HTMLInputElement, "abcdefgh");
    await user.type(screen.getByLabelText("Confirm password"), "abcdefgh");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText(AUTH_FIELD_MESSAGES.passwordTooShort)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await user.clear(document.getElementById("auth-register-password") as HTMLInputElement);
    await user.type(document.getElementById("auth-register-password") as HTMLInputElement, "Password123");
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("Confirm password"), "Password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(register).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "Password123",
      passwordConfirmation: "Password123"
    }));
    expect(screen.queryByText(AUTH_FIELD_MESSAGES.passwordTooShort)).not.toBeInTheDocument();
  });
});
