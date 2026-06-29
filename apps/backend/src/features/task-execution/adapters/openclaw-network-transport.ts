import type { EntityId, NormalizedRuntimeEvent, NormalizedRuntimeError } from "@vcp/shared";
import { sanitizeObservabilityPayload } from "@vcp/shared";

// 1.4 Define raw OpenClaw provider DTOs based on OpenAI-compatible HTTP API specification.
export interface OpenClawExecutionRequest {
  taskId: string;
  prompt: string;
  target: string;
  mode: string;
  conversationId?: string;
}

export interface OpenClawExecutionResponse {
  providerExecutionReference: string;
  status: string;
  startedAt: string;
}

export interface OpenClawCancelRequest {
  providerExecutionReference: string;
  taskId: string;
}

export interface OpenClawCancelResponse {
  providerExecutionReference: string;
  status: string;
  canceledAt: string;
}

export interface OpenClawChatCompletionChunk {
  id?: string;
  object: "chat.completion.chunk";
  created?: number;
  model?: string;
  choices?: Array<{
    delta?: {
      content?: string;
      role?: string;
    };
    text?: string;
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
  executionId?: string;
  timestamp?: number;
  finalOutput?: string;
  openclaw_extension?: {
    stepId?: string;
    stepName?: string;
    status?: string;
    activityType?: "routing" | "workflow" | "tool" | "sub-agent" | "handoff" | "review" | "aggregation" | "completion" | "provider-diagnostic";
    details?: string;
  };
}

// 1.3 Define OpenClawNetworkTransport boundary.
export interface OpenClawNetworkTransport {
  startExecution(endpoint: string, credentialReference: string, request: OpenClawExecutionRequest): Promise<OpenClawExecutionResponse>;
  cancelExecution(endpoint: string, credentialReference: string, request: OpenClawCancelRequest): Promise<OpenClawCancelResponse>;
  subscribeEventStream(
    endpoint: string,
    credentialReference: string,
    providerExecutionReference: string,
    onEvent: (rawEvent: unknown) => void,
    onError: (error: Error) => void
  ): { unsubscribe: () => void };
  getSnapshot(endpoint: string, credentialReference: string, providerExecutionReference: string): Promise<unknown>;
}

const DEFAULT_OPENCLAW_MODEL = "google/gemini-3.1-flash-lite";

// 2.1 Implement OpenClawRawEventMapper.
export class OpenClawRawEventMapper {
  // 2.2 Map OpenAI-compatible SSE chunks directly to NormalizedRuntimeEvent union objects.
  // 2.3 Apply sanitize/redaction logic before creating NormalizedRuntimeEvent.
  static mapRawEvent(taskId: EntityId<"taskId">, rawPayload: unknown): NormalizedRuntimeEvent | null {
    if (!rawPayload || typeof rawPayload !== "object") {
      return null;
    }

    const payload = rawPayload as Record<string, any>;
    if (payload.object !== "chat.completion.chunk") {
      return null; // Reject non-OpenAI-compatible chunks
    }

    const providerExecutionReference = payload.executionId || payload.id || "unknown-execution";
    const timestampStr = payload.timestamp ? new Date(payload.timestamp).toISOString() : (payload.created ? new Date(payload.created * 1000).toISOString() : new Date().toISOString());

    // 1. Check for OpenClaw extension events (step started, step completed, sub-activity, cancellation)
    if (payload.openclaw_extension) {
      const ext = payload.openclaw_extension;
      if (ext.status === "started") {
        return {
          type: "step-started",
          taskId,
          stepId: ext.stepId || "step-1",
          stepName: ext.stepName || "Agent Execution",
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
      if (ext.status === "completed" || ext.status === "success") {
        return {
          type: "step-completed",
          taskId,
          stepId: ext.stepId || "step-1",
          result: ext.status,
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
      if (ext.status === "canceled") {
        return {
          type: "execution-canceled",
          taskId,
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
      if (ext.activityType) {
        return {
          type: "sub-activity",
          taskId,
          activityType: ext.activityType,
          details: sanitizeObservabilityPayload(ext.details || ""),
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
    }

    // 2. Check for error / failure
    if (payload.error) {
      const sanitizedMessage = sanitizeObservabilityPayload(payload.error.message || "Unknown provider failure");
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

    // 3. Check choices for partial output or completion
    const choice = payload.choices?.[0];
    if (choice) {
      if (choice.finish_reason) {
        const finalContent = payload.finalOutput || choice.text || choice.delta?.content || "Execution completed successfully.";
        return {
          type: "execution-completed",
          taskId,
          finalOutput: sanitizeObservabilityPayload(finalContent),
          timestamp: timestampStr,
          providerExecutionReference
        };
      }

      if (choice.delta?.content) {
        return {
          type: "partial-output-received",
          taskId,
          outputChunk: sanitizeObservabilityPayload(choice.delta.content),
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
    }

    return null;
  }
}

// 3.1 Implement concrete transport using the OpenAI-compatible HTTP API protocol.
export class OpenClawHttpSSETransport implements OpenClawNetworkTransport {
  private fetcher: typeof fetch;
  private isCustomFetcher: boolean;
  private activeStreams = new Map<string, ReadableStream<Uint8Array>>();
  private activeControllers = new Map<string, AbortController>();

  constructor(customFetcher?: typeof fetch) {
    this.isCustomFetcher = !!customFetcher;
    this.fetcher = customFetcher || globalThis.fetch;
  }

  async startExecution(endpoint: string, credentialReference: string, request: OpenClawExecutionRequest): Promise<OpenClawExecutionResponse> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
    }

    if (false) {
      console.log(`\n[OpenClaw Transport] === STARTING EXECUTION REQUEST ===`);
      console.log(`[OpenClaw Transport] Target Gateway Endpoint: ${endpoint}/v1/chat/completions`);
      console.log(`[OpenClaw Transport] Authorization Bearer Token: ${credentialReference.substring(0, 8)}... (Length: ${credentialReference.length})`);
    }

    try {
      const abortController = new AbortController();
      const response = await this.fetcher(`${endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentialReference}`,
          "x-openclaw-model": DEFAULT_OPENCLAW_MODEL,
          "x-openclaw-session-key": request.conversationId || "default-session"
        },
        body: JSON.stringify({
          model: request.target || "openclaw/default",
          messages: [{ role: "user", content: request.prompt || "Start execution" }],
          stream: true,
          user: request.conversationId || "default-user"
        }),
        signal: abortController.signal
      });

      if (false) {
        console.log(`[OpenClaw Transport] Gateway Response HTTP Status: ${response.status} ${response.statusText}`);
      }

      if (response.status === 401 || response.status === 403) {
        if (false) {
          console.error(`[OpenClaw Transport] ❌ Authentication Rejected (401/403). Check OPENCLAW_GATEWAY_TOKEN.`);
        }
        throw new Error(JSON.stringify({ code: "provider-authentication-rejected", message: "Provider authentication rejected by OpenClaw runtime" }));
      }

      if (!response.ok) {
        let errText = "";
        try { errText = await response.text(); } catch (e) {}
        if (false) {
          console.error(`[OpenClaw Transport] ❌ Execution Start Rejected with status ${response.status}: ${errText}`);
        }
        throw new Error(JSON.stringify({ code: "execution-start-rejected", message: `Execution start rejected with status ${response.status}` }));
      }

      let providerExecutionReference = `openclaw-exec-${Date.now()}`;
      if (response.body && typeof (response.body as any).getReader === "function") {
        if (false) {
          console.log(`[OpenClaw Transport] ✓ Successfully received ReadableStream from Gateway. Ready for SSE streaming.`);
        }
        this.activeStreams.set(providerExecutionReference, response.body);
        this.activeControllers.set(providerExecutionReference, abortController);
      } else if (typeof response.json === "function") {
        try {
          const data = await response.json() as any;
          if (data && data.providerExecutionReference) {
            providerExecutionReference = data.providerExecutionReference;
          }
        } catch (e) {
          // ignore
        }
      }

      return {
        providerExecutionReference,
        status: "started",
        startedAt: new Date().toISOString()
      };
    } catch (err: any) {
      if (false) {
        console.error(`[OpenClaw Transport] ❌ Network/Execution failure:`, err.message);
        if (err.cause) {
          console.error(`[OpenClaw Transport] ❌ Error Cause:`, err.cause);
        }
      }
      if (err.message && err.message.includes("code")) {
        throw err;
      }
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: `Network failure connecting to OpenClaw runtime: ${err.message}` }));
    }
  }

  async cancelExecution(endpoint: string, credentialReference: string, request: OpenClawCancelRequest): Promise<OpenClawCancelResponse> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
    }

    if (false) {
      console.log(`[OpenClaw Transport] Canceling active execution: ${request.providerExecutionReference}`);
    }

    const controller = this.activeControllers.get(request.providerExecutionReference);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(request.providerExecutionReference);
      this.activeStreams.delete(request.providerExecutionReference);
      if (false) {
        console.log(`[OpenClaw Transport] ✓ Successfully aborted gateway connection stream.`);
      }
    }

    return {
      providerExecutionReference: request.providerExecutionReference,
      status: "canceled",
      canceledAt: new Date().toISOString()
    };
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
      if (false) {
        console.log(`[OpenClaw Transport] Subscribing to incoming SSE stream for execution: ${providerExecutionReference}`);
      }
      const stream = this.activeStreams.get(providerExecutionReference)!;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedOutput = "";
      let started = false;

      const readStream = async () => {
        try {
          while (isSubscribed) {
            const { done, value } = await reader.read();
            if (done) {
              if (false) {
                console.log(`[OpenClaw Transport] SSE stream reader finished [DONE].`);
              }
              if (started) {
                onEvent({
                  object: "chat.completion.chunk",
                  executionId: providerExecutionReference,
                  timestamp: Date.now(),
                  choices: [{ finish_reason: "stop" }],
                  finalOutput: accumulatedOutput
                });
                started = false;
              }
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

                  if (data.object === "chat.completion.chunk") {
                    data.executionId = providerExecutionReference;
                    data.timestamp = data.timestamp || now;

                    if (!started) {
                      started = true;
                      if (false) {
                        console.log(`[OpenClaw Transport] 📥 Received SSE Event: Chat started`);
                      }
                      onEvent({
                        object: "chat.completion.chunk",
                        executionId: providerExecutionReference,
                        timestamp: now,
                        openclaw_extension: {
                          stepId: "step-1",
                          stepName: "Agent Execution",
                          status: "started"
                        }
                      });
                    }

                    const choice = data.choices?.[0];
                    if (choice) {
                      if (choice.delta?.content) {
                        accumulatedOutput += choice.delta.content;
                        onEvent(data);
                      }

                      if (choice.finish_reason) {
                        if (false) {
                          console.log(`[OpenClaw Transport] 📥 Received SSE Event: finished (reason: ${choice.finish_reason})`);
                        }
                        data.finalOutput = accumulatedOutput;
                        onEvent(data);
                        started = false;
                      }
                    }
                  }
                } catch (parseErr) {
                  // ignore malformed JSON chunk
                }
              }
            }
          }
        } catch (err: any) {
          if (isSubscribed) {
            if (false) {
              console.error(`[OpenClaw Transport] ❌ Streaming transport error:`, err.message);
            }
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

    onError(new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Streaming transport unavailable: no active OpenClaw stream for execution reference" })));

    return {
      unsubscribe: () => {
        isSubscribed = false;
      }
    };
  }

  async getSnapshot(endpoint: string, credentialReference: string, providerExecutionReference: string): Promise<unknown> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
    }

    if (false) {
      return { status: "in-progress" };
    }

    const response = await this.fetcher(`${endpoint}/v1/models`, {
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
