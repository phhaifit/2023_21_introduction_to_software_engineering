import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  EntityId,
  StartExecutionCommand,
  WorkspaceExecutionRuntimeResolver,
  WorkspaceExecutionRuntime,
  NormalizedRuntimeEvent,
  SubActivityEvent
} from "@vcp/shared";
import { validateObservabilityProjectionRule, sanitizeObservabilityPayload } from "@vcp/shared";
import {
  OpenClawTaskExecutionAdapter,
  OpenClawExecutionOrchestrator,
  type ExternalAgentCatalog,
  type ExternalWorkflowCatalog,
  type ExternalToolCatalog,
  type ExternalAuthenticationService,
  type ExternalWorkspaceManagement
} from "./openclaw-task-execution-adapter.ts";

describe("Task & Orchestration — Integrate OpenClaw Task Execution", () => {
  let mockResolver: WorkspaceExecutionRuntimeResolver;
  let agentCatalog: ExternalAgentCatalog;
  let workflowCatalog: ExternalWorkflowCatalog;
  let toolCatalog: ExternalToolCatalog;
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
      }),
      listAvailableAgents: vi.fn().mockResolvedValue([
        {
          agentId: "agent-finance",
          workspaceId: "ws-1",
          providerAgentMapping: "openclaw-agent-agent-finance",
          status: "active",
          name: "Finance Agent",
          role: "Financial analysis",
          model: "default"
        }
      ])
    };

    workflowCatalog = {
      validateAndGetWorkflow: vi.fn().mockImplementation(async (wsId, workflowId) => {
        if (workflowId === "workflow-invalid") {
          return { workflowId, workspaceId: wsId, providerWorkflowMapping: "", status: "inactive" };
        }
        return { workflowId, workspaceId: wsId, providerWorkflowMapping: `openclaw-workflow-${workflowId}`, status: "active" };
      }),
      listAvailableWorkflows: vi.fn().mockResolvedValue([
        {
          workflowId: "wf-reports",
          workspaceId: "ws-1",
          providerWorkflowMapping: "openclaw-workflow-wf-reports",
          status: "active",
          name: "Reports Workflow",
          description: "Draft and review reports."
        }
      ])
    };

    toolCatalog = {
      validateAndGetTool: vi.fn().mockImplementation(async (wsId, toolId) => {
        if (toolId === "tool-invalid") {
          return { toolId, workspaceId: wsId, safeLabel: "", providerToolMapping: "", status: "inactive" };
        }
        return { toolId, workspaceId: wsId, safeLabel: `Safe Tool: ${toolId}`, providerToolMapping: `openclaw-tool-${toolId}`, status: "active" };
      })
    };

    authService = {
      getAuthenticatedPrincipal: vi.fn().mockResolvedValue({
        principalId: "user-1",
        roles: ["workspace-member"],
        permissions: ["start-task-execution", "cancel-task-execution", "view-advanced-provider-details"]
      }),
      authorizeOperation: vi.fn().mockImplementation(async (principal, op, wsId) => {
        if (principal.principalId === "user-unauthorized") return false;
        if (op === "view-advanced-provider-details" && principal.principalId === "user-no-advanced") return false;
        return true;
      })
    };

    workspaceMgmt = {
      getWorkspaceExecutionRuntimeResolver: () => mockResolver
    };

    adapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCatalog, workflowCatalog);
    orchestrator = new OpenClawExecutionOrchestrator(authService, workspaceMgmt, agentCatalog, workflowCatalog, adapter, toolCatalog);
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
      expect(binding.verifiedProviderFields.target).toBe("openclaw/default");
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
      expect(binding.verifiedProviderFields.target).toBe("openclaw/default");
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
      expect(binding.verifiedProviderFields.target).toBe("openclaw/default");
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
    it("3.1 & 3.2 & 3.3: should implement explicit runtime unavailable behavior ensuring that when valid Task submitted for real execution and no running execution runtime can be resolved, Task & Orchestration returns normalized execution-unavailable failure, SHALL NOT provision runtime, and SHALL NOT silently switch to local substitute execution", async () => {
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
      await expect(unavailAdapter.startExecution(cmd)).rejects.toThrow(/it SHALL NOT provision a runtime AND it SHALL NOT silently switch to local substitute execution/);
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

  describe("6. Extend OpenClaw Execution Observability", () => {
    it("1.1 & 1.2 & 1.3: should extend NormalizedRuntimeEvent union to support optional presentation of routing activity, workflow activity, tool activity, sub-agent activity, handoff, review, aggregation, completion, and provider diagnostics, and enforce projection-only boundary", () => {
      const activities: Array<SubActivityEvent["activityType"]> = [
        "routing",
        "workflow",
        "tool",
        "sub-agent",
        "handoff",
        "review",
        "aggregation",
        "completion",
        "provider-diagnostic"
      ];

      for (const activityType of activities) {
        const event: SubActivityEvent = {
          type: "sub-activity",
          taskId: "task-601" as EntityId<"taskId">,
          activityType,
          details: `Activity update for ${activityType}`,
          rawProviderPayload: { meta: "test" },
          timestamp: new Date().toISOString(),
          workspaceId: "ws-1" as EntityId<"workspaceId">,
          workId: "work-601" as EntityId<"workId">,
          providerExecutionReference: "exec-601",
          providerSessionReference: "sess-601"
        };
        expect(event.activityType).toBe(activityType);
        expect(event.workspaceId).toBe("ws-1");
      }

      // Verify projection-only boundary validation
      expect(() => validateObservabilityProjectionRule({ createsTool: true })).toThrow(/Task & Orchestration SHALL act strictly as an observability projection consumer/);
      expect(() => validateObservabilityProjectionRule({ assignsTool: true })).toThrow(/Task & Orchestration SHALL act strictly as an observability projection consumer/);
      expect(() => validateObservabilityProjectionRule({ createsSubAgent: true })).toThrow(/Task & Orchestration SHALL act strictly as an observability projection consumer/);
      expect(() => validateObservabilityProjectionRule({ controlsInternalOrchestration: true })).toThrow(/Task & Orchestration SHALL act strictly as an observability projection consumer/);
      expect(() => validateObservabilityProjectionRule({ createsWorkflow: true })).toThrow(/Task & Orchestration SHALL act strictly as an observability projection consumer/);
      expect(() => validateObservabilityProjectionRule({ infersUnprovidedEvents: true })).toThrow(/Task & Orchestration SHALL act strictly as an observability projection consumer/);
      expect(() => validateObservabilityProjectionRule({})).not.toThrow();
    });

    it("2.1 & 2.2 & 2.3: should implement graceful degradation validation ensuring canonical Task lifecycle remains functional without optional observability events, and verify event-scoping isolation boundaries", async () => {
      const cmd: StartExecutionCommand = {
        taskId: "task-602" as EntityId<"taskId">,
        workId: "work-602" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Graceful degradation test",
        routing: { mode: "auto" }
      };

      await orchestrator.execute10StepStartFlow({ authHeader: "valid" }, cmd);
      const degradationCheck = await orchestrator.verifyGracefulDegradation("task-602" as EntityId<"taskId">);
      expect(degradationCheck.canonicalLifecycleFunctional).toBe(true);
      expect(degradationCheck.absenceTriggersFailure).toBe(false);

      // Verify event-scoping isolation boundaries
      const validEvent: SubActivityEvent = {
        type: "sub-activity",
        taskId: "task-602" as EntityId<"taskId">,
        activityType: "tool",
        details: "Tool used",
        timestamp: new Date().toISOString(),
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        workId: "work-602" as EntityId<"workId">,
        providerExecutionReference: "openclaw-exec-123",
        providerSessionReference: "sess-1"
      };

      const expectedScope = {
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        taskId: "task-602" as EntityId<"taskId">,
        workId: "work-602" as EntityId<"workId">,
        providerExecutionReference: "openclaw-exec-123",
        providerSessionReference: "sess-1"
      };

      expect(adapter.validateAndScopeIncomingEvent(validEvent, expectedScope)).toBe(true);
      expect(adapter.validateAndScopeIncomingEvent({ ...validEvent, taskId: "task-other" as EntityId<"taskId"> }, expectedScope)).toBe(false);
      expect(adapter.validateAndScopeIncomingEvent({ ...validEvent, workspaceId: "ws-other" as EntityId<"workspaceId"> }, expectedScope)).toBe(false);
      expect(adapter.validateAndScopeIncomingEvent({ ...validEvent, workId: "work-other" as EntityId<"workId"> }, expectedScope)).toBe(false);
      expect(adapter.validateAndScopeIncomingEvent({ ...validEvent, providerExecutionReference: "exec-other" }, expectedScope)).toBe(false);
      expect(adapter.validateAndScopeIncomingEvent({ ...validEvent, providerSessionReference: "sess-other" }, expectedScope)).toBe(false);
    });

    it("3.1 & 3.2 & 3.3: should implement automated security redaction filters scrubbing raw credentials, API keys, system paths, and sensitive provider payloads, and implement permission-gated authorization checks for Advanced Details", async () => {
      // Test security redaction filters
      const rawPayload = {
        meta: "exec-update",
        apiKey: "AIzaSyD-sensitive-key-value",
        bearer: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        password: "supersecretpassword",
        systemPath: "C:\\Users\\admin\\secrets\\config.json",
        nested: {
          token: "secret-token-123",
          path: "/etc/passwd"
        }
      };

      const sanitized = sanitizeObservabilityPayload(rawPayload);
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.bearer).toBe("[REDACTED]");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.systemPath).toContain("[REDACTED_PATH]");
      expect(sanitized.nested.token).toBe("[REDACTED]");
      expect(sanitized.nested.path).toBe("[REDACTED_PATH]");

      // Test permission-gated Advanced Details
      const cmd: StartExecutionCommand = {
        taskId: "task-603" as EntityId<"taskId">,
        workId: "work-603" as EntityId<"workId">,
        workspaceId: "ws-1" as EntityId<"workspaceId">,
        conversationId: "conv-1" as EntityId<"conversationId">,
        prompt: "Advanced details test",
        routing: { mode: "auto" }
      };

      await orchestrator.execute10StepStartFlow({ authHeader: "valid" }, cmd);

      // Authorized principal
      const authorizedDetails = await orchestrator.getAdvancedDetails({ authHeader: "valid" }, "task-603" as EntityId<"taskId">, "ws-1" as EntityId<"workspaceId">);
      expect(authorizedDetails.authorized).toBe(true);
      expect(authorizedDetails.providerReferences).toBeDefined();
      expect(authorizedDetails.providerReferences?.runtimeInstanceId).toBe("inst-openclaw-1");

      // Unauthorized principal (lacks view-advanced-provider-details permission)
      const unauthorizedAuthContext = {
        getAuthenticatedPrincipal: vi.fn().mockResolvedValue({ principalId: "user-no-advanced", roles: [], permissions: [] }),
        authorizeOperation: vi.fn().mockResolvedValue(false)
      };
      const unauthOrchestrator = new OpenClawExecutionOrchestrator(unauthorizedAuthContext, workspaceMgmt, agentCatalog, workflowCatalog, adapter, toolCatalog);
      // Need to execute start flow or set binding in unauthOrchestrator to test getAdvancedDetails
      // But since it's unauthorized, getAdvancedDetails returns early before checking binding!
      const unauthDetails = await unauthOrchestrator.getAdvancedDetails({ authHeader: "unauth" }, "task-603" as EntityId<"taskId">, "ws-1" as EntityId<"workspaceId">);
      expect(unauthDetails.authorized).toBe(false);
      expect(unauthDetails.providerReferences).toBeNull();
    });

    it("4.1 & 4.2: should define conceptual consumer ports for Tool, Agent, and Workflow metadata catalogs and verify external catalog consumption confirming administration remains outside scope", async () => {
      const labels = await orchestrator.resolveActivitySafeLabels("ws-1" as EntityId<"workspaceId">, {
        agentId: "agent-finance",
        workflowId: "wf-reports",
        toolId: "tool-calc"
      });

      expect(labels.agentLabel).toBe("Agent: agent-finance");
      expect(labels.workflowLabel).toBe("Workflow: wf-reports");
      expect(labels.toolLabel).toBe("Safe Tool: tool-calc");

      // Verify inactive/invalid tool handling
      const invalidLabels = await orchestrator.resolveActivitySafeLabels("ws-1" as EntityId<"workspaceId">, {
        toolId: "tool-invalid"
      });
      expect(invalidLabels.toolLabel).toBe("Inactive Tool: tool-invalid");
    });

    it("5.1 & 5.2 & 5.3: should verify cross-change dependency order documentation, out-of-scope compliance, and production execution boundary", () => {
      const dependencyOrder = orchestrator.verifyCrossChangeDependencyOrder();
      expect(dependencyOrder.orderValid).toBe(true);
      expect(dependencyOrder.dependencies).toContain("extend-openclaw-execution-observability");
      expect(dependencyOrder.dependencies).toContain("integrate-openclaw-task-execution");

      const outOfScope = orchestrator.verifyOutOfScopeCompliance();
      expect(outOfScope.noRuntimeProvisioning).toBe(true);
      expect(outOfScope.noContainerCreation).toBe(true);
      expect(outOfScope.noSecretOwnership).toBe(true);
      expect(outOfScope.noDirectApiInvocations).toBe(true);

      const productionBoundary = orchestrator.verifyProductionExecutionBoundary();
      expect(productionBoundary.openClawGatewayRequired).toBe(true);
      expect(productionBoundary.noSilentFallbackFromProduction).toBe(true);
    });
  });

  describe("7. OpenClaw Network Transport Adapter Integration", () => {
    it("4.1 & 4.2: should inject OpenClawNetworkTransport into OpenClawTaskExecutionAdapter and consume OpenAI-compatible provider events", async () => {
      const mockTransport = {
        startExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-net-1", status: "started", startedAt: "2023-01-01" }),
        cancelExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-net-1", status: "canceled", canceledAt: "2023-01-01" }),
        subscribeEventStream: vi.fn().mockImplementation((endpoint, cred, execRef, onEvent, onError) => {
          setTimeout(() => {
            onEvent({
              object: "chat.completion.chunk",
              executionId: execRef,
              openclaw_extension: {
                stepId: "step-net-1",
                stepName: "Network Step",
                status: "started"
              },
              timestamp: Date.now()
            });
          }, 10);
          return { unsubscribe: vi.fn() };
        }),
        getSnapshot: vi.fn().mockResolvedValue({ status: "in-progress" })
      };

      const mockResolver: any = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-openclaw-1",
          endpointReference: "https://openclaw.workspace.internal/api/v1",
          credentialReference: "cred-ref-789",
          status: "running"
        })
      };

      const agentCat: any = { validateAndGetAgent: vi.fn().mockResolvedValue({ status: "active", providerAgentMapping: "agent-1" }) };
      const workflowCat: any = { validateAndGetWorkflow: vi.fn().mockResolvedValue({ status: "active", providerWorkflowMapping: "wf-1" }) };

      const netAdapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCat, workflowCat, mockTransport as any);

      const cmd: any = {
        taskId: "task-net-101",
        workId: "work-101",
        workspaceId: "ws-1",
        conversationId: "conv-1",
        prompt: "Network integration test",
        routing: { mode: "auto" }
      };

      const binding = await netAdapter.startExecution(cmd);
      expect(binding.providerExecutionReference).toBe("exec-net-1");
      expect(mockTransport.startExecution).toHaveBeenCalled();
      expect(mockTransport.subscribeEventStream).toHaveBeenCalled();

      // Wait for simulated stream event to be processed
      await new Promise(resolve => setTimeout(resolve, 30));
      const snap = await netAdapter.getExecutionSnapshot("task-net-101" as any);
      expect(snap.lastObservedEvent?.type).toBe("step-started");
      expect((snap.lastObservedEvent as any).stepName).toBe("Network Step");

      // Test cancelExecution forwarding via transport
      await netAdapter.cancelExecution("task-net-101" as any);
      expect(mockTransport.cancelExecution).toHaveBeenCalledWith(
        "https://openclaw.workspace.internal/api/v1",
        "cred-ref-789",
        { providerExecutionReference: "exec-net-1", taskId: "task-net-101" }
      );

      await netAdapter.releaseResources();
    });

    it("4.1: should pass all available agents and workflows when auto routing is selected", async () => {
      const mockTransport = {
        startExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-auto-1", status: "started", startedAt: "2023-01-01" }),
        cancelExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-auto-1", status: "canceled", canceledAt: "2023-01-01" }),
        subscribeEventStream: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        getSnapshot: vi.fn().mockResolvedValue({ status: "in-progress" })
      };
      const mockResolver: any = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-openclaw-1",
          endpointReference: "https://openclaw.workspace.internal/api/v1",
          credentialReference: "cred-ref-789",
          status: "running"
        })
      };
      const agentCat: any = {
        validateAndGetAgent: vi.fn(),
        listAvailableAgents: vi.fn().mockResolvedValue([
          {
            status: "active",
            providerAgentMapping: "openclaw/agent-research",
            agentId: "agent-research",
            name: "Research Agent",
            role: "Market researcher",
            model: "default"
          }
        ])
      };
      const workflowCat: any = {
        validateAndGetWorkflow: vi.fn(),
        listAvailableWorkflows: vi.fn().mockResolvedValue([
          {
            status: "active",
            providerWorkflowMapping: "openclaw/workflow/workflow-research",
            workflowId: "workflow-research",
            name: "Research Workflow",
            description: "Research then synthesize."
          }
        ])
      };
      const netAdapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCat, workflowCat, mockTransport as any);

      await netAdapter.startExecution({
        taskId: "task-auto-101" as any,
        workId: "work-auto-101" as any,
        workspaceId: "ws-1" as any,
        conversationId: "conv-auto-1" as any,
        prompt: "Auto route this research task",
        routing: { mode: "auto" }
      });

      expect(agentCat.listAvailableAgents).toHaveBeenCalledWith("ws-1");
      expect(workflowCat.listAvailableWorkflows).toHaveBeenCalledWith("ws-1");
      expect(mockTransport.startExecution).toHaveBeenCalledWith(
        "https://openclaw.workspace.internal/api/v1",
        "cred-ref-789",
        expect.objectContaining({
          target: "openclaw/default",
          mode: "auto",
          routingInstruction: expect.stringContaining("Available workspace agents: Research Agent")
        })
      );
      expect(mockTransport.startExecution.mock.calls[0][2].routingInstruction).toContain("openclaw/workflow/workflow-research");
    });

    it("4.1: should pass selected specific-agent mapping and routing instruction to OpenClaw transport", async () => {
      const mockTransport = {
        startExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-agent-1", status: "started", startedAt: "2023-01-01" }),
        cancelExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-agent-1", status: "canceled", canceledAt: "2023-01-01" }),
        subscribeEventStream: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        getSnapshot: vi.fn().mockResolvedValue({ status: "in-progress" })
      };
      const mockResolver: any = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-openclaw-1",
          endpointReference: "https://openclaw.workspace.internal/api/v1",
          credentialReference: "cred-ref-789",
          status: "running"
        })
      };
      const agentCat: any = {
        validateAndGetAgent: vi.fn().mockResolvedValue({
          status: "active",
          providerAgentMapping: "openclaw/agent-research",
          agentId: "agent-research",
          name: "Research Agent",
          role: "Market researcher",
          model: "gemini-2.5-flash",
          instructions: "Track market signals."
        })
      };
      const workflowCat: any = { validateAndGetWorkflow: vi.fn() };
      const netAdapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCat, workflowCat, mockTransport as any);

      await netAdapter.startExecution({
        taskId: "task-agent-101" as any,
        workId: "work-agent-101" as any,
        workspaceId: "ws-1" as any,
        conversationId: "conv-agent-1" as any,
        prompt: "Research market size",
        routing: { mode: "specific-agent", agentId: "agent-research" }
      });

      expect(mockTransport.startExecution).toHaveBeenCalledWith(
        "https://openclaw.workspace.internal/api/v1",
        "cred-ref-789",
        expect.objectContaining({
          target: "openclaw/default",
          openClawAgentId: "agent-research",
          mode: "specific-agent",
          targetLabel: "Research Agent",
          routingInstruction: expect.stringContaining("OpenClaw agent reference: openclaw/agent-research")
        })
      );
    });

    it("4.1: should pass selected workflow mapping and routing instruction to OpenClaw transport", async () => {
      const mockTransport = {
        startExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-workflow-1", status: "started", startedAt: "2023-01-01" }),
        cancelExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-workflow-1", status: "canceled", canceledAt: "2023-01-01" }),
        subscribeEventStream: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        getSnapshot: vi.fn().mockResolvedValue({ status: "in-progress" })
      };
      const mockResolver: any = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-openclaw-1",
          endpointReference: "https://openclaw.workspace.internal/api/v1",
          credentialReference: "cred-ref-789",
          status: "running"
        })
      };
      const agentCat: any = { validateAndGetAgent: vi.fn() };
      const workflowCat: any = {
        validateAndGetWorkflow: vi.fn().mockResolvedValue({
          status: "active",
          providerWorkflowMapping: "openclaw/workflow/workflow-research",
          workflowId: "workflow-research",
          name: "Research Workflow",
          description: "Research then synthesize."
        })
      };
      const netAdapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCat, workflowCat, mockTransport as any);

      await netAdapter.startExecution({
        taskId: "task-workflow-101" as any,
        workId: "work-workflow-101" as any,
        workspaceId: "ws-1" as any,
        conversationId: "conv-workflow-1" as any,
        prompt: "Prepare a research brief",
        routing: { mode: "predefined-workflow", workflowId: "workflow-research" }
      });

      expect(mockTransport.startExecution).toHaveBeenCalledWith(
        "https://openclaw.workspace.internal/api/v1",
        "cred-ref-789",
        expect.objectContaining({
          target: "openclaw/default",
          mode: "predefined-workflow",
          targetLabel: "Research Workflow",
          routingInstruction: expect.stringContaining("OpenClaw workflow reference: openclaw/workflow/workflow-research")
        })
      );
    });

    it("4.3 & 4.4 & 4.5: should preserve duplicate/stale event protections and snapshot reconciliation behavior with injected OpenClaw transport", async () => {
      const mockTransport = {
        startExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-net-2", status: "started", startedAt: "2023-01-01" }),
        cancelExecution: vi.fn().mockResolvedValue({ providerExecutionReference: "exec-net-2", status: "canceled", canceledAt: "2023-01-01" }),
        subscribeEventStream: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        getSnapshot: vi.fn().mockResolvedValue({ status: "in-progress" })
      };

      const mockResolver: any = {
        resolve: vi.fn().mockResolvedValue({
          provider: "openclaw",
          instanceId: "inst-openclaw-1",
          endpointReference: "https://openclaw.workspace.internal/api/v1",
          credentialReference: "cred-ref-789",
          status: "running"
        })
      };

      const agentCat: any = { validateAndGetAgent: vi.fn().mockResolvedValue({ status: "active", providerAgentMapping: "agent-1" }) };
      const workflowCat: any = { validateAndGetWorkflow: vi.fn().mockResolvedValue({ status: "active", providerWorkflowMapping: "wf-1" }) };

      const netAdapter = new OpenClawTaskExecutionAdapter(mockResolver, agentCat, workflowCat, mockTransport as any);

      const cmd: any = {
        taskId: "task-net-102",
        workId: "work-102",
        workspaceId: "ws-1",
        conversationId: "conv-1",
        prompt: "Duplicate/stale and reconciliation test",
        routing: { mode: "auto" }
      };

      await netAdapter.startExecution(cmd);

      // Trigger snapshot reconciliation via handleTransportReconnection without explicit snapshot (should call transport.getSnapshot)
      await netAdapter.handleTransportReconnection("task-net-102" as any);
      expect(mockTransport.getSnapshot).toHaveBeenCalledWith("https://openclaw.workspace.internal/api/v1", "cred-ref-789", "exec-net-2");

      // Verify duplicate and stale protections are fully active
      const now = Date.now();
      netAdapter.simulateIncomingProviderEvent("task-net-102" as any, { type: "partial-output-received", taskId: "task-net-102" as any, outputChunk: "First", timestamp: new Date(now).toISOString() }, now, "evt-unique-1");
      netAdapter.simulateIncomingProviderEvent("task-net-102" as any, { type: "partial-output-received", taskId: "task-net-102" as any, outputChunk: "Duplicate", timestamp: new Date(now).toISOString() }, now, "evt-unique-1"); // Duplicate unique ID
      netAdapter.simulateIncomingProviderEvent("task-net-102" as any, { type: "partial-output-received", taskId: "task-net-102" as any, outputChunk: "Stale", timestamp: new Date(now - 5000).toISOString() }, now - 5000, "evt-unique-2"); // Stale timestamp

      const snap = await netAdapter.getExecutionSnapshot("task-net-102" as any);
      expect((snap.lastObservedEvent as any).outputChunk).toBe("First");
    });
  });
});
