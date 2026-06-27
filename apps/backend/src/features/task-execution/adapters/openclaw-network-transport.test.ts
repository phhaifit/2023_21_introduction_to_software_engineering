import { describe, it, expect, vi } from "vitest";
import type { EntityId } from "@vcp/shared";
import { OpenClawRawEventMapper, OpenClawHttpSSETransport } from "./openclaw-network-transport.ts";

describe("OpenClawNetworkTransport & OpenClawRawEventMapper", () => {
  const taskId = "task-123" as EntityId<"taskId">;

  describe("OpenClawRawEventMapper", () => {
    it("should map valid progress event (started)", () => {
      const rawPayload = {
        eventType: "progress",
        executionId: "exec-1",
        stepId: "step-1",
        stepName: "Validation",
        status: "started",
        timestamp: 1672531199000
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "step-started",
        taskId,
        stepId: "step-1",
        stepName: "Validation",
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should map valid progress event (completed)", () => {
      const rawPayload = {
        eventType: "progress",
        executionId: "exec-1",
        stepId: "step-1",
        stepName: "Validation",
        status: "success",
        timestamp: 1672531199000
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "step-completed",
        taskId,
        stepId: "step-1",
        result: "success",
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should map partial output event with security redaction", () => {
      const rawPayload = {
        eventType: "partial_output",
        executionId: "exec-1",
        chunk: "Here is the result and the secret token Bearer secret_abcdef",
        timestamp: 1672531199000
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "partial-output-received",
        taskId,
        outputChunk: "Here is the result and the secret [REDACTED] Bearer [REDACTED]",
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should map completion event with security redaction", () => {
      const rawPayload = {
        eventType: "completion",
        executionId: "exec-1",
        finalOutput: "Completed successfully. Config at C:\\Users\\admin\\config.json",
        timestamp: 1672531199000
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "execution-completed",
        taskId,
        finalOutput: "Completed successfully. Config at [REDACTED_PATH]",
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should map failure event with security redaction", () => {
      const rawPayload = {
        eventType: "failure",
        executionId: "exec-1",
        errorCode: "AUTH_FAIL",
        errorMessage: "Failed to connect using apiKey AIzaSyD-12345",
        timestamp: 1672531199000
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "execution-failed",
        taskId,
        error: {
          code: "execution-failed",
          message: "Failed to connect using apiKey [REDACTED]"
        },
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should map cancellation event", () => {
      const rawPayload = {
        eventType: "cancellation",
        executionId: "exec-1",
        timestamp: 1672531199000
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "execution-canceled",
        taskId,
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should return null for malformed or unknown payloads", () => {
      expect(OpenClawRawEventMapper.mapRawEvent(taskId, null)).toBeNull();
      expect(OpenClawRawEventMapper.mapRawEvent(taskId, "not-an-object")).toBeNull();
      expect(OpenClawRawEventMapper.mapRawEvent(taskId, { eventType: "unknown", executionId: "exec-1", timestamp: 123 })).toBeNull();
      expect(OpenClawRawEventMapper.mapRawEvent(taskId, { eventType: "progress" })).toBeNull(); // Missing executionId and timestamp
    });
  });

  describe("OpenClawHttpSSETransport", () => {
    it("should successfully start execution via HTTP POST", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ providerExecutionReference: "exec-http-1", status: "started", startedAt: "2023-01-01" })
      });

      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      const resp = await transport.startExecution("https://openclaw.internal", "cred-123", {
        taskId: "task-123",
        prompt: "Hello",
        target: "coordinator",
        mode: "auto"
      });

      expect(resp.providerExecutionReference).toBe("exec-http-1");
      expect(mockFetch).toHaveBeenCalledWith("https://openclaw.internal/executions/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer cred-123"
        },
        body: JSON.stringify({
          taskId: "task-123",
          prompt: "Hello",
          target: "coordinator",
          mode: "auto"
        })
      });
    });

    it("should handle authentication failure (401) during startExecution", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      await expect(
        transport.startExecution("https://openclaw.internal", "cred-invalid", {
          taskId: "task-123",
          prompt: "Hello",
          target: "coordinator",
          mode: "auto"
        })
      ).rejects.toThrow(/provider-authentication-rejected/);
    });

    it("should successfully cancel execution via HTTP POST", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ providerExecutionReference: "exec-http-1", status: "canceled", canceledAt: "2023-01-01" })
      });

      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      const resp = await transport.cancelExecution("https://openclaw.internal", "cred-123", {
        providerExecutionReference: "exec-http-1",
        taskId: "task-123"
      });

      expect(resp.status).toBe("canceled");
      expect(mockFetch).toHaveBeenCalledWith("https://openclaw.internal/executions/exec-http-1/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer cred-123"
        },
        body: JSON.stringify({
          providerExecutionReference: "exec-http-1",
          taskId: "task-123"
        })
      });
    });

    it("should handle event stream subscription and mock stream errors", async () => {
      const transport = new OpenClawHttpSSETransport();
      const onError = vi.fn();
      const sub = transport.subscribeEventStream("https://openclaw.mock-stream-error", "cred-123", "exec-1", () => {}, onError);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(onError).toHaveBeenCalled();
      sub.unsubscribe();
    });

    it("should successfully get snapshot", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "in-progress" })
      });

      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      const snap = await transport.getSnapshot("https://openclaw.internal", "cred-123", "exec-1");
      expect(snap).toEqual({ status: "in-progress" });
    });
  });
});
