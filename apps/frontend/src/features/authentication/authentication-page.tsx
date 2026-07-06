import { useState } from "react";
import { Navigate } from "react-router-dom";

import {
  AuthAlert,
  AuthBrand,
  AuthCard,
  AuthField,
  AuthLinkText,
  AuthPrimaryButton
} from "./authentication-components.tsx";
import { useAuth } from "./authentication-context.tsx";
import {
  EMAIL_REGEX,
  MIN_PASSWORD_LENGTH,
  PASSWORD_COMPLEXITY_REGEX,
  AUTH_FIELD_MESSAGES,
  getAuthErrorMessage,
  validateLoginForm,
  validateRegisterForm,
  type FieldError
} from "./authentication-view.ts";

// -----------------------------------------------------------------------------
// AuthenticationPage
// -----------------------------------------------------------------------------

export function AuthenticationPage() {
  const { isAuthenticated, currentUser, status, signIn, signUp, signOut } =
    useAuth();

  // Separate the authenticated and unauthenticated views.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthForms
      signIn={signIn}
      signUp={signUp}
      isSubmitting={status === "submitting"}
    />
  );
}

// -----------------------------------------------------------------------------
// AccountPanel — shown when user is signed in
// -----------------------------------------------------------------------------

export type AccountPanelProps = {
  email: string;
  displayName?: string;
  isSigningOut: boolean;
  onSignOut: () => void;
};

export function AccountPanel({
  email,
  displayName,
  isSigningOut,
  onSignOut
}: AccountPanelProps) {
  return (
    <section className="auth-page" aria-label="Account">
      <div className="auth-page__center">
        <AuthBrand />
        <div className="auth-account-panel">
          <h2 className="auth-account-panel__heading">Your account</h2>
          <dl className="auth-account-panel__details">
            <div className="auth-account-panel__row">
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            {displayName ? (
              <div className="auth-account-panel__row">
                <dt>Name</dt>
                <dd>{displayName}</dd>
              </div>
            ) : null}
          </dl>
          <AuthPrimaryButton
            label={isSigningOut ? "Signing out…" : "Log out"}
            onClick={onSignOut}
            loading={isSigningOut}
            disabled={isSigningOut}
          />
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// AuthForms — login / register toggle when unauthenticated
// -----------------------------------------------------------------------------

type AuthFormsProps = {
  signIn: ReturnType<typeof useAuth>["signIn"];
  signUp: ReturnType<typeof useAuth>["signUp"];
  isSubmitting: boolean;
};

function AuthForms({ signIn, signUp, isSubmitting }: AuthFormsProps) {
  const [screen, setScreen] = useState<"login" | "register">("login");

  // Shared form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  // Error state
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Success banner shown on login screen after successful registration
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function switchTo(next: "login" | "register") {
    setScreen(next);
    setFormError(null);
    setFieldErrors({});
    setSuccessMessage(null);
  }

  function fieldError(field: string): string | undefined {
    return fieldErrors[field];
  }

  function applyFieldErrors(errors: readonly FieldError[]) {
    const map: Record<string, string> = {};
    for (const e of errors) {
      map[e.field] = e.message;
    }
    setFieldErrors(map);
  }

  function setOneFieldError(field: string, message: string) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }

  function clearOneFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // onBlur validators — run only for the blurred field
  // ---------------------------------------------------------------------------

  function handleEmailBlur() {
    if (email === "") return; // Don't flag empty on first touch; submit handles that.
    if (!EMAIL_REGEX.test(email.trim())) {
      setOneFieldError("email", AUTH_FIELD_MESSAGES.emailInvalid);
    } else {
      clearOneFieldError("email");
    }
  }

  function handlePasswordBlur() {
    if (password === "") return;
    if (
      password.length < MIN_PASSWORD_LENGTH ||
      !PASSWORD_COMPLEXITY_REGEX.test(password)
    ) {
      setOneFieldError("password", AUTH_FIELD_MESSAGES.passwordTooShort);
    } else {
      clearOneFieldError("password");
    }
  }

  function handlePasswordConfirmationBlur() {
    if (passwordConfirmation === "") return;
    if (password !== passwordConfirmation) {
      setOneFieldError(
        "passwordConfirmation",
        AUTH_FIELD_MESSAGES.passwordsMismatch
      );
    } else {
      clearOneFieldError("passwordConfirmation");
    }
  }

  // ---------------------------------------------------------------------------
  // Submit handlers
  // ---------------------------------------------------------------------------

  async function handleLogin() {
    const values = { email, password };
    const validation = validateLoginForm(values);

    if (!validation.ok) {
      applyFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);

    const result = await signIn(values);
    if (!result.ok) {
      setFormError(getAuthErrorMessage(result.code));
    }
  }

  async function handleRegister() {
    const values = { email, password, passwordConfirmation };
    const validation = validateRegisterForm(values);

    if (!validation.ok) {
      applyFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const result = await signUp(values);

    if (!result.ok) {
      // Duplicate email → field-level error on email; anything else → form banner.
      if (result.code === "validation.invalid_input") {
        setOneFieldError(
          "email",
          getAuthErrorMessage("validation.invalid_input")
        );
      } else {
        setFormError(getAuthErrorMessage(result.code));
      }
      return;
    }

    // Registration succeeded — set success message then switch to login manually
    // so that switchTo() does not clear successMessage.
    setPassword("");
    setPasswordConfirmation("");
    setScreen("login");
    setFormError(null);
    setFieldErrors({});
    setSuccessMessage("Account created. Please log in.");
  }

  return (
    <section className="auth-page" aria-label={screen === "login" ? "Log in" : "Create account"}>
      <div className="auth-page__center">
        <AuthBrand />

        {screen === "login" ? (
          <AuthCard title="Log in">
            {successMessage ? (
              <p className="auth-success-banner" role="status">
                {successMessage}
              </p>
            ) : null}
            {formError ? <AuthAlert message={formError} /> : null}
            <form
              noValidate
              className="auth-page__form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleLogin();
              }}
            >
              <AuthField
                id="auth-login-email"
                label="Email"
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setSuccessMessage(null);
                }}
                onBlur={handleEmailBlur}
                error={fieldError("email")}
                autoComplete="email"
                disabled={isSubmitting}
              />
              <AuthField
                id="auth-login-password"
                label="Password"
                type="password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setSuccessMessage(null);
                }}
                error={fieldError("password")}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <AuthPrimaryButton
                type="submit"
                label="Log in"
                loading={isSubmitting}
                disabled={isSubmitting}
              />
            </form>
            <p className="auth-page__switch">
              Need an account?{" "}
              <AuthLinkText onClick={() => switchTo("register")}>
                Register
              </AuthLinkText>
            </p>
          </AuthCard>
        ) : (
          <AuthCard title="Create account">
            {formError ? <AuthAlert message={formError} /> : null}
            <form
              noValidate
              className="auth-page__form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleRegister();
              }}
            >
              <AuthField
                id="auth-register-email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                onBlur={handleEmailBlur}
                error={fieldError("email")}
                autoComplete="email"
                disabled={isSubmitting}
              />
              <AuthField
                id="auth-register-password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                onBlur={handlePasswordBlur}
                error={fieldError("password")}
                helperText="At least 8 characters, including a letter and a number."
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <AuthField
                id="auth-register-password-confirmation"
                label="Confirm password"
                type="password"
                value={passwordConfirmation}
                onChange={setPasswordConfirmation}
                onBlur={handlePasswordConfirmationBlur}
                error={fieldError("passwordConfirmation")}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <AuthPrimaryButton
                type="submit"
                label="Create account"
                loading={isSubmitting}
                disabled={isSubmitting}
              />
            </form>
            <p className="auth-page__switch">
              Already have an account?{" "}
              <AuthLinkText onClick={() => switchTo("login")}>
                Log in
              </AuthLinkText>
            </p>
          </AuthCard>
        )}
      </div>
    </section>
  );
}
