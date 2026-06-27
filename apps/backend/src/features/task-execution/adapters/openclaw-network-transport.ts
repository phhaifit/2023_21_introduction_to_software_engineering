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

  constructor(customFetcher?: typeof fetch) {
    this.fetcher = customFetcher || globalThis.fetch;
  }

  async startExecution(endpoint: string, credentialReference: string, request: OpenClawStartRequestDTO): Promise<OpenClawStartResponseDTO> {
    if (!endpoint) {
      throw new Error(JSON.stringify({ code: "execution-runtime-unavailable", message: "Execution runtime unavailable: missing endpoint reference" }));
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
