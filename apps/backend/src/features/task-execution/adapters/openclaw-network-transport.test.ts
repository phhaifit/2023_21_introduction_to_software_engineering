import { describe, it, expect, vi } from "vitest";
import type { EntityId } from "@vcp/shared";
import { OpenClawRawEventMapper, OpenClawHttpSSETransport } from "./openclaw-network-transport.ts";

class FakeGatewayControlClient {
  connected = false;
  closed = false;
  connectError?: Error;
  requests: Array<{ method: string; params: Record<string, any> }> = [];
  private listeners = new Set<(frame: Record<string, any>) => void>();

  async connect(): Promise<void> {
    if (this.connectError) {
      throw this.connectError;
    }
    this.connected = true;
  }

  async request(method: string, params: Record<string, any> = {}): Promise<any> {
    this.requests.push({ method, params });
    if (method === "sessions.create") {
      return { key: "control-session-1" };
    }
    if (method === "chat.send") {
      return { runId: "control-run-1", status: "started" };
    }
    return { ok: true };
  }

  close(): void {
    this.closed = true;
  }

  onEvent(listener: (frame: Record<string, any>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(frame: Record<string, any>): void {
    for (const listener of this.listeners) {
      listener(frame);
    }
  }
}

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

    it("should map OpenClaw extension activity metadata without converting it to a fixed step", () => {
      const rawPayload = {
        object: "chat.completion.chunk",
        executionId: "exec-1",
        timestamp: 1672531199000,
        openclaw_extension: {
          stepId: "web-search-search-1",
          stepName: "Searching web",
          status: "running",
          activityType: "web-search",
          details: "Looking up API docs with apiKey secret-value",
          displayLabel: "Searching web",
          summary: "Looking up API docs",
          queryPreview: "OpenClaw Gateway sessions.subscribe",
          providerEventName: "session.search.query"
        }
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual({
        type: "sub-activity",
        taskId,
        activityType: "web-search",
        details: "Looking up API docs with apiKey [REDACTED]",
        displayLabel: "Searching web",
        summary: "Looking up API docs",
        status: "in-progress",
        stepId: "web-search-search-1",
        toolName: undefined,
        queryPreview: "OpenClaw Gateway sessions.subscribe",
        resourceLabel: undefined,
        inputPreview: undefined,
        outputPreview: undefined,
        providerEventName: "session.search.query",
        timestamp: new Date(1672531199000).toISOString(),
        providerExecutionReference: "exec-1"
      });
    });

    it("should map OpenAI-compatible tool call deltas into safe activity", () => {
      const rawPayload = {
        object: "chat.completion.chunk",
        executionId: "exec-tool",
        timestamp: 1672531199000,
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  id: "call-1",
                  function: {
                    name: "web_search",
                    arguments: "{\"query\":\"OpenClaw token abc123\"}"
                  }
                }
              ]
            },
            finish_reason: "tool_calls"
          }
        ]
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual(expect.objectContaining({
        type: "sub-activity",
        taskId,
        activityType: "tool-call",
        displayLabel: "Calling web_search",
        summary: "Calling web_search",
        status: "started",
        stepId: "tool-call-call-1",
        toolName: "web_search",
        providerEventName: "openai.chat.delta.tool_calls",
        providerExecutionReference: "exec-tool"
      }));
      expect(mapped?.inputPreview).toContain("[REDACTED]");
      expect(mapped?.inputPreview).not.toContain("abc123");
    });

    it("should map reasoning and thinking deltas without exposing raw reasoning content", () => {
      const rawPayload = {
        object: "chat.completion.chunk",
        executionId: "exec-reasoning",
        timestamp: 1672531199000,
        choices: [
          {
            delta: {
              reasoning_content: "private chain of thought with token abc123",
              reasoning_summary: "Planning next action"
            }
          }
        ]
      };

      const mapped = OpenClawRawEventMapper.mapRawEvent(taskId, rawPayload);
      expect(mapped).toEqual(expect.objectContaining({
        type: "sub-activity",
        taskId,
        activityType: "provider-diagnostic",
        displayLabel: "Thinking",
        summary: "Planning next action",
        details: "Planning next action",
        status: "in-progress",
        stepId: "provider-diagnostic-thinking",
        providerEventName: "openai.chat.delta.reasoning",
        providerExecutionReference: "exec-reasoning"
      }));
      expect(JSON.stringify(mapped)).not.toContain("private chain of thought");
      expect(JSON.stringify(mapped)).not.toContain("abc123");
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
          model: "openclaw/default",
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
        target: "openclaw/default",
        mode: "specific-agent",
        conversationId: "session-123",
        openClawAgentId: "agent-research",
        routingInstruction:
          "Task & Orchestration routing mode: specific-agent. Use exactly this selected workspace agent: Research Agent."
      });

      expect(mockFetch).toHaveBeenCalledWith("https://openclaw.internal/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer cred-123",
          "x-openclaw-model": "google/gemini-3.1-flash-lite",
          "x-openclaw-session-key": "session-123",
          "x-openclaw-agent-id": "agent-research"
        },
        body: JSON.stringify({
          model: "openclaw/default",
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

    it("should fall back to Gateway Control protocol when chat completions route is unavailable", async () => {
      const fakeControl = new FakeGatewayControlClient();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found"
      });
      const transport = new OpenClawHttpSSETransport(mockFetch as any, {
        gatewayControlClientFactory: () => fakeControl as any
      });

      const start = await transport.startExecution("http://127.0.0.1:18789", "cred-123", {
        taskId: "task-123",
        prompt: "Find current OpenClaw Gateway progress",
        target: "openclaw/default",
        mode: "auto",
        conversationId: "conv-requested",
        routingInstruction: "Use auto routing"
      });

      expect(start.providerExecutionReference).toBe("openclaw-control:control-session-1:control-run-1");
      expect(fakeControl.connected).toBe(true);
      expect(fakeControl.requests.map((request) => request.method)).toEqual([
        "sessions.create",
        "sessions.subscribe",
        "sessions.messages.subscribe",
        "chat.send"
      ]);
      expect(fakeControl.requests[3].params).toMatchObject({
        sessionKey: "control-session-1",
        deliver: false,
        idempotencyKey: expect.stringMatching(/^vcp-run-/)
      });
      expect(String(fakeControl.requests[3].params.message)).toContain("Use auto routing");
      expect(String(fakeControl.requests[3].params.message)).toContain("Find current OpenClaw Gateway progress");

      fakeControl.emit({
        type: "event",
        event: "session.operation",
        payload: {
          sessionKey: "control-session-1",
          operationId: "route-1",
          name: "Routing",
          status: "running",
          details: "Selecting workspace agent"
        }
      });

      const onEvent = vi.fn();
      const sub = transport.subscribeEventStream(
        "http://127.0.0.1:18789",
        "cred-123",
        start.providerExecutionReference,
        onEvent,
        vi.fn()
      );

      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        object: "chat.completion.chunk",
        executionId: start.providerExecutionReference,
        openclaw_extension: expect.objectContaining({
          activityType: "routing",
          details: "Selecting workspace agent"
        })
      }));

      fakeControl.emit({
        type: "event",
        event: "chat",
        payload: {
          sessionKey: "control-session-1",
          state: "streaming",
          delta: "Partial answer"
        }
      });
      fakeControl.emit({
        type: "event",
        event: "chat",
        payload: {
          sessionKey: "control-session-1",
          state: "final",
          text: "Final answer"
        }
      });
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        choices: [{ delta: { content: "Partial answer" } }]
      }));
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
        choices: [{ finish_reason: "stop" }],
        finalOutput: "Final answer"
      }));

      sub.unsubscribe();
      expect(fakeControl.closed).toBe(true);
    });

    it("should report Gateway Control device-auth rejection safely", async () => {
      const fakeControl = new FakeGatewayControlClient();
      fakeControl.connectError = Object.assign(new Error("control ui requires device identity"), {
        gatewayError: {
          code: "INVALID_REQUEST",
          message: "control ui requires device identity",
          details: { code: "CONTROL_UI_DEVICE_IDENTITY_REQUIRED" }
        }
      });
      const transport = new OpenClawHttpSSETransport(vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found"
      }) as any, {
        gatewayControlClientFactory: () => fakeControl as any
      });

      await expect(
        transport.startExecution("http://127.0.0.1:18789", "cred-123", {
          taskId: "task-123",
          prompt: "Hello",
          target: "openclaw/default",
          mode: "auto"
        })
      ).rejects.toThrow(/provider-authentication-rejected/);
      expect(fakeControl.closed).toBe(true);
    });

    it("should close active Gateway Control execution on cancellation", async () => {
      const fakeControl = new FakeGatewayControlClient();
      const transport = new OpenClawHttpSSETransport(vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found"
      }) as any, {
        gatewayControlClientFactory: () => fakeControl as any
      });
      const start = await transport.startExecution("http://127.0.0.1:18789", "cred-123", {
        taskId: "task-123",
        prompt: "Hello",
        target: "openclaw/default",
        mode: "auto"
      });

      const cancel = await transport.cancelExecution("http://127.0.0.1:18789", "cred-123", {
        taskId: "task-123",
        providerExecutionReference: start.providerExecutionReference
      });

      expect(cancel.status).toBe("canceled");
      expect(fakeControl.closed).toBe(true);
    });

    it("should report an unavailable stream when no active OpenClaw stream exists", async () => {
      const transport = new OpenClawHttpSSETransport();
      const onError = vi.fn();
      const sub = transport.subscribeEventStream("https://openclaw.internal", "cred-123", "exec-1", () => {}, onError);
      
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toMatch(/Streaming transport unavailable/);
      sub.unsubscribe();
    });

    it("should subscribe to OpenClaw Gateway WebSocket progress as a best-effort side-channel", async () => {
      const originalWebSocket = (globalThis as any).WebSocket;
      const instances: FakeGatewayWebSocket[] = [];
      class FakeGatewayWebSocket {
        onopen: ((event: unknown) => void) | null = null;
        onmessage: ((event: { data: unknown }) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onclose: ((event: unknown) => void) | null = null;
        sent: any[] = [];
        closed = false;
        constructor(readonly url: string) {
          instances.push(this);
        }
        send(data: string) {
          this.sent.push(JSON.parse(data));
        }
        close() {
          this.closed = true;
        }
      }
      (globalThis as any).WebSocket = FakeGatewayWebSocket;

      try {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            }
          })
        });

        const transport = new OpenClawHttpSSETransport(mockFetch as any);
        const start = await transport.startExecution("https://openclaw.internal", "cred-123", {
          taskId: "task-123",
          prompt: "Route with progress",
          target: "openclaw/default",
          mode: "auto",
          conversationId: "conv-123"
        });
        const onEvent = vi.fn();
        const sub = transport.subscribeEventStream(
          "https://openclaw.internal",
          "cred-123",
          start.providerExecutionReference,
          onEvent,
          vi.fn()
        );

        expect(instances[0].url).toBe("wss://openclaw.internal/");
        instances[0].onopen?.({});
        expect(instances[0].sent).toEqual([]);
        instances[0].onmessage?.({
          data: JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-123" }
          })
        });
        expect(instances[0].sent[0]).toMatchObject({
          type: "req",
          method: "connect",
          params: {
            minProtocol: 4,
            maxProtocol: 4,
            client: {
              id: "openclaw-control-ui",
              mode: "webchat"
            },
            auth: { token: "cred-123" },
            nonce: "nonce-123"
          }
        });

        instances[0].onmessage?.({ data: JSON.stringify({ type: "res", id: instances[0].sent[0].id, ok: true }) });
        expect(instances[0].sent.map((frame) => frame.method)).toEqual([
          "connect",
          "sessions.subscribe",
          "sessions.messages.subscribe"
        ]);

        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.operation",
            payload: {
              sessionKey: "conv-123",
              operationId: "route-1",
              name: "Routing",
              status: "running",
              details: "Selecting workspace agent"
            }
          })
        });

        expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
          object: "chat.completion.chunk",
          executionId: start.providerExecutionReference,
          openclaw_extension: expect.objectContaining({
            stepId: "routing-route-1",
            stepName: "Routing request",
            status: "in-progress",
            activityType: "routing",
            details: "Selecting workspace agent",
            displayLabel: "Routing request",
            providerEventName: "session.operation"
          })
        }));

        sub.unsubscribe();
        expect(instances[0].closed).toBe(true);
      } finally {
        (globalThis as any).WebSocket = originalWebSocket;
      }
    });

    it("should map rich Gateway progress frames into sanitized provider-neutral activities", async () => {
      const originalWebSocket = (globalThis as any).WebSocket;
      const instances: FakeGatewayWebSocket[] = [];
      class FakeGatewayWebSocket {
        onopen: ((event: unknown) => void) | null = null;
        onmessage: ((event: { data: unknown }) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onclose: ((event: unknown) => void) | null = null;
        sent: any[] = [];
        closed = false;
        constructor(readonly url: string) {
          instances.push(this);
        }
        send(data: string) {
          this.sent.push(JSON.parse(data));
        }
        close() {
          this.closed = true;
        }
      }
      (globalThis as any).WebSocket = FakeGatewayWebSocket;

      try {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            }
          })
        });

        const transport = new OpenClawHttpSSETransport(mockFetch as any);
        const start = await transport.startExecution("https://openclaw.internal", "cred-123", {
          taskId: "task-123",
          prompt: "Use tools",
          target: "openclaw/default",
          mode: "auto",
          conversationId: "conv-activity"
        });
        const onEvent = vi.fn();
        const sub = transport.subscribeEventStream(
          "https://openclaw.internal",
          "cred-123",
          start.providerExecutionReference,
          onEvent,
          vi.fn()
        );

        instances[0].onopen?.({});
        instances[0].onmessage?.({ data: JSON.stringify({ type: "connected", status: "ok" }) });
        onEvent.mockClear();

        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.search.query",
            payload: {
              sessionKey: "conv-activity",
              id: "search-1",
              query: "OpenClaw Gateway progress",
              summary: "Searching public web"
            }
          })
        });
        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.document.read",
            payload: {
              sessionKey: "conv-activity",
              documentId: "doc-1",
              documentName: "Roadmap.pdf",
              details: "Reading from C:\\Users\\admin\\Roadmap.pdf"
            }
          })
        });
        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.shell.command",
            payload: {
              sessionKey: "conv-activity",
              id: "shell-1",
              status: "error",
              command: "npm test",
              details: "Command failed with token abc123"
            }
          })
        });
        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.message.progress",
            payload: {
              sessionKey: "conv-activity",
              id: "tool-rich-1",
              toolCalls: [
                {
                  id: "call-rich-1",
                  function: {
                    name: "crm_lookup",
                    arguments: "{\"customer\":\"Acme\",\"token\":\"secret-value\"}"
                  }
                }
              ],
              summary: "Calling CRM lookup"
            }
          })
        });
        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.reasoning.delta",
            payload: {
              sessionKey: "conv-activity",
              id: "think-1",
              reasoning: "private reasoning with token secret-value",
              summary: "Planning search strategy"
            }
          })
        });
        instances[0].onmessage?.({
          data: JSON.stringify({
            event: "session.api.request",
            payload: {
              sessionKey: "other-conv",
              id: "api-ignored",
              summary: "This belongs elsewhere"
            }
          })
        });

        expect(onEvent).toHaveBeenCalledTimes(5);
        expect(onEvent.mock.calls[0][0].openclaw_extension).toMatchObject({
          activityType: "web-search",
          displayLabel: "Searching web",
          queryPreview: "OpenClaw Gateway progress",
          providerEventName: "session.search.query"
        });
        expect(onEvent.mock.calls[1][0].openclaw_extension).toMatchObject({
          activityType: "document-read",
          displayLabel: "Reading Roadmap.pdf",
          resourceLabel: "Roadmap.pdf",
          details: "Reading from [REDACTED_PATH]"
        });
        expect(onEvent.mock.calls[2][0].openclaw_extension).toMatchObject({
          activityType: "shell",
          displayLabel: "Running command",
          status: "failed",
          details: "Command failed with token [REDACTED]"
        });
        expect(onEvent.mock.calls[3][0].openclaw_extension).toMatchObject({
          activityType: "tool-call",
          displayLabel: "Calling crm_lookup",
          toolName: "crm_lookup",
          inputPreview: "{\"customer\":\"Acme\",\"token\":\"[REDACTED]\"}"
        });
        expect(onEvent.mock.calls[4][0].openclaw_extension).toMatchObject({
          activityType: "provider-diagnostic",
          displayLabel: "Thinking",
          details: "Planning search strategy",
          providerEventName: "session.reasoning.delta"
        });
        expect(JSON.stringify(onEvent.mock.calls[4][0])).not.toContain("private reasoning");

        sub.unsubscribe();
      } finally {
        (globalThis as any).WebSocket = originalWebSocket;
      }
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
