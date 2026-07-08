// =============================================================================
// RequireAuth — route guard component based on authentication state.
//
// Usage:
//   <RequireAuth fallback={<LoginPrompt />}>
//     <ProtectedPage />
//   </RequireAuth>
//
// Rendering rules:
//   status === "initializing"  → renders a session-check indicator (not fallback)
//   !isAuthenticated           → renders fallback
//   isAuthenticated            → renders children
//
// This component is intentionally self-contained and NOT wired into any route
// or App shell. It is designed to be composed at call sites when needed.
// =============================================================================

import type { ReactNode } from "react";

import { useAuth } from "./authentication-context.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RequireAuthProps = {
  /** Content to render when the user is authenticated. */
  children: ReactNode;
  /** Content to render when the user is NOT authenticated (e.g. a login prompt). */
  fallback: ReactNode;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Guards its children behind an authentication check.
 *
 * - While the session is being verified (`status === "initializing"`), renders
 *   a neutral loading indicator so the user does not see a flash of the
 *   fallback content.
 * - Once the check settles, renders `children` for authenticated users or
 *   `fallback` for unauthenticated users.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { isAuthenticated, status } = useAuth();

  if (status === "initializing") {
    return <p role="status">Checking your session</p>;
  }

  // After initialization, render fallback for unauthenticated users
  if (!isAuthenticated) {
    return fallback;
  }

  // Authenticated user – render protected children
  return children;
}
