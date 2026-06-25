import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { sendAuthApiSuccess, sendAuthApiFailure } from "./api-response.ts";

function makeRequest(requestId?: string): Request {
  return {
    header: (name: string) =>
      name === "x-request-id" ? (requestId ?? null) : null
  } as unknown as Request;
}

function makeResponse(): { res: Response; statusMock: ReturnType<typeof vi.fn>; jsonMock: ReturnType<typeof vi.fn> } {
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  const res = { status: statusMock } as unknown as Response;
  return { res, statusMock, jsonMock };
}

describe("sendAuthApiSuccess", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00.000Z"));
  });

  it("sends HTTP 200 with a well-formed success envelope", () => {
    const { res, statusMock, jsonMock } = makeResponse();
    const req = makeRequest("req-abc-123");

    sendAuthApiSuccess(req, res, { userId: "u1" });

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      data: { userId: "u1" },
      meta: {
        requestId: "req-abc-123",
        timestamp: "2026-01-15T10:00:00.000Z"
      }
    });
  });

  it("uses fallback requestId when x-request-id header is absent", () => {
    const { res, jsonMock } = makeResponse();
    const req = makeRequest(undefined);

    sendAuthApiSuccess(req, res, null);

    const body = jsonMock.mock.calls[0][0] as { meta: { requestId: string } };
    expect(body.meta.requestId).toBe("authentication-request");
  });

  it("preserves the generic payload type without modification", () => {
    const { res, jsonMock } = makeResponse();
    const req = makeRequest("req-xyz");

    const payload = { token: "abc", expiresAt: "2026-12-31T00:00:00.000Z" };
    sendAuthApiSuccess(req, res, payload);

    const body = jsonMock.mock.calls[0][0] as { data: typeof payload };
    expect(body.data).toStrictEqual(payload);
  });
});

describe("sendAuthApiFailure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00.000Z"));
  });

  it("sends HTTP 401 for auth.invalid_credentials with correct failure envelope", () => {
    const { res, statusMock, jsonMock } = makeResponse();
    const req = makeRequest("req-fail-1");

    sendAuthApiFailure(req, res, "auth.invalid_credentials", "Invalid email or password.");

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "auth.invalid_credentials",
        message: "Invalid email or password."
      },
      meta: {
        requestId: "req-fail-1",
        timestamp: "2026-01-15T10:00:00.000Z"
      }
    });
  });

  it("sends HTTP 422 for validation.invalid_input with correct failure envelope", () => {
    const { res, statusMock, jsonMock } = makeResponse();
    const req = makeRequest("req-fail-2");

    sendAuthApiFailure(req, res, "validation.invalid_input", "Email is required.");

    expect(statusMock).toHaveBeenCalledWith(422);
    expect(jsonMock).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "validation.invalid_input",
        message: "Email is required."
      },
      meta: {
        requestId: "req-fail-2",
        timestamp: "2026-01-15T10:00:00.000Z"
      }
    });
  });

  it("sends HTTP 403 for auth.forbidden", () => {
    const { res, statusMock } = makeResponse();
    const req = makeRequest("req-fail-3");

    sendAuthApiFailure(req, res, "auth.forbidden", "Access denied.");

    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it("sets ok: false in the envelope body", () => {
    const { res, jsonMock } = makeResponse();
    const req = makeRequest();

    sendAuthApiFailure(req, res, "system.unexpected_error", "Something went wrong.");

    const body = jsonMock.mock.calls[0][0] as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
