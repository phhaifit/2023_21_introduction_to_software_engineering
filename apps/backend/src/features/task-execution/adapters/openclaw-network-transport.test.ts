import { describe, it, expect, vi } from "vitest";
import type { EntityId } from "@vcp/shared";
import { OpenClawRawEventMapper, OpenClawHttpSSETransport } from "./openclaw-network-transport.ts";

describe("OpenClawNetworkTransport & OpenClawRawEventMapper", () => {
  const taskId = "task-123" as EntityId<"taskId">;

  describe("OpenClawRawEventMapper", () => {
    it("should map valid progress event (started)", () => {
      const rawPayload = {
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        openclaw_extension: {
          stepId: "step-1",
          stepName: "Validation",
          status: "started"
        }
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
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        openclaw_extension: {
          stepId: "step-1",
          status: "success"
        }
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
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        choices: [
          {
            delta: { content: "Here is the result and the secret token Bearer secret_abcdef" }
          }
        ]
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
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        finalOutput: "Completed successfully. Config at C:\\Users\\admin\\config.json",
        choices: [
          {
            finish_reason: "stop"
          }
        ]
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
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        error: {
          code: "AUTH_FAIL",
          message: "Failed to connect using apiKey AIzaSyD-12345"
        }
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
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        openclaw_extension: {
          status: "canceled"
        }
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
      expect(OpenClawRawEventMapper.mapRawEvent(taskId, { object: "unknown", executionId: "exec-1", timestamp: 123 })).toBeNull();
    });
  });

  describe("OpenClawHttpSSETransport", () => {
    it("should successfully start execution via OpenAI-compatible HTTP POST", async () => {
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
        mode: "auto",
        conversationId: "session-123"
      });

      expect(resp.providerExecutionReference).toBe("exec-http-1");
      expect(mockFetch).toHaveBeenCalledWith("https://openclaw.internal/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer cred-123",
          "x-openclaw-model": "google/gemini-3.1-flash-lite",
          "x-openclaw-session-key": "session-123"
        },
        body: JSON.stringify({
          model: "coordinator",
          messages: [{ role: "user", content: "Hello" }],
          stream: true,
          user: "session-123"
        }),
        signal: expect.any(AbortSignal)
      });
    });

    it("should include selected routing instruction in OpenClaw messages", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ providerExecutionReference: "exec-http-2", status: "started", startedAt: "2023-01-01" })
      });

      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      await transport.startExecution("https://openclaw.internal", "cred-123", {
        taskId: "task-123",
        prompt: "Summarize this report",
        target: "openclaw/agent/agent-research",
        mode: "specific-agent",
        conversationId: "session-123",
        routingInstruction:
          "Task & Orchestration routing mode: specific-agent. Use exactly this selected workspace agent: Research Agent."
      });

      expect(mockFetch).toHaveBeenCalledWith("https://openclaw.internal/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer cred-123",
          "x-openclaw-model": "google/gemini-3.1-flash-lite",
          "x-openclaw-session-key": "session-123"
        },
        body: JSON.stringify({
          model: "openclaw/agent/agent-research",
          messages: [
            {
              role: "system",
              content:
                "Task & Orchestration routing mode: specific-agent. Use exactly this selected workspace agent: Research Agent."
            },
            { role: "user", content: "Summarize this report" }
          ],
          stream: true,
          user: "session-123"
        }),
        signal: expect.any(AbortSignal)
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

    it("should successfully cancel execution via AbortController without outgoing HTTP call", async () => {
      const mockFetch = vi.fn();
      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      const resp = await transport.cancelExecution("https://openclaw.internal", "cred-123", {
        providerExecutionReference: "exec-http-1",
        taskId: "task-123"
      });

      expect(resp.status).toBe("canceled");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should report an unavailable stream when no active OpenClaw stream exists", async () => {
      const transport = new OpenClawHttpSSETransport();
      const onError = vi.fn();
      const sub = transport.subscribeEventStream("https://openclaw.internal", "cred-123", "exec-1", () => {}, onError);
      
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toMatch(/Streaming transport unavailable/);
      sub.unsubscribe();
    });

    it("should successfully get snapshot via v1/models", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "in-progress" })
      });

      const transport = new OpenClawHttpSSETransport(mockFetch as any);
      const snap = await transport.getSnapshot("https://openclaw.internal", "cred-123", "exec-1");
      expect(snap).toEqual({ status: "in-progress" });
      expect(mockFetch).toHaveBeenCalledWith("https://openclaw.internal/v1/models", {
        headers: {
          "Authorization": "Bearer cred-123"
        }
      });
    });
  });
});
