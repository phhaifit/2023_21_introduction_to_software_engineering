import type { Request, Response, NextFunction } from "express";
import type { AuthenticateSessionUseCase } from "../application/authenticate-session-use-case.ts";

export type AuthUserContextMiddlewareDeps = {
  authenticateSessionUseCase: AuthenticateSessionUseCase;
};

export function createAuthUserContextMiddleware(deps: AuthUserContextMiddlewareDeps) {
  return async function authUserContextMiddleware(
    request: Request,
    _response: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = request.header("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const rawToken = authHeader.slice("Bearer ".length);

    try {
      const user = await deps.authenticateSessionUseCase.execute({ rawToken });
      const existing = (request as any).context ?? {};
      (request as any).context = { ...existing, user };
    } catch {
      // Token invalid, expired, or session not found
      // We swallow the error and do not attach context.user
      // We NEVER block the request here. Downstream guards will handle 401s if required.
    }

    next();
  };
}
