import type { EntityId, NormalizedRuntimeEvent, RuntimeActivityStatus, RuntimeActivityType } from "@vcp/shared";
import { sanitizeObservabilityPayload } from "@vcp/shared";

// 1.4 Define raw OpenClaw provider DTOs based on OpenAI-compatible HTTP API specification.
export interface OpenClawExecutionRequest {
  taskId: string;
  prompt: string;
  target: string;
  mode: string;
  conversationId?: string;
  routingInstruction?: string;
  targetLabel?: string;
  openClawAgentId?: string;
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
      tool_calls?: Array<{
        id?: string;
        type?: string;
        name?: string;
        arguments?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
      tool_call?: {
        id?: string;
        name?: string;
        arguments?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      };
      reasoning?: unknown;
      reasoning_content?: unknown;
      reasoning_summary?: unknown;
      thinking?: unknown;
      thinking_summary?: unknown;
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
    activityType?: RuntimeActivityType;
    details?: string;
    displayLabel?: string;
    summary?: string;
    toolName?: string;
    queryPreview?: string;
    resourceLabel?: string;
    inputPreview?: string;
    outputPreview?: string;
    providerEventName?: string;
  };
}

interface OpenClawGatewayProgressContext {
  taskId: string;
  conversationId: string;
}

interface MinimalWebSocket {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

type MinimalWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> }
) => MinimalWebSocket;

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
const DEFAULT_OPENCLAW_ROUTING_TARGET = "openclaw/default";

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
      if (ext.status === "canceled") {
        return {
          type: "execution-canceled",
          taskId,
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
      if (ext.activityType) {
        const details = sanitizeObservabilityPayload(ext.details || ext.summary || ext.displayLabel || "");
        return {
          type: "sub-activity",
          taskId,
          activityType: ext.activityType,
          details,
          displayLabel: sanitizeObservabilityPayload(ext.displayLabel || ext.stepName || ""),
          summary: sanitizeObservabilityPayload(ext.summary || ext.details || ""),
          status: normalizeSubActivityStatus(ext.status),
          stepId: ext.stepId,
          toolName: sanitizeObservabilityPayload(ext.toolName),
          queryPreview: sanitizeObservabilityPayload(ext.queryPreview),
          resourceLabel: sanitizeObservabilityPayload(ext.resourceLabel),
          inputPreview: sanitizeObservabilityPayload(ext.inputPreview),
          outputPreview: sanitizeObservabilityPayload(ext.outputPreview),
          providerEventName: sanitizeObservabilityPayload(ext.providerEventName),
          timestamp: timestampStr,
          providerExecutionReference
        };
      }
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
      const toolActivity = mapOpenAiToolCallActivity(taskId, choice.delta, timestampStr, providerExecutionReference);
      if (toolActivity) {
        return toolActivity;
      }

      const reasoningActivity = mapOpenAiReasoningActivity(taskId, choice.delta, timestampStr, providerExecutionReference);
      if (reasoningActivity) {
        return reasoningActivity;
      }

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

function mapOpenAiToolCallActivity(
  taskId: EntityId<"taskId">,
  delta: NonNullable<OpenClawChatCompletionChunk["choices"]>[number]["delta"] | undefined,
  timestamp: string,
  providerExecutionReference: string
): NormalizedRuntimeEvent | null {
  const toolCalls = delta?.tool_calls || (delta?.tool_call ? [delta.tool_call] : []);
  const toolCall = toolCalls.find(Boolean);
  if (!toolCall) {
    return null;
  }

  const toolName = toSafeShortText(toolCall.function?.name || toolCall.name || toolCall.type);
  const inputPreview = toSafeShortText(toolCall.function?.arguments || toolCall.arguments);
  const displayLabel = toolName ? `Calling ${toolName}` : "Calling tool";

  return {
    type: "sub-activity",
    taskId,
    activityType: "tool-call",
    details: displayLabel,
    displayLabel,
    summary: displayLabel,
    status: "started",
    stepId: `tool-call-${safeStepId(toolCall.id || toolName || "openai-tool-call")}`,
    toolName,
    inputPreview,
    providerEventName: "openai.chat.delta.tool_calls",
    timestamp,
    providerExecutionReference
  };
}

function mapOpenAiReasoningActivity(
  taskId: EntityId<"taskId">,
  delta: NonNullable<OpenClawChatCompletionChunk["choices"]>[number]["delta"] | undefined,
  timestamp: string,
  providerExecutionReference: string
): NormalizedRuntimeEvent | null {
  if (!delta) {
    return null;
  }

  const hasReasoning = delta.reasoning !== undefined ||
    delta.reasoning_content !== undefined ||
    delta.reasoning_summary !== undefined ||
    delta.thinking !== undefined ||
    delta.thinking_summary !== undefined;
  if (!hasReasoning) {
    return null;
  }

  const safeSummary = toSafeShortText(delta.reasoning_summary || delta.thinking_summary) || "Reasoning in progress";

  return {
    type: "sub-activity",
    taskId,
    activityType: "provider-diagnostic",
    details: safeSummary,
    displayLabel: "Thinking",
    summary: safeSummary,
    status: "in-progress",
    stepId: "provider-diagnostic-thinking",
    providerEventName: "openai.chat.delta.reasoning",
    timestamp,
    providerExecutionReference
  };
}

// 3.1 Implement concrete transport using the OpenAI-compatible HTTP API protocol.
export class OpenClawHttpSSETransport implements OpenClawNetworkTransport {
  private fetcher: typeof fetch;
  private isCustomFetcher: boolean;
  private activeStreams = new Map<string, ReadableStream<Uint8Array>>();
  private activeControllers = new Map<string, AbortController>();
  private activeProgressContexts = new Map<string, OpenClawGatewayProgressContext>();

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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${credentialReference}`,
        "x-openclaw-model": DEFAULT_OPENCLAW_MODEL,
        "x-openclaw-session-key": request.conversationId || "default-session"
      };
      if (request.openClawAgentId) {
        headers["x-openclaw-agent-id"] = request.openClawAgentId;
      }

      const response = await this.fetcher(`${endpoint}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: DEFAULT_OPENCLAW_ROUTING_TARGET,
          messages: buildOpenClawMessages(request),
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
        const detail = errText ? `: ${sanitizeObservabilityPayload(errText)}` : "";
        throw new Error(JSON.stringify({ code: "execution-start-rejected", message: `Execution start rejected with status ${response.status}${detail}` }));
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

      this.activeProgressContexts.set(providerExecutionReference, {
        taskId: request.taskId,
        conversationId: request.conversationId || "default-session"
      });

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
      this.activeProgressContexts.delete(request.providerExecutionReference);
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
    const sideChannelSubscription = this.subscribeGatewayProgressSideChannel(
      endpoint,
      credentialReference,
      providerExecutionReference,
      onEvent
    );

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
          sideChannelSubscription.unsubscribe();
          this.activeProgressContexts.delete(providerExecutionReference);
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
          sideChannelSubscription.unsubscribe();
          this.activeProgressContexts.delete(providerExecutionReference);
        }
      };
    }

    onError(new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Streaming transport unavailable: no active OpenClaw stream for execution reference" })));

    return {
      unsubscribe: () => {
        isSubscribed = false;
        sideChannelSubscription.unsubscribe();
        this.activeProgressContexts.delete(providerExecutionReference);
      }
    };
  }

  private subscribeGatewayProgressSideChannel(
    endpoint: string,
    credentialReference: string,
    providerExecutionReference: string,
    onEvent: (rawEvent: unknown) => void
  ): { unsubscribe: () => void } {
    const context = this.activeProgressContexts.get(providerExecutionReference);
    const WebSocketCtor = (globalThis as any).WebSocket as MinimalWebSocketConstructor | undefined;
    if (!context || !WebSocketCtor) {
      return { unsubscribe: () => {} };
    }

    let socket: MinimalWebSocket | undefined;
    let closed = false;
    let connectAccepted = false;
    let connectAttempted = false;
    let frameSequence = 1;
    const sendFrame = (method: string, params?: Record<string, unknown>) => {
      if (!socket || closed) return;
      try {
        socket.send(JSON.stringify({
          type: "req",
          id: `vcp-${Date.now()}-${frameSequence++}`,
          method,
          params
        }));
      } catch (err) {
        // Side-channel progress is best-effort and must not fail execution.
      }
    };
    const sendConnectFrame = (nonce?: string) => {
      if (connectAttempted) return;
      connectAttempted = true;
      sendFrame("connect", {
        minProtocol: 4,
        maxProtocol: 4,
        client: {
          id: "openclaw-control-ui",
          version: "vcp-backend-task-orchestration",
          platform: "node",
          mode: "webchat"
        },
        role: "operator",
        scopes: ["operator.admin", "operator.read", "operator.write", "operator.approvals", "operator.pairing"],
        caps: ["tool-events"],
        auth: credentialReference ? { token: credentialReference } : undefined,
        locale: "en-US",
        userAgent: "vcp-backend-task-orchestration",
        nonce
      });
    };

    try {
      socket = new WebSocketCtor(toGatewayWebSocketUrl(endpoint), [], {
        headers: {
          Origin: new URL(endpoint).origin
        }
      });
    } catch (err) {
      return { unsubscribe: () => {} };
    }

    socket.onopen = () => {
      setTimeout(() => {
        sendConnectFrame();
      }, 750);
    };

    socket.onmessage = (event) => {
      if (closed) return;

      const frame = parseGatewayFrame(event.data);
      if (!frame) return;

      if (isGatewayConnectChallenge(frame)) {
        const nonce = typeof frame.payload?.nonce === "string" ? frame.payload.nonce : undefined;
        sendConnectFrame(nonce);
        return;
      }

      if (!connectAccepted && isGatewayConnectAccepted(frame)) {
        connectAccepted = true;
        sendFrame("sessions.subscribe", { key: context.conversationId });
        sendFrame("sessions.messages.subscribe", { key: context.conversationId });
      }

      const rawEvent = mapGatewayFrameToChatChunk(frame, providerExecutionReference, context);
      if (rawEvent) {
        onEvent(rawEvent);
      }
    };

    socket.onerror = () => {
      // Do not surface side-channel failures as execution failures.
    };
    socket.onclose = () => {
      closed = true;
    };

    return {
      unsubscribe: () => {
        closed = true;
        try {
          socket?.close();
        } catch (err) {
          // best-effort close
        }
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

function buildOpenClawMessages(request: OpenClawExecutionRequest): Array<{
  role: "system" | "user";
  content: string;
}> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (request.routingInstruction) {
    messages.push({
      role: "system",
      content: request.routingInstruction
    });
  }

  messages.push({
    role: "user",
    content: request.prompt || "Start execution"
  });

  return messages;
}

function toGatewayWebSocketUrl(endpoint: string): string {
  const url = new URL(endpoint);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function parseGatewayFrame(data: unknown): Record<string, any> | null {
  try {
    const text = typeof data === "string"
      ? data
      : data instanceof Uint8Array
      ? new TextDecoder().decode(data)
      : String(data);
    const frame = JSON.parse(text);
    return frame && typeof frame === "object" ? frame as Record<string, any> : null;
  } catch (err) {
    return null;
  }
}

function isGatewayConnectAccepted(frame: Record<string, any>): boolean {
  const type = String(frame.type || frame.event || "");
  const method = String(frame.method || "");
  const status = String(frame.status || frame.result?.status || frame.payload?.status || "");
  return type === "connected" ||
    type === "hello-ok" ||
    (type === "res" && frame.ok === true) ||
    method === "connect" ||
    status === "connected" ||
    status === "ok";
}

function mapGatewayFrameToChatChunk(
  frame: Record<string, any>,
  providerExecutionReference: string,
  context: OpenClawGatewayProgressContext
): OpenClawChatCompletionChunk | null {
  const eventName = getGatewayEventName(frame);
  if (!eventName) return null;

  const payload = getGatewayPayload(frame);
  if (!isFrameForSession(payload, context.conversationId)) {
    return null;
  }

  const timestamp = normalizeGatewayTimestamp(payload.timestamp || payload.createdAt || frame.timestamp);
  const activity = classifyGatewayActivity(eventName, payload);

  if (activity) {
    const metadata = buildGatewayActivityMetadata(activity, eventName, payload);
    return {
      object: "chat.completion.chunk",
      executionId: providerExecutionReference,
      timestamp,
      openclaw_extension: {
        stepId: metadata.stepId,
        stepName: metadata.displayLabel,
        status: normalizeGatewayProgressStatus(payload.status || payload.state || payload.phase || payload.event),
        activityType: activity,
        details: metadata.summary,
        displayLabel: metadata.displayLabel,
        summary: metadata.summary,
        toolName: metadata.toolName,
        queryPreview: metadata.queryPreview,
        resourceLabel: metadata.resourceLabel,
        inputPreview: metadata.inputPreview,
        outputPreview: metadata.outputPreview,
        providerEventName: eventName
      }
    };
  }

  if (eventName.includes("message")) {
    const role = payload.role || payload.author?.role;
    const text = payload.content || payload.text || payload.message;
    if (role === "assistant" && typeof text === "string" && text.length > 0) {
      return {
        object: "chat.completion.chunk",
        executionId: providerExecutionReference,
        timestamp,
        choices: [{ delta: { content: text } }]
      };
    }
    return {
      object: "chat.completion.chunk",
      executionId: providerExecutionReference,
      timestamp,
      openclaw_extension: {
        stepId: `message-${safeStepId(payload.messageId || payload.id || "activity")}`,
        stepName: "Composing response",
        status: normalizeGatewayProgressStatus(payload.status || payload.state || payload.phase || payload.event),
        activityType: "message",
        details: summarizeGatewayPayload(payload),
        displayLabel: "Composing response",
        summary: summarizeGatewayPayload(payload),
        providerEventName: eventName
      }
    };
  }

  return null;
}

function classifyGatewayActivity(eventName: string, payload: Record<string, any>): RuntimeActivityType | null {
  if (isReasoningSignal(eventName, payload)) return "provider-diagnostic";
  if (Array.isArray(payload.toolCalls) || Array.isArray(payload.tool_calls) || payload.toolCall || payload.tool_call) {
    return "tool-call";
  }
  if (payload.searchQuery || payload.query || payload.search) {
    return "web-search";
  }

  const haystack = [
    eventName,
    payload.type,
    payload.kind,
    payload.category,
    payload.activityType,
    payload.toolType,
    payload.toolName,
    payload.tool,
    payload.function?.name,
    payload.action,
    payload.operation,
    payload.command,
    payload.searchQuery,
    payload.name,
    payload.title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(search|web_search|web-search|lookup|retriev|retrieval|query)\b/.test(haystack)) return "web-search";
  if (/\b(tool|function|tool_call|tool-call|toolcall)\b/.test(haystack)) return "tool-call";
  if (/\b(document|doc|knowledge|rag|vector|citation)\b/.test(haystack)) return "document-read";
  if (/\b(file|workspace|artifact|read_file|read-file)\b/.test(haystack)) return "file-read";
  if (/\b(browser|browse|navigation|navigate|page|url|webpage)\b/.test(haystack)) return "browser";
  if (/\b(shell|terminal|command|process|exec|script)\b/.test(haystack)) return "shell";
  if (/\b(api|http|request|endpoint|fetch)\b/.test(haystack)) return "api-call";
  if (/\b(agent|sub_agent|sub-agent)\b/.test(haystack)) return "sub-agent";
  if (/\b(operation|workflow|run|step|routing|route)\b/.test(haystack)) {
    return haystack.includes("rout") ? "routing" : "workflow";
  }
  if (/\b(diagnostic|debug|trace|warning|warn)\b/.test(haystack)) return "provider-diagnostic";
  return null;
}

function buildGatewayActivityMetadata(
  activityType: RuntimeActivityType,
  eventName: string,
  payload: Record<string, any>
): {
  stepId: string;
  displayLabel: string;
  summary: string;
  toolName?: string;
  queryPreview?: string;
  resourceLabel?: string;
  inputPreview?: string;
  outputPreview?: string;
} {
  const reasoningSignal = isReasoningSignal(eventName, payload);
  const toolName = toSafeShortText(
    payload.toolName ||
      payload.tool ||
      payload.function?.name ||
      payload.toolCall?.function?.name ||
      payload.tool_call?.function?.name ||
      payload.toolCalls?.[0]?.function?.name ||
      payload.tool_calls?.[0]?.function?.name ||
      payload.name
  );
  const queryPreview = toSafeShortText(payload.query || payload.searchQuery || payload.search?.query || payload.input);
  const resourceLabel = toSafeShortText(payload.resourceLabel || payload.resource || payload.fileName || payload.documentName || payload.url);
  const inputPreview = toSafeShortText(
    payload.input ||
      payload.arguments ||
      payload.function?.arguments ||
      payload.toolCall?.function?.arguments ||
      payload.tool_call?.function?.arguments ||
      payload.toolCalls?.[0]?.function?.arguments ||
      payload.tool_calls?.[0]?.function?.arguments ||
      payload.request
  );
  const outputPreview = toSafeShortText(payload.output || payload.result || payload.response);
  const summary = reasoningSignal
    ? toSafeShortText(payload.summary || payload.status || payload.state || payload.phase) || "Reasoning in progress"
    : summarizeGatewayPayload(payload);
  const baseId = payload.toolCallId ||
    payload.toolId ||
    payload.toolCall?.id ||
    payload.tool_call?.id ||
    payload.toolCalls?.[0]?.id ||
    payload.tool_calls?.[0]?.id ||
    payload.operationId ||
    payload.runId ||
    payload.messageId ||
    payload.documentId ||
    payload.fileId ||
    payload.agentId ||
    payload.id ||
    payload.name ||
    eventName ||
    activityType;

  return {
    stepId: `${activityType}-${safeStepId(baseId)}`,
    displayLabel: reasoningSignal ? "Thinking" : resolveActivityDisplayLabel(activityType, { toolName, queryPreview, resourceLabel }),
    summary,
    toolName,
    queryPreview,
    resourceLabel,
    inputPreview,
    outputPreview
  };
}

function resolveActivityDisplayLabel(
  activityType: RuntimeActivityType,
  metadata: { toolName?: string; queryPreview?: string; resourceLabel?: string }
): string {
  switch (activityType) {
    case "web-search":
      return "Searching web";
    case "tool-call":
    case "tool":
      return metadata.toolName ? `Calling ${metadata.toolName}` : "Calling tool";
    case "document-read":
      return metadata.resourceLabel ? `Reading ${metadata.resourceLabel}` : "Reading document";
    case "file-read":
      return metadata.resourceLabel ? `Reading ${metadata.resourceLabel}` : "Reading file";
    case "browser":
      return "Browsing web";
    case "shell":
      return "Running command";
    case "api-call":
      return "Calling API";
    case "routing":
      return "Routing request";
    case "workflow":
      return "Running workflow";
    case "sub-agent":
      return "Agent activity";
    case "message":
      return "Composing response";
    case "provider-diagnostic":
      return "Provider diagnostic";
    case "handoff":
      return "Handing off task";
    case "review":
      return "Reviewing result";
    case "aggregation":
      return "Aggregating result";
    case "completion":
      return "Finalizing response";
    default:
      return "OpenClaw activity";
  }
}

function getGatewayEventName(frame: Record<string, any>): string {
  const event = frame.event || frame.type || frame.method || frame.notification?.event || frame.params?.event;
  return typeof event === "string" ? event : "";
}

function getGatewayPayload(frame: Record<string, any>): Record<string, any> {
  const payload = frame.payload || frame.params?.payload || frame.params || frame.result || frame.data || frame;
  return payload && typeof payload === "object" ? payload as Record<string, any> : {};
}

function isFrameForSession(payload: Record<string, any>, conversationId: string): boolean {
  const sessionKey = payload.sessionKey || payload.key || payload.session?.key || payload.sessionId || payload.conversationId;
  return !sessionKey || sessionKey === conversationId;
}

function isGatewayConnectChallenge(frame: Record<string, any>): boolean {
  return frame.type === "event" && frame.event === "connect.challenge";
}

function isReasoningSignal(eventName: string, payload: Record<string, any>): boolean {
  const haystack = [
    eventName,
    payload.type,
    payload.kind,
    payload.category,
    payload.activityType,
    payload.phase,
    payload.state,
    payload.status,
    payload.name,
    payload.title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(reasoning|reason|thinking|thought|planning|deliberat|reflect)\b/.test(haystack) ||
    payload.reasoning !== undefined ||
    payload.reasoningContent !== undefined ||
    payload.reasoning_content !== undefined ||
    payload.thinking !== undefined ||
    payload.thinkingContent !== undefined ||
    payload.thinking_content !== undefined;
}

function normalizeGatewayTimestamp(value: unknown): number {
  if (typeof value === "number") {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function normalizeGatewayProgressStatus(value: unknown): RuntimeActivityStatus {
  const status = String(value || "").toLowerCase();
  if (["completed", "complete", "success", "succeeded", "done"].includes(status)) return "completed";
  if (["failed", "error", "errored"].includes(status)) return "failed";
  if (["canceled", "cancelled"].includes(status)) return "canceled";
  if (["running", "in-progress", "progress", "processing"].includes(status)) return "in-progress";
  return "started";
}

function normalizeSubActivityStatus(value: unknown): RuntimeActivityStatus | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return normalizeGatewayProgressStatus(value);
}

function safeStepId(value: unknown): string {
  return String(value || "openclaw-progress")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "openclaw-progress";
}

function summarizeGatewayPayload(payload: Record<string, any>): string {
  const summary = toSafeShortText(
    payload.summary ||
      payload.message ||
      payload.details ||
      payload.text ||
      payload.status ||
      payload.state ||
      payload.phase ||
      payload.name ||
      payload.title
  );
  return summary || "OpenClaw activity";
}

function toSafeShortText(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }
  const text = redactInlineSensitiveText(sanitizeObservabilityPayload(String(value))).trim().replace(/\s+/g, " ");
  if (!text) {
    return undefined;
  }
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function redactInlineSensitiveText(value: string): string {
  return value.replace(
    /(["']?(?:bearer|api[_-]?key|password|secret|token)["']?\s*[:=]\s*["']?)[^"',}\s;]+(["']?)/gi,
    "$1[REDACTED]$2"
  );
}
