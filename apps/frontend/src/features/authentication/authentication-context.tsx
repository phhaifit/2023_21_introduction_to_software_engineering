// =============================================================================
// AuthProvider + useAuth — authentication context for the frontend app.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";

import {
  AuthApiClientError,
  createAuthenticationApiClient,
  type AuthenticationApiClient
} from "./authentication-api-client.ts";
import type {
  AuthFormStatus,
  CurrentUser,
  LoginFormValues,
  RegisterFormValues,
  SessionData
} from "./authentication-view.ts";

// -----------------------------------------------------------------------------
// Local storage key — single stable location for the persisted token.
// -----------------------------------------------------------------------------

const TOKEN_STORAGE_KEY = "vcp.auth.token";

// -----------------------------------------------------------------------------
// Context types
// -----------------------------------------------------------------------------

type SignInResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; code: string; message: string };

type SignUpResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type AuthContextValue = {
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean;
  /** The authenticated user, or null when not signed in. */
  currentUser: CurrentUser | null;
  /** Opaque session token, or null when not signed in. */
  sessionToken: string | null;
  /**
   * "initializing" — reading from localStorage and verifying with /me.
   * "idle"         — stable, ready.
   * "submitting"   — sign-in / sign-up / sign-out in progress.
   * "error"        — last operation failed (inspect currentUser/isAuthenticated for state).
   */
  status: "initializing" | AuthFormStatus;
  /** Authenticate with email + password. Returns code on failure for caller to map to a message. */
  signIn(values: LoginFormValues): Promise<SignInResult>;
  /** Register a new account. Does NOT auto-login; screen should redirect to login. */
  signUp(values: RegisterFormValues): Promise<SignUpResult>;
  /** Sign out the current user. Always clears local state, even if the API call fails. */
  signOut(): Promise<void>;
};

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

type AuthProviderProps = {
  children: ReactNode;
  /** Override for testing; production code uses the default client. */
  apiClient?: AuthenticationApiClient;
};

const defaultApiClient = createAuthenticationApiClient();

export function AuthProvider({
  children,
  apiClient = defaultApiClient
}: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("initializing");

  // Ref keeps the latest token accessible inside async callbacks without
  // causing stale-closure issues.
  const tokenRef = useRef<string | null>(null);

  function persistToken(token: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    tokenRef.current = token;
    setSessionToken(token);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    tokenRef.current = null;
    setSessionToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
  }

  // ---------------------------------------------------------------------------
  // Bootstrap: on mount, attempt to restore session from localStorage.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!stored) {
      setStatus("idle");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const user = await apiClient.getMe(stored!);
        if (cancelled) return;
        tokenRef.current = stored;
        setSessionToken(stored);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch {
        // Token invalid or expired — clear it silently.
        if (cancelled) return;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } finally {
        if (!cancelled) {
          setStatus("idle");
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  // ---------------------------------------------------------------------------
  // signIn
  // ---------------------------------------------------------------------------

  const signIn = useCallback(
    async (values: LoginFormValues): Promise<SignInResult> => {
      setStatus("submitting");

      try {
        const result = await apiClient.login(values);
        persistToken(result.session.sessionToken);
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        setStatus("idle");
        return { ok: true, user: result.user };
      } catch (error) {
        setStatus("error");
        if (error instanceof AuthApiClientError) {
          return { ok: false, code: error.code, message: error.message };
        }
        return {
          ok: false,
          code: "system.unexpected_error",
          message: "Something went wrong. Please try again."
        };
      }
    },
    [apiClient]
  );

  // ---------------------------------------------------------------------------
  // signUp
  // ---------------------------------------------------------------------------

  const signUp = useCallback(
    async (values: RegisterFormValues): Promise<SignUpResult> => {
      setStatus("submitting");

      try {
        await apiClient.register(values);
        // Registration does NOT auto-login. The screen redirects to login.
        setStatus("idle");
        return { ok: true };
      } catch (error) {
        setStatus("error");
        if (error instanceof AuthApiClientError) {
          return { ok: false, code: error.code, message: error.message };
        }
        return {
          ok: false,
          code: "system.unexpected_error",
          message: "Something went wrong. Please try again."
        };
      }
    },
    [apiClient]
  );

  // ---------------------------------------------------------------------------
  // signOut
  // ---------------------------------------------------------------------------

  const signOut = useCallback(async (): Promise<void> => {
    setStatus("submitting");
    const token = tokenRef.current;

    // Clear local state immediately — logout is best-effort.
    clearSession();

    if (token) {
      try {
        await apiClient.logout(token);
      } catch {
        // Ignore API errors on logout; session is already cleared locally.
      }
    }

    setStatus("idle");
  }, [apiClient]);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: AuthContextValue = {
    isAuthenticated,
    currentUser,
    sessionToken,
    status,
    signIn,
    signUp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// -----------------------------------------------------------------------------
// useAuth
// -----------------------------------------------------------------------------

/**
 * Returns the authentication context.
 * Must be called inside a component tree that is wrapped by <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth must be called inside an <AuthProvider>. " +
        "Wrap a parent component with <AuthProvider> before using useAuth."
    );
  }

  return context;
}

// Re-export SessionData so consumers can import from a single place.
export type { SessionData };
