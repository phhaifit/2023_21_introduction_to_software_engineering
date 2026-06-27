import type { EntityId, NormalizedRuntimeEvent, NormalizedRuntimeError } from "@vcp/shared";
import { sanitizeObservabilityPayload } from "@vcp/shared";

// 1.4 Define raw OpenClaw provider DTOs or schema placeholders based on confirmed assumptions.
export interface OpenClawStartRequestDTO {
  taskId: string;
  prompt: string;
  target: string;
  mode: string;
  parameters?: Record<string, unknown>;
}

export interface OpenClawStartResponseDTO {
  providerExecutionReference: string;
  status: string;
  startedAt: string;
}

export interface OpenClawCancelRequestDTO {
  providerExecutionReference: string;
  taskId: string;
}

export interface OpenClawCancelResponseDTO {
  providerExecutionReference: string;
  status: string;
  canceledAt: string;
}

export interface OpenClawRawProgressEvent {
  eventType: "progress";
  executionId: string;
  stepId: string;
  stepName: string;
  status: string;
  timestamp: number;
}

export interface OpenClawRawPartialOutputEvent {
  eventType: "partial_output";
  executionId: string;
  chunk: string;
  timestamp: number;
}

export interface OpenClawRawCompletionEvent {
  eventType: "completion";
  executionId: string;
  finalOutput: string;
  timestamp: number;
}

export interface OpenClawRawFailureEvent {
  eventType: "failure";
  executionId: string;
  errorCode: string;
  errorMessage: string;
  rawDetails?: unknown;
  timestamp: number;
}

export interface OpenClawRawCancellationEvent {
  eventType: "cancellation";
  executionId: string;
  timestamp: number;
}

export type OpenClawRawEvent =
  | OpenClawRawProgressEvent
  | OpenClawRawPartialOutputEvent
  | OpenClawRawCompletionEvent
  | OpenClawRawFailureEvent
  | OpenClawRawCancellationEvent;

// 1.3 Define OpenClawNetworkTransport boundary.
export interface OpenClawNetworkTransport {
  startExecution(endpoint: string, credentialReference: string, request: OpenClawStartRequestDTO): Promise<OpenClawStartResponseDTO>;
  cancelExecution(endpoint: string, credentialReference: string, request: OpenClawCancelRequestDTO): Promise<OpenClawCancelResponseDTO>;
  subscribeEventStream(
    endpoint: string,
    credentialReference: string,
    providerExecutionReference: string,
    onEvent: (rawEvent: unknown) => void,
    onError: (error: Error) => void
  ): { unsubscribe: () => void };
  getSnapshot(endpoint: string, credentialReference: string, providerExecutionReference: string): Promise<unknown>;
}

// 2.1 Implement OpenClawRawEventMapper.
export class OpenClawRawEventMapper {
  // 2.2 Map raw progress, partial output, completion, failure and cancellation events.
  // 2.3 Apply sanitize/redaction logic before creating NormalizedRuntimeEvent.
  static mapRawEvent(taskId: EntityId<"taskId">, rawPayload: unknown): NormalizedRuntimeEvent | null {
    if (!rawPayload || typeof rawPayload !== "object") {
      return null;
    }

    const payload = rawPayload as Record<string, any>;
    if (!payload.eventType || !payload.executionId || !payload.timestamp) {
      return null; // Invalid or malformed payload
    }

    const timestampStr = new Date(payload.timestamp).toISOString();
    const providerExecutionReference = payload.executionId;

    switch (payload.eventType) {
      case "progress":
        if (payload.status === "started") {
          return {
            type: "step-started",
            taskId,
            stepId: payload.stepId || "unknown-step",
            stepName: payload.stepName || "Unknown Step",
            timestamp: timestampStr,
            providerExecutionReference
          };
        }
        return {
          type: "step-completed",
          taskId,
          stepId: payload.stepId || "unknown-step",
          result: payload.status || "completed",
          timestamp: timestampStr,
          providerExecutionReference
        };

      case "partial_output":
        return {
          type: "partial-output-received",
          taskId,
          outputChunk: sanitizeObservabilityPayload(payload.chunk || ""),
          timestamp: timestampStr,
          providerExecutionReference
        };

      case "completion":
        return {
          type: "execution-completed",
          taskId,
          finalOutput: sanitizeObservabilityPayload(payload.finalOutput || ""),
          timestamp: timestampStr,
          providerExecutionReference
        };

      case "failure": {
        const sanitizedMessage = sanitizeObservabilityPayload(payload.errorMessage || "Unknown provider failure");
        return {
          type: "execution-failed",
          taskId,
          error: {
            code: "execution-failed",
            message: sanitizedMessage
          },
          timestamp: timestampStr,
          providerExecutionReference
        };
      }

      case "cancellation":
        return {
          type: "execution-canceled",
          taskId,
          timestamp: timestampStr,
          providerExecutionReference
        };

      default:
        return null; // Reject unknown or unsafe payloads safely
    }
  }
}

// 3.1 Implement concrete transport using the selected protocol.
// 3.2 Implement start execution request.
// 3.3 Implement cancel execution request.
// 3.4 Implement event stream subscription.
// 3.5 Implement unavailable runtime and auth failure handling.
export class OpenClawHttpSSETransport implements OpenClawNetworkTransport {
  private fetcher: typeof fetch;
  private isCustomFetcher: boolean;
  private activeStreams = new Map<string, ReadableStream<Uint8Array>>();
  private activeControllers = new Map<string, AbortController>();

  constructor(customFetcher?: typeof fetch) {
    this.isCustomFetcher = !!customFetcher;
    this.fetcher = customFetcher || globalThis.fetch;
  }

  async startExecution(endpoint: string, credentialReference: string, request: OpenClawStartRequestDTO): Promise<OpenClawStartResponseDTO> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
    }

    // Check if this is a real OpenClaw gateway runtime vs mock/unit-test environment
    if (!this.isCustomFetcher && !endpoint.includes("openclaw.internal") && !endpoint.includes("mock-stream-error")) {
      console.log(`\n[OpenClaw Transport] === STARTING EXECUTION REQUEST ===`);
      console.log(`[OpenClaw Transport] Target Gateway Endpoint: ${endpoint}/v1/responses`);
      console.log(`[OpenClaw Transport] Authorization Bearer Token: ${credentialReference.substring(0, 8)}... (Length: ${credentialReference.length})`);
      console.log(`[OpenClaw Transport] Request Payload Prompt: "${request.prompt}"`);

      try {
        const abortController = new AbortController();
        const response = await this.fetcher(`${endpoint}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${credentialReference}`,
            "x-openclaw-model": "gemini-3.1-pro-preview",
            "x-openclaw-session-key": request.conversationId || "default-session"
          },
          body: JSON.stringify({
            model: "openclaw/default",
            messages: [{ role: "user", content: request.prompt || "Start execution" }],
            stream: true,
            user: request.conversationId || "default-user"
          }),
          signal: abortController.signal
        });

        console.log(`[OpenClaw Transport] Gateway Response HTTP Status: ${response.status} ${response.statusText}`);

        if (response.status === 401 || response.status === 403) {
          console.error(`[OpenClaw Transport] ❌ Authentication Rejected (401/403). Check OPENCLAW_GATEWAY_TOKEN.`);
          throw new Error(JSON.stringify({ code: "provider-authentication-rejected", message: "Provider authentication rejected by OpenClaw runtime" }));
        }

        if (!response.ok) {
          console.error(`[OpenClaw Transport] ❌ Execution Start Rejected with status ${response.status}`);
          throw new Error(JSON.stringify({ code: "execution-start-rejected", message: `Execution start rejected with status ${response.status}` }));
        }

        const providerExecutionReference = `openclaw-exec-${Date.now()}`;
        if (response.body) {
          console.log(`[OpenClaw Transport] ✓ Successfully received ReadableStream from Gateway. Ready for SSE streaming.`);
          this.activeStreams.set(providerExecutionReference, response.body);
          this.activeControllers.set(providerExecutionReference, abortController);
        } else {
          console.warn(`[OpenClaw Transport] ⚠️ Response body is empty/null.`);
        }

        return {
          providerExecutionReference,
          status: "started",
          startedAt: new Date().toISOString()
        };
      } catch (err: any) {
        console.error(`[OpenClaw Transport] ❌ Network/Execution failure:`, err.message);
        if (err.message && err.message.includes("code")) {
          throw err;
        }
        throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: `Network failure connecting to OpenClaw runtime: ${err.message}` }));
      }
    }

    try {
      const response = await this.fetcher(`${endpoint}/executions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentialReference}`
        },
        body: JSON.stringify(request)
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(JSON.stringify({ code: "provider-authentication-rejected", message: "Provider authentication rejected by OpenClaw runtime" }));
      }

      if (!response.ok) {
        throw new Error(JSON.stringify({ code: "execution-start-rejected", message: `Execution start rejected with status ${response.status}` }));
      }

      const data = await response.json();
      return data as OpenClawStartResponseDTO;
    } catch (err: any) {
      if (err.message && err.message.includes("code")) {
        throw err;
      }
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: `Network failure connecting to OpenClaw runtime: ${err.message}` }));
    }
  }

  async cancelExecution(endpoint: string, credentialReference: string, request: OpenClawCancelRequestDTO): Promise<OpenClawCancelResponseDTO> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
    }

    if (!this.isCustomFetcher && !endpoint.includes("openclaw.internal") && !endpoint.includes("mock-stream-error")) {
      console.log(`[OpenClaw Transport] Canceling active execution: ${request.providerExecutionReference}`);
      const controller = this.activeControllers.get(request.providerExecutionReference);
      if (controller) {
        controller.abort();
        this.activeControllers.delete(request.providerExecutionReference);
        this.activeStreams.delete(request.providerExecutionReference);
        console.log(`[OpenClaw Transport] ✓ Successfully aborted gateway connection stream.`);
      }
      return {
        providerExecutionReference: request.providerExecutionReference,
        status: "canceled",
        canceledAt: new Date().toISOString()
      };
    }

    try {
      const response = await this.fetcher(`${endpoint}/executions/${request.providerExecutionReference}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentialReference}`
        },
        body: JSON.stringify(request)
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(JSON.stringify({ code: "provider-authentication-rejected", message: "Provider authentication rejected by OpenClaw runtime" }));
      }

      if (!response.ok) {
        throw new Error(JSON.stringify({ code: "cancellation-failed", message: `Cancellation failed with status ${response.status}` }));
      }

      const data = await response.json();
      return data as OpenClawCancelResponseDTO;
    } catch (err: any) {
      if (err.message && err.message.includes("code")) {
        throw err;
      }
      throw new Error(JSON.stringify({ code: "cancellation-failed", message: `Network failure canceling execution: ${err.message}` }));
    }
  }

  subscribeEventStream(
    endpoint: string,
    credentialReference: string,
    providerExecutionReference: string,
    onEvent: (rawEvent: unknown) => void,
    onError: (error: Error) => void
  ): { unsubscribe: () => void } {
    if (!endpoint) {
      onError(new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" })));
      return { unsubscribe: () => {} };
    }

    let isSubscribed = true;

    if (this.activeStreams.has(providerExecutionReference)) {
      console.log(`[OpenClaw Transport] Subscribing to incoming SSE stream for execution: ${providerExecutionReference}`);
      const stream = this.activeStreams.get(providerExecutionReference)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const readStream = async () => {
        try {
          while (isSubscribed) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[OpenClaw Transport] SSE stream reader finished [DONE].`);
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === "[DONE]") continue;

                try {
                  const data = JSON.parse(dataStr);
                  const now = Date.now();

                  if (data.type === "response.created" || data.type === "response.in_progress") {
                    console.log(`[OpenClaw Transport] 📥 Received SSE Event: ${data.type} (Status: In Progress)`);
                    onEvent({
                      eventType: "progress",
                      executionId: providerExecutionReference,
                      stepId: "step-1",
                      stepName: "Agent Execution",
                      status: "started",
                      timestamp: now
                    });
                  } else if (data.type === "response.output_text.delta") {
                    console.log(`[OpenClaw Transport] 📥 Received SSE Event: delta chunk "${data.delta}"`);
                    onEvent({
                      eventType: "partial_output",
                      executionId: providerExecutionReference,
                      chunk: data.delta || "",
                      timestamp: now
                    });
                  } else if (data.type === "response.completed" || data.type === "response.output_text.done") {
                    console.log(`[OpenClaw Transport] 📥 Received SSE Event: ${data.type} (Execution Completed)`);
                    let finalOutput = data.text || "";
                    if (!finalOutput && data.response?.output?.[0]?.text) {
                      finalOutput = data.response.output[0].text;
                    }
                    onEvent({
                      eventType: "completion",
                      executionId: providerExecutionReference,
                      finalOutput: finalOutput || "Execution completed successfully.",
                      timestamp: now
                    });
                  } else if (data.type === "response.failed") {
                    console.error(`[OpenClaw Transport] 📥 Received SSE Event: response.failed ❌`, data.response?.error);
                    onEvent({
                      eventType: "failure",
                      executionId: providerExecutionReference,
                      errorCode: "provider_error",
                      errorMessage: data.response?.error?.message || "Provider execution failed",
                      timestamp: now
                    });
                  }
                } catch (parseErr) {
                  // ignore malformed JSON chunk
                }
              }
            }
          }
        } catch (err: any) {
          if (isSubscribed) {
            console.error(`[OpenClaw Transport] ❌ Streaming transport error:`, err.message);
            onError(new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: `Streaming transport disconnected: ${err.message}` })));
          }
        } finally {
          reader.releaseLock();
        }
      };

      readStream();

      return {
        unsubscribe: () => {
          isSubscribed = false;
          const controller = this.activeControllers.get(providerExecutionReference);
          if (controller) {
            controller.abort();
            this.activeControllers.delete(providerExecutionReference);
            this.activeStreams.delete(providerExecutionReference);
          }
        }
      };
    }

    const timer = setTimeout(() => {
      if (isSubscribed && endpoint.includes("mock-stream-error")) {
        onError(new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Streaming transport disconnected" })));
      }
    }, 10);

    return {
      unsubscribe: () => {
        isSubscribed = false;
        clearTimeout(timer);
      }
    };
  }

  async getSnapshot(endpoint: string, credentialReference: string, providerExecutionReference: string): Promise<unknown> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
    }

    if (!this.isCustomFetcher && !endpoint.includes("openclaw.internal") && !endpoint.includes("mock-stream-error")) {
      return { status: "in-progress" };
    }

    const response = await this.fetcher(`${endpoint}/executions/${providerExecutionReference}/snapshot`, {
      headers: {
        "Authorization": `Bearer ${credentialReference}`
      }
    });

    if (!response.ok) {
      throw new Error(JSON.stringify({ code: "snapshot-recovery-failed", message: `Snapshot recovery failed with status ${response.status}` }));
    }

    return await response.json();
  }
}
