import { Router, type Request, type Response } from "express";

import { EmailAlreadyUsedError, InvalidCredentialsError, SessionNotFoundError, ValidationError } from "../domain/errors.ts";
import type { RegisterUseCase } from "../application/register-use-case.ts";
import type { LoginUseCase } from "../application/login-use-case.ts";
import type { LogoutUseCase } from "../application/logout-use-case.ts";
import { sendAuthApiSuccess, sendAuthApiFailure } from "./api-response.ts";

export type AuthenticationRouterDependencies = {
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
};

export function createAuthenticationRouter(
  dependencies: AuthenticationRouterDependencies
): Router {
  const router = Router();

  router.post("/register", async (request: Request, response: Response) => {
    await handleAuthApiRequest(request, response, async () => {
      const body = request.body as Record<string, unknown> | undefined;
      const email = body?.["email"];
      const password = body?.["password"];
      const displayName = body?.["displayName"];

      const issues: Record<string, string> = {};
      if (typeof email !== "string" || email.trim() === "") {
        issues.email = "email is required";
      }
      if (typeof password !== "string" || password.trim() === "") {
        issues.password = "password is required";
      }

      if (Object.keys(issues).length > 0) {
        throw new ValidationError(issues);
      }

      const result = await dependencies.registerUseCase.execute({
        email: email as string,
        password: password as string,
        displayName: typeof displayName === "string" ? displayName : undefined,
      });

      return {
        userId: result.userId,
        email: result.email,
        displayName: result.displayName,
        status: result.status,
        createdAt: result.createdAt,
      };
    });
  });

  router.post("/login", async (request: Request, response: Response) => {
    await handleAuthApiRequest(request, response, async () => {
      const body = request.body as Record<string, unknown> | undefined;
      const email = body?.["email"];
      const password = body?.["password"];

      const issues: Record<string, string> = {};
      if (typeof email !== "string" || email.trim() === "") {
        issues.email = "email is required";
      }
      if (typeof password !== "string" || password.trim() === "") {
        issues.password = "password is required";
      }

      if (Object.keys(issues).length > 0) {
        throw new ValidationError(issues);
      }

      const result = await dependencies.loginUseCase.execute({
        email: email as string,
        password: password as string,
      });

      return {
        user: {
          userId: result.user.userId,
          email: result.user.email,
          displayName: result.user.displayName,
          status: result.user.status,
          createdAt: result.user.createdAt,
        },
        session: {
          token: result.session.token,
          expiresAt: result.session.expiresAt,
        },
      };
    });
  });

  router.post("/logout", async (request: Request, response: Response) => {
    const authHeader = request.header("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      sendAuthApiFailure(request, response, "auth.unauthorized", "Missing or invalid Authorization header.");
      return;
    }

    const rawToken = authHeader.slice("Bearer ".length);

    await handleAuthApiRequest(request, response, async () => {
      try {
        await dependencies.logoutUseCase.execute({ rawToken });
      } catch (error) {
        if (error instanceof SessionNotFoundError) {
          // Idempotent: session already gone, treat as success
          return { success: true };
        }
        throw error;
      }
      return { success: true };
    });
  });

  return router;
}

async function handleAuthApiRequest<T>(
  request: Request,
  response: Response,
  action: () => Promise<T>
): Promise<void> {
  try {
    const data = await action();
    sendAuthApiSuccess(request, response, data);
  } catch (error) {
    if (error instanceof ValidationError) {
      sendAuthApiFailure(
        request,
        response,
        "validation.invalid_input",
        error.message
      );
      return;
    }

    if (error instanceof InvalidCredentialsError) {
      sendAuthApiFailure(
        request,
        response,
        "auth.invalid_credentials",
        error.message
      );
      return;
    }

    if (error instanceof EmailAlreadyUsedError) {
      sendAuthApiFailure(
        request,
        response,
        "validation.invalid_input",
        error.message
      );
      return;
    }

    sendAuthApiFailure(
      request,
      response,
      "system.unexpected_error",
      "Unexpected Authentication API error."
    );
  }
}
