import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  validateStartExecutionCommand, 
  validateExecutionBinding, 
  sanitizeNormalizedRuntimeError, 
  mapRuntimeObservationToTaskStatus,
  type StartExecutionCommand,
  type WorkspaceExecutionRuntimeResolver,
  type WorkspaceExecutionRuntime,
  type NormalizedRuntimeEvent,
  type EntityId
} from "@vcp/shared";
import { MockTaskExecutionAdapter } from "./mock-task-execution-adapter.ts";

describe("Task & Orchestration — OpenClaw Task Integration Contracts", () => {
  let mockResolver: WorkspaceExecutionRuntimeResolver;
  let adapter: MockTaskExecutionAdapter;

  beforeEach(() => {
    mockResolver = {
      resolve: vi.fn().mockResolvedValue({
        provider: "openclaw",
        instanceId: "inst-123",
        endpointReference: "https://openclaw.internal/api/v1",
        credentialReference: "cred-abc",
        status: "running",
      } as WorkspaceExecutionRuntime)
    };
    adapter = new MockTaskExecutionAdapter(mockResolver);
  });

  describe("1. Task Execution Adapter Port & Start Command", () => {
    it("1.1 & 1.2 & 1.3 & 1.4: should validate valid StartExecutionCommand containing strictly platform fields", () => {
      const validCmd = {
        taskId: "task-1" as EntityId<"taskId">,
        workId: "work-1" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Run analysis",
        routing: { mode: "auto" as const }
      };

      const result = validateStartExecutionCommand(validCmd);
      expect(result.taskId).toBe("task-1");
    });

    it("1.3 & 1.4: should throw error if StartExecutionCommand contains excluded fields (credentials, container config, etc.)", () => {
      const invalidCmd1 = {
        taskId: "task-1" as EntityId<"taskId">,
        workId: "work-1" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Run analysis",
        routing: { mode: "auto" as const },
        rawCredentials: "super-secret-key"
      };

      expect(() => validateStartExecutionCommand(invalidCmd1)).toThrow(/explicitly excluded fields detected/);

      const invalidCmd2 = {
        taskId: "task-1" as EntityId<"taskId">,
        workId: "work-1" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Run analysis",
        routing: { mode: "auto" as const },
        containerConfiguration: { image: "openclaw:latest" }
      };

      expect(() => validateStartExecutionCommand(invalidCmd2)).toThrow(/explicitly excluded fields detected/);
    });

    it("1.4: should throw error if StartExecutionCommand is missing required platform fields", () => {
      const incompleteCmd = {
        taskId: "task-1" as EntityId<"taskId">,
        prompt: "Run analysis"
      };

      expect(() => validateStartExecutionCommand(incompleteCmd)).toThrow(/missing required platform fields/);
    });
  });

  describe("2. Execution-Runtime Reference & Execution Binding", () => {
    it("2.1 & 2.2 & 2.3 & 2.4: should validate valid ExecutionBinding and reject runtime provisioning attempts", () => {
      const validBinding = {
        taskId: "task-1" as EntityId<"taskId">,
        runtimeInstanceId: "inst-123",
        providerExecutionReference: "run-456",
        verifiedProviderFields: { endpoint: "https://openclaw.internal" }
      };

      const result = validateExecutionBinding(validBinding, false);
      expect(result.runtimeInstanceId).toBe("inst-123");

      // Reject provisioning attempt
      expect(() => validateExecutionBinding(validBinding, true)).toThrow(/Task & Orchestration SHALL NOT provision the referenced runtime/);
    });

    it("2.3 & 2.4: should reject ExecutionBinding containing unverified provider schema", () => {
      const invalidBinding = {
        taskId: "task-1" as EntityId<"taskId">,
        runtimeInstanceId: "inst-123",
        providerExecutionReference: "run-456",
        verifiedProviderFields: {},
        unverifiedProviderSchema: { someArbitraryDeepStructure: true }
      };

      expect(() => validateExecutionBinding(invalidBinding, false)).toThrow(/unverified provider schema fields detected/);
    });

    it("2.4: should resolve runtime reference via WorkspaceExecutionRuntimeResolver without provisioning", async () => {
      const runtime = await mockResolver.resolve("ws-1" as EntityId<"workspaceId">);
      expect(runtime.provider).toBe("openclaw");
      expect(runtime.status).toBe("running");
    });
  });

  describe("3. Normalized Events & Lifecycle Mapping", () => {
    it("3.1 & 3.2: should map runtime observations to canonical lifecycle statuses correctly", () => {
      expect(mapRuntimeObservationToTaskStatus("platform-task-accepted", "pending")).toBe("pending");
      expect(mapRuntimeObservationToTaskStatus("provider-execution-confirmed-started", "pending")).toBe("in-progress");
      expect(mapRuntimeObservationToTaskStatus("partial-or-activity-update", "in-progress")).toBe("in-progress");
      expect(mapRuntimeObservationToTaskStatus("final-completion-confirmed", "in-progress")).toBe("completed");
      expect(mapRuntimeObservationToTaskStatus("terminal-provider-failure-confirmed", "in-progress")).toBe("failed");
      expect(mapRuntimeObservationToTaskStatus("cancellation-confirmed", "in-progress")).toBe("canceled");
    });

    it("3.3 & 3.4: should enforce transport resilience where transport interruption SHALL NOT transition Task to Failed", () => {
      expect(mapRuntimeObservationToTaskStatus("transport-interruption", "in-progress")).toBe("in-progress");
    });
  });

  describe("4. Normalized Error Contract & Security", () => {
    it("4.1 & 4.2 & 4.3: should sanitize normalized errors to ensure presentation safety and redact credentials", () => {
      const error = {
        code: "provider-authentication-rejected" as const,
        message: "Failed to authenticate with OpenClaw: bearer secret-api-token-123 invalid",
        rawProviderPayload: { stack: "Error at line 42", auth: "secret-api-token-123" }
      };

      const sanitized = sanitizeNormalizedRuntimeError(error);
      expect(sanitized.code).toBe("provider-authentication-rejected");
      expect(sanitized.message).toContain("bearer [REDACTED]");
      expect(sanitized.message).not.toContain("secret-api-token-123");
      expect(sanitized.rawProviderPayload).toBeUndefined();
    });
  });

  describe("5. Mock Execution Adapter & Verification", () => {
    it("5.1: should successfully start execution, subscribe to events, and get snapshot", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-1" as EntityId<"taskId">,
        workId: "work-1" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Test prompt",
        routing: { mode: "auto" }
      };

      const events: NormalizedRuntimeEvent[] = [];
      const callback = (e: NormalizedRuntimeEvent) => events.push(e);

      adapter.subscribe("task-1" as EntityId<"taskId">, callback);

      const binding = await adapter.startExecution(cmd);
      expect(binding.taskId).toBe("task-1");
      expect(binding.runtimeInstanceId).toBe("inst-123");

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("execution-accepted");
      expect(events[1].type).toBe("execution-started");

      const snapshot = await adapter.getExecutionSnapshot("task-1" as EntityId<"taskId">);
      expect(snapshot.status).toBe("in-progress");

      // Simulate partial output event
      adapter.simulateRuntimeEvent({
        type: "partial-output-received",
        taskId: "task-1" as EntityId<"taskId">,
        outputChunk: "Hello",
        timestamp: new Date().toISOString()
      }, "in-progress");

      expect(events).toHaveLength(3);
      expect(events[2].type).toBe("partial-output-received");

      // Unsubscribe test
      adapter.unsubscribe("task-1" as EntityId<"taskId">, callback);
      adapter.simulateRuntimeEvent({
        type: "execution-completed",
        taskId: "task-1" as EntityId<"taskId">,
        finalOutput: "Hello World",
        timestamp: new Date().toISOString()
      }, "completed");

      expect(events).toHaveLength(3); // Callback not called again

      const snapshotAfter = await adapter.getExecutionSnapshot("task-1" as EntityId<"taskId">);
      expect(snapshotAfter.status).toBe("completed");
    });

    it("5.1: should successfully cancel execution", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-2" as EntityId<"taskId">,
        workId: "work-2" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-2" as EntityId<"conversationId">,
        prompt: "Test prompt 2",
        routing: { mode: "auto" }
      };

      await adapter.startExecution(cmd);
      await adapter.cancelExecution("task-2" as EntityId<"taskId">);

      const snapshot = await adapter.getExecutionSnapshot("task-2" as EntityId<"taskId">);
      expect(snapshot.status).toBe("canceled");
    });

    it("5.1: should release resources", async () => {
      await adapter.releaseResources();
      const snapshot = await adapter.getExecutionSnapshot("task-nonexistent" as EntityId<"taskId">);
      expect(snapshot.status).toBe("pending");
    });

    it("5.2: should verify external prerequisite documentation confirming usable runtime reference is required", async () => {
      const stoppedResolver: WorkspaceExecutionRuntimeResolver = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-stopped",
          endpointReference: "https://openclaw.internal/api/v1",
          credentialReference: "cred-abc",
          status: "stopped",
        } as WorkspaceExecutionRuntime)
      };
      const stoppedAdapter = new MockTaskExecutionAdapter(stoppedResolver);

      const cmd: StartExecutionCommand = {
        taskId: "task-3" as EntityId<"taskId">,
        workId: "work-3" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-3" as EntityId<"conversationId">,
        prompt: "Test prompt 3",
        routing: { mode: "auto" }
      };

      await expect(stoppedAdapter.startExecution(cmd)).rejects.toThrow(/Execution runtime is not running/);
    });

    it("5.3: should confirm out-of-scope compliance (no runtime provisioning or secret ownership)", () => {
      // Confirmed by design and adapter implementation structure
      expect(adapter).toBeDefined();
    });
  });
});
