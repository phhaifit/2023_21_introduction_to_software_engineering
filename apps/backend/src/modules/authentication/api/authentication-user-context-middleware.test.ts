import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedUser } from "../../../shared/auth/request-context.ts";
import { createAuthUserContextMiddleware } from "./authentication-user-context-middleware.ts";

describe("authentication-user-context-middleware", () => {
  let mockAuthenticateSessionUseCase: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockAuthenticateSessionUseCase = {
      execute: vi.fn(),
    };
    mockRequest = {
      header: vi.fn(),
    };
    mockResponse = {};
    nextFunction = vi.fn();
  });

  it("should call next() and not set user if Authorization header is missing", async () => {
    (mockRequest.header as any).mockReturnValue(undefined);

    const middleware = createAuthUserContextMiddleware({
      authenticateSessionUseCase: mockAuthenticateSessionUseCase,
    });

    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockAuthenticateSessionUseCase.execute).not.toHaveBeenCalled();
    expect((mockRequest as any).context?.user).toBeUndefined();
    expect(nextFunction).toHaveBeenCalledOnce();
  });

  it("should call next() and not set user if Authorization header is not Bearer", async () => {
    (mockRequest.header as any).mockReturnValue("Basic something");

    const middleware = createAuthUserContextMiddleware({
      authenticateSessionUseCase: mockAuthenticateSessionUseCase,
    });

    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockAuthenticateSessionUseCase.execute).not.toHaveBeenCalled();
    expect((mockRequest as any).context?.user).toBeUndefined();
    expect(nextFunction).toHaveBeenCalledOnce();
  });

  it("should set context.user and call next() if token is valid", async () => {
    (mockRequest.header as any).mockReturnValue("Bearer valid-token");
    const mockUser: AuthenticatedUser = {
      userId: "user-123" as any,
      email: "test@vcp.local",
      displayName: "Test User",
    };
    mockAuthenticateSessionUseCase.execute.mockResolvedValue(mockUser);
    (mockRequest as any).context = { requestId: "req-123" }; // preserve existing context

    const middleware = createAuthUserContextMiddleware({
      authenticateSessionUseCase: mockAuthenticateSessionUseCase,
    });

    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockAuthenticateSessionUseCase.execute).toHaveBeenCalledWith({ rawToken: "valid-token" });
    expect((mockRequest as any).context.user).toEqual(mockUser);
    expect((mockRequest as any).context.requestId).toBe("req-123");
    expect(nextFunction).toHaveBeenCalledOnce();
  });

  it("should call next() and not set user if token is invalid/expired", async () => {
    (mockRequest.header as any).mockReturnValue("Bearer invalid-token");
    mockAuthenticateSessionUseCase.execute.mockRejectedValue(new Error("Session expired"));
    (mockRequest as any).context = { requestId: "req-456" }; // preserve existing context

    const middleware = createAuthUserContextMiddleware({
      authenticateSessionUseCase: mockAuthenticateSessionUseCase,
    });

    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockAuthenticateSessionUseCase.execute).toHaveBeenCalledWith({ rawToken: "invalid-token" });
    expect((mockRequest as any).context.user).toBeUndefined();
    expect((mockRequest as any).context.requestId).toBe("req-456");
    expect(nextFunction).toHaveBeenCalledOnce();
  });
});
