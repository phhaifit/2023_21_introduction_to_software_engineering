// =============================================================================
// Authentication View — shared types, validation, and product-facing messages.
// Pattern mirrors agent-management-view.ts: types, constants, and pure
// functions are co-located in a single module-scoped file.
// =============================================================================

// -----------------------------------------------------------------------------
// Shared types
// -----------------------------------------------------------------------------

/** The screen the auth feature is currently showing. */
export type AuthScreen = "login" | "register" | "dashboard";

/** Status of an auth form submission. */
export type AuthFormStatus = "idle" | "submitting" | "error" | "success";

export type LoginFormValues = {
  email: string;
  password: string;
};

export type RegisterFormValues = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

/** A single field-level validation error. */
export type FieldError = {
  field: string;
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: readonly FieldError[] };

/** Represents the active session returned by POST /auth/login. */
export type SessionData = {
  sessionToken: string;
  expiresAt: string;
};

/**
 * The currently authenticated user, shaped after GET /me.
 * displayName is optional because new accounts may not have set one yet.
 */
export type CurrentUser = {
  userId: string;
  email: string;
  displayName?: string;
};

// -----------------------------------------------------------------------------
// Validation constants
// -----------------------------------------------------------------------------

/** RFC 5322-inspired email pattern — covers the common cases without false negatives. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimum password length (inclusive). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Password must contain at least one letter and at least one digit.
 * Backend enforces the same constraint; we validate client-side to give
 * immediate feedback before the network round-trip.
 */
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

// -----------------------------------------------------------------------------
// Field-level validation messages
// -----------------------------------------------------------------------------

export const AUTH_FIELD_MESSAGES = {
  emailInvalid: "Enter a valid email address.",
  passwordTooShort: `Use at least ${MIN_PASSWORD_LENGTH} characters, including a letter and a number.`,
  passwordsMismatch: "Passwords don't match."
} as const;

// -----------------------------------------------------------------------------
// Form-level (API error code → user-visible) messages
// -----------------------------------------------------------------------------

/**
 * Maps API error codes to product-facing messages.
 * The mapping is intentionally conservative: we never expose internal
 * identifiers or technical details to the end user.
 */
const AUTH_ERROR_MESSAGE_MAP: Record<string, string> = {
  "auth.invalid_credentials": "Invalid email or password.",
  "auth.unauthorized": "You must be signed in to access this page.",
  "auth.session_expired": "Your session has expired. Please log in again.",
  "auth.forbidden": "You don't have permission to perform this action.",
  "validation.invalid_input": "This email is already registered.",
  "system.unexpected_error": "Something went wrong. Please try again."
};

const AUTH_ERROR_MESSAGE_FALLBACK =
  "Something went wrong. Please try again.";

/**
 * Returns a product-facing message for the given API error code.
 * Falls back to a safe generic message for any unrecognised code.
 */
export function getAuthErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGE_MAP[code] ?? AUTH_ERROR_MESSAGE_FALLBACK;
}

// -----------------------------------------------------------------------------
// Pure validation functions
// -----------------------------------------------------------------------------

/**
 * Validates login form values client-side.
 * Pure function: same input always produces same output, no side effects.
 */
export function validateLoginForm(values: LoginFormValues): ValidationResult {
  const errors: FieldError[] = [];

  if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.push({ field: "email", message: AUTH_FIELD_MESSAGES.emailInvalid });
  }

  if (
    values.password.length < MIN_PASSWORD_LENGTH ||
    !PASSWORD_COMPLEXITY_REGEX.test(values.password)
  ) {
    errors.push({
      field: "password",
      message: AUTH_FIELD_MESSAGES.passwordTooShort
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Validates registration form values client-side.
 * Pure function: same input always produces same output, no side effects.
 * Includes confirmation that password === passwordConfirmation.
 */
export function validateRegisterForm(
  values: RegisterFormValues
): ValidationResult {
  const errors: FieldError[] = [];

  if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.push({ field: "email", message: AUTH_FIELD_MESSAGES.emailInvalid });
  }

  if (
    values.password.length < MIN_PASSWORD_LENGTH ||
    !PASSWORD_COMPLEXITY_REGEX.test(values.password)
  ) {
    errors.push({
      field: "password",
      message: AUTH_FIELD_MESSAGES.passwordTooShort
    });
  }

  if (values.password !== values.passwordConfirmation) {
    errors.push({
      field: "passwordConfirmation",
      message: AUTH_FIELD_MESSAGES.passwordsMismatch
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
