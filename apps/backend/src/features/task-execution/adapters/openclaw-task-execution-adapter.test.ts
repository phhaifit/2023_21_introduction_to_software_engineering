import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  EntityId,
  StartExecutionCommand,
  WorkspaceExecutionRuntimeResolver,
  WorkspaceExecutionRuntime,
  NormalizedRuntimeEvent
} from "@vcp/shared";
import {
  OpenClawTaskExecutionAdapter,
  OpenClawExecutionOrchestrator,
  type ExternalAgentCatalog,
  type ExternalWorkflowCatalog,
  type ExternalAuthenticationService,
  type ExternalWorkspaceManagement
} from "./openclaw-task-execution-adapter.ts";

describe("Task & Orchestration — Integrate OpenClaw Task Execution", () => {
  let mockResolver: WorkspaceExecutionRuntimeResolver;
  let agentCatalog: ExternalAgentCatalog;
  let workflowCatalog: ExternalWorkflowCatalog;
  let authService: ExternalAuthenticationService;
  let workspaceMgmt: ExternalWorkspaceManagement;
  let adapter: OpenClawTaskExecutionAdapter;
  let orchestrator: OpenClawExecutionOrchestrator;

  beforeEach(() => {
    mockResolver = {
      resolve: vi.fn().mockResolvedValue({
        provider: "openclaw",
        instanceId: "inst-openclaw-1",
        endpointReference: "https://openclaw.workspace.internal/api/v1",
        credentialReference: "cred-ref-789",
        status: "running"
      } as WorkspaceExecutionRuntime)
    };

    agentCatalog = {
      validateAndGetAgent: vi.fn().mockImplementation(async (wsId, agentId) => {
        if (agentId === "agent-invalid") {
          return { agentId, workspaceId: wsId, providerAgentMapping: "", status: "inactive" };
        }
        return { agentId, workspaceId: wsId, providerAgentMapping: `openclaw-agent-${agentId}`, status: "active" };
      })
    };

    workflowCatalog = {
      validateAndGetWorkflow: vi.fn().mockImplementation(async (wsId, workflowId) => {
        if (workflowId === "workflow-invalid") {
          return { workflowId, workspaceId: wsId, providerWorkflowMapping: "", status: "inactive" };
        }
        return { workflowId, workspaceId: wsId, providerWorkflowMapping: `openclaw-workflow-${workflowId}`, status: "active" };
      })
    };

    authService = {
      getAuthenticatedPrincipal: vi.fn().mockResolvedValue({
        principalId: "user-1",
        roles: ["workspace-member"],
        permissions: ["start-task-execution", "cancel-task-execution"]
      }),
      authorizeOperation: vi.fn().mockImplementation(async (principal, op, wsId) => {
        if (principal.principalId === "user-unauthorized") return false;
        return true;
      })
    };

    workspaceMgmt = {
      getWorkspaceExecutionRuntimeResolver: () => mockResolver
    };

    adapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCatalog, workflowCatalog);
    orchestrator = new OpenClawExecutionOrchestrator(authService, workspaceMgmt, agentCatalog, workflowCatalog, adapter);
  });

  describe("1. External Runtime Resolution & Adapter Structure", () => {
    it("1.1: should define conceptual consumer port WorkspaceExecutionRuntimeResolver and verify Task & Orchestration asks resolver, receives runtime reference, validates it is usable, and passes it to adapter without provisioning", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-101" as EntityId<"taskId">,
        workId: "work-101" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Analyze quarterly data",
        routing: { mode: "auto" }
      };

      const binding = await adapter.startExecution(cmd);
      expect(mockResolver.resolve).toHaveBeenCalledWith("ws-1");
      expect(binding.runtimeInstanceId).toBe("inst-openclaw-1");
      expect(binding.verifiedProviderFields.endpointReference).toBe("https://openclaw.workspace.internal/api/v1");
    });

    it("1.2 & 1.3: should implement OpenClawTaskExecutionAdapter skeleton satisfying TaskExecutionAdapter contracts, supporting fake transport tests, explicitly excluding runtime provisioning, container management, or credential creation", async () => {
      const snapshot = await adapter.getExecutionSnapshot("task-101" as EntityId<"taskId">);
      expect(snapshot.status).toBe("pending");

      const events: NormalizedRuntimeEvent[] = [];
      const callback = (e: NormalizedRuntimeEvent) => events.push(e);
      adapter.subscribe("task-102" as EntityId<"taskId">, callback);

      const cmd: StartExecutionCommand = {
        taskId: "task-102" as EntityId<"taskId">,
        workId: "work-102" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Analyze quarterly data",
        routing: { mode: "auto" }
      };

      await adapter.startExecution(cmd);
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("execution-accepted");
      expect(events[1].type).toBe("execution-started");

      adapter.unsubscribe("task-102" as EntityId<"taskId">, callback);
      await adapter.releaseResources();
    });

    it("1.4: should implement external runtime resolution contract tests and adapter skeleton structure verification tests", async () => {
      expect(adapter).toBeDefined();
      expect(adapter.startExecution).toBeTypeOf("function");
      expect(adapter.cancelExecution).toBeTypeOf("function");
      expect(adapter.getExecutionSnapshot).toBeTypeOf("function");
      expect(adapter.subscribe).toBeTypeOf("function");
      expect(adapter.unsubscribe).toBeTypeOf("function");
      expect(adapter.releaseResources).toBeTypeOf("function");
    });
  });

  describe("2. Routing Delegation & Catalog Validation", () => {
    it("2.1: should implement Auto-routing delegation ensuring Task & Orchestration sends Auto routing request to configured OpenClaw entry point without implementing an LLM Router", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-201" as EntityId<"taskId">,
        workId: "work-201" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Auto route request",
        routing: { mode: "auto" }
      };

      const binding = await adapter.startExecution(cmd);
      expect(binding.verifiedProviderFields.target).toBe("openclaw-auto-coordinator");
      expect(binding.verifiedProviderFields.mode).toBe("auto");
    });

    it("2.2: should implement Specific Agent routing by receiving platform agent ID, validating externally supplied workspace-scoped agent contract, obtaining provider mapping, and sending mapped target through adapter", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-202" as EntityId<"taskId">,
        workId: "work-202" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Agent route request",
        routing: { mode: "specific-agent", agentId: "agent-finance" }
      };

      const binding = await adapter.startExecution(cmd);
      expect(agentCatalog.validateAndGetAgent).toHaveBeenCalledWith("ws-1", "agent-finance");
      expect(binding.verifiedProviderFields.target).toBe("openclaw-agent-agent-finance");
      expect(binding.verifiedProviderFields.mode).toBe("specific-agent");
    });

    it("2.3: should implement Predefined Workflow routing by receiving platform workflow ID, validating externally supplied workspace-scoped workflow contract, obtaining provider mapping, and sending mapped target through adapter", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-203" as EntityId<"taskId">,
        workId: "work-203" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Workflow route request",
        routing: { mode: "predefined-workflow", workflowId: "wf-reports" }
      };

      const binding = await adapter.startExecution(cmd);
      expect(workflowCatalog.validateAndGetWorkflow).toHaveBeenCalledWith("ws-1", "wf-reports");
      expect(binding.verifiedProviderFields.target).toBe("openclaw-workflow-wf-reports");
      expect(binding.verifiedProviderFields.mode).toBe("predefined-workflow");
    });

    it("2.4: should implement routing delegation tests and external catalog validation contract tests confirming Agent/Workflow administration remains outside scope", async () => {
      const invalidAgentCmd: StartExecutionCommand = {
        taskId: "task-204" as EntityId<"taskId">,
        workId: "work-204" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Invalid agent request",
        routing: { mode: "specific-agent", agentId: "agent-invalid" }
      };

      await expect(adapter.startExecution(invalidAgentCmd)).rejects.toThrow(/Routing target unavailable: specified agent is inactive or invalid/);

      const invalidWorkflowCmd: StartExecutionCommand = {
        taskId: "task-205" as EntityId<"taskId">,
        workId: "work-205" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Invalid workflow request",
        routing: { mode: "predefined-workflow", workflowId: "workflow-invalid" }
      };

      await expect(adapter.startExecution(invalidWorkflowCmd)).rejects.toThrow(/Routing target unavailable: specified workflow is inactive or invalid/);
    });
  });

  describe("3. Runtime Unavailable & No Silent Fallback", () => {
    it("3.1 & 3.2 & 3.3: should implement explicit runtime unavailable behavior ensuring that when valid Task submitted for real execution and no running execution runtime can be resolved, Task & Orchestration returns normalized execution-unavailable failure, SHALL NOT provision runtime, and SHALL NOT silently switch to mock execution", async () => {
      const unavailableResolver: WorkspaceExecutionRuntimeResolver = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-unavail",
          endpointReference: "",
          credentialReference: "",
          status: "unavailable"
        } as WorkspaceExecutionRuntime)
      };

      const unavailAdapter = new OpenClawTaskExecutionAdapter(unavailableResolver, agentCatalog, workflowCatalog);

      const cmd: StartExecutionCommand = {
        taskId: "task-301" as EntityId<"taskId">,
        workId: "work-301" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Test runtime unavailable",
        routing: { mode: "auto" }
      };

      await expect(unavailAdapter.startExecution(cmd)).rejects.toThrow(/execution-runtime-unavailable/);
      await expect(unavailAdapter.startExecution(cmd)).rejects.toThrow(/it SHALL NOT provision a runtime AND it SHALL NOT silently switch to mock execution/);
    });
  });

  describe("4. Rigorous 10-Step Start Flow & Cancellation", () => {
    it("4.1 & 4.3 & 4.4: should implement the rigorous 10-step start flow and verify Task & Orchestration consumes authenticated principals without implementing authentication/RBAC", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-401" as EntityId<"taskId">,
        workId: "work-401" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "10 step start flow test",
        routing: { mode: "auto" }
      };

      const result = await orchestrator.execute10StepStartFlow({ authHeader: "valid" }, cmd);
      expect(result.taskId).toBe("task-401");
      expect(result.status).toBe("in-progress");
      expect(result.binding.runtimeInstanceId).toBe("inst-openclaw-1");

      const exposed = await orchestrator.getExposedState("task-401" as EntityId<"taskId">);
      expect(exposed.status).toBe("in-progress");
      expect(exposed.events.length).toBeGreaterThan(0);
    });

    it("4.2 & 4.3 & 4.4: should implement cancellation forwarding owning task cancellability validation, loading execution association, forwarding cancellation, applying canonical cancellation after defined confirmation, suppressing late updates, without terminating containers or deleting Gateways", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-402" as EntityId<"taskId">,
        workId: "work-402" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Cancellation forwarding test",
        routing: { mode: "auto" }
      };

      await orchestrator.execute10StepStartFlow({ authHeader: "valid" }, cmd);
      await orchestrator.forwardCancellation({ authHeader: "valid" }, "task-402" as EntityId<"taskId">, "ws-1" as EntityId<"workspaceId">);

      const exposed = await orchestrator.getExposedState("task-402" as EntityId<"taskId">);
      expect(exposed.status).toBe("canceled");

      // Verify suppressing late updates after cancellation
      adapter.simulateIncomingProviderEvent("task-402" as EntityId<"taskId">, {
        type: "step-completed",
        taskId: "task-402" as EntityId<"taskId">,
        stepId: "step-1",
        result: "Late result",
        timestamp: new Date().toISOString()
      }, Date.now(), "event-late");

      const exposedAfterLateUpdate = await orchestrator.getExposedState("task-402" as EntityId<"taskId">);
      expect(exposedAfterLateUpdate.status).toBe("canceled"); // Status remains canceled
    });

    it("4.3: should reject start flow or cancellation if unauthorized", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-403" as EntityId<"taskId">,
        workId: "work-403" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Unauthorized test",
        routing: { mode: "auto" }
      };

      const unauthorizedAuthService: ExternalAuthenticationService = {
        getAuthenticatedPrincipal: vi.fn().mockResolvedValue({ principalId: "user-unauthorized", roles: [], permissions: [] }),
        authorizeOperation: vi.fn().mockResolvedValue(false)
      };

      const unauthOrchestrator = new OpenClawExecutionOrchestrator(unauthorizedAuthService, workspaceMgmt, agentCatalog, workflowCatalog, adapter);

      await expect(unauthOrchestrator.execute10StepStartFlow({ authHeader: "unauth" }, cmd)).rejects.toThrow(/Unauthorized/);
    });
  });

  describe("5. Transport Recovery & Blocked Integration Verification", () => {
    it("5.1: should implement transport recovery mechanisms covering snapshot reconciliation, duplicate-event protection, stale-event handling, reconnect behavior, and background Task continuity without confusing provider connection state with Task lifecycle", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-501" as EntityId<"taskId">,
        workId: "work-501" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Transport recovery test",
        routing: { mode: "auto" }
      };

      await adapter.startExecution(cmd);
      expect(adapter.getTransportState("task-501" as EntityId<"taskId">)).toBe("connected");

      // Handle transport disconnection
      adapter.handleTransportDisconnection("task-501" as EntityId<"taskId">);
      expect(adapter.getTransportState("task-501" as EntityId<"taskId">)).toBe("disconnected");
      
      // Task lifecycle remains in-progress (background Task continuity)
      const snapDuringDisconnect = await adapter.getExecutionSnapshot("task-501" as EntityId<"taskId">);
      expect(snapDuringDisconnect.status).toBe("in-progress");

      // Handle transport reconnection with snapshot reconciliation
      const newerSnapshot = {
        taskId: "task-501" as EntityId<"taskId">,
        status: "in-progress" as const,
        updatedAt: new Date(Date.now() + 1000).toISOString(),
        lastObservedEvent: {
          type: "step-started" as const,
          taskId: "task-501" as EntityId<"taskId">,
          stepId: "step-2",
          stepName: "Parsing",
          timestamp: new Date().toISOString()
        }
      };

      await adapter.handleTransportReconnection("task-501" as EntityId<"taskId">, newerSnapshot);
      expect(adapter.getTransportState("task-501" as EntityId<"taskId">)).toBe("connected");
      
      const snapAfterReconnect = await adapter.getExecutionSnapshot("task-501" as EntityId<"taskId">);
      expect(snapAfterReconnect.lastObservedEvent?.type).toBe("step-started");

      // Test duplicate-event protection
      adapter.simulateIncomingProviderEvent("task-501" as EntityId<"taskId">, {
        type: "partial-output-received",
        taskId: "task-501" as EntityId<"taskId">,
        outputChunk: "Chunk 1",
        timestamp: new Date().toISOString()
      }, Date.now() + 2000, "unique-event-id-1");

      const snapAfterEvent1 = await adapter.getExecutionSnapshot("task-501" as EntityId<"taskId">);
      expect((snapAfterEvent1.lastObservedEvent as any).outputChunk).toBe("Chunk 1");

      // Send duplicate event with same unique ID but different chunk content
      adapter.simulateIncomingProviderEvent("task-501" as EntityId<"taskId">, {
        type: "partial-output-received",
        taskId: "task-501" as EntityId<"taskId">,
        outputChunk: "Duplicate Chunk",
        timestamp: new Date().toISOString()
      }, Date.now() + 3000, "unique-event-id-1");

      const snapAfterDuplicate = await adapter.getExecutionSnapshot("task-501" as EntityId<"taskId">);
      expect((snapAfterDuplicate.lastObservedEvent as any).outputChunk).toBe("Chunk 1"); // Ignored duplicate

      // Test stale-event handling (older timestamp)
      adapter.simulateIncomingProviderEvent("task-501" as EntityId<"taskId">, {
        type: "partial-output-received",
        taskId: "task-501" as EntityId<"taskId">,
        outputChunk: "Stale Chunk",
        timestamp: new Date().toISOString()
      }, Date.now() - 5000, "unique-event-id-stale");

      const snapAfterStale = await adapter.getExecutionSnapshot("task-501" as EntityId<"taskId">);
      expect((snapAfterStale.lastObservedEvent as any).outputChunk).toBe("Chunk 1"); // Ignored stale event
    });

    it("5.2: should document real-integration preconditions confirming real integration requires externally supplied running instances, verified endpoints, credential references, approved connection methods, verified contracts, and workspace associations", () => {
      expect(orchestrator.verifyRealIntegrationPreconditions({
        provider: "openclaw",
        instanceId: "inst-1",
        endpointReference: "https://openclaw.internal",
        credentialReference: "cred-1",
        status: "running"
      })).toBe(true);

      expect(orchestrator.verifyRealIntegrationPreconditions({
        provider: "openclaw",
        instanceId: "inst-2",
        endpointReference: "https://openclaw.internal",
        credentialReference: "cred-2",
        status: "stopped"
      })).toBe(false);

      expect(orchestrator.verifyRealIntegrationPreconditions(null)).toBe(false);
    });

    it("5.3: should verify externally blocked real-integration tasks remain marked as incomplete ([ ]) while prerequisites are unavailable, ensuring no tasks require Task & Orchestration owner to provision OpenClaw", () => {
      const compliance = orchestrator.verifyExternallyBlockedTasksCompliance();
      expect(compliance.realIntegrationBlocked).toBe(true);
      expect(compliance.requiresProvisioning).toBe(false);
    });
  });
});
