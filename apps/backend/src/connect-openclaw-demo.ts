import type {
  EntityId,
  StartExecutionCommand,
  WorkspaceExecutionRuntimeResolver,
  WorkspaceExecutionRuntime
} from "@vcp/shared";
import {
  OpenClawTaskExecutionAdapter,
  OpenClawExecutionOrchestrator,
  type ExternalAgentCatalog,
  type ExternalWorkflowCatalog,
  type ExternalAuthenticationService,
  type ExternalWorkspaceManagement
} from "./features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import { OpenClawHttpSSETransport } from "./features/task-execution/adapters/openclaw-network-transport.ts";

/**
 * Demo thực tế kết nối từ Task & Orchestration đến OpenClaw runtime (Docker)
 * Trình diễn luồng giao tiếp HTTP POST và Server-Sent Events (SSE) để điều phối công việc.
 */

// 1. Khởi tạo các Mock Consumer Ports mô phỏng môi trường nền tảng
class DemoAgentCatalog implements ExternalAgentCatalog {
  async validateAndGetAgent(workspaceId: EntityId<"workspaceId">, agentId: string) {
    return {
      agentId,
      workspaceId: workspaceId as string,
      providerAgentMapping: "openclaw/agent-devops-assistant",
      status: "active" as const
    };
  }
}

class DemoWorkflowCatalog implements ExternalWorkflowCatalog {
  async validateAndGetWorkflow(workspaceId: EntityId<"workspaceId">, workflowId: string) {
    return {
      workflowId,
      workspaceId: workspaceId as string,
      providerWorkflowMapping: "openclaw-workflow-ci-cd",
      status: "active" as const
    };
  }
}

class DemoAuthenticationService implements ExternalAuthenticationService {
  async getAuthenticatedPrincipal(context: Record<string, unknown>) {
    return {
      principalId: "usr_task_commander_999",
      roles: ["workspace-admin"],
      permissions: ["start-task-execution", "cancel-task-execution", "view-advanced-provider-details"]
    };
  }

  async authorizeOperation(principal: any, operation: string, workspaceId: EntityId<"workspaceId">) {
    return true;
  }
}

// 2. Mock Resolver cung cấp thông tin kết nối thực tế tới OpenClaw Docker (cổng 18789)
class DemoWorkspaceManagement implements ExternalWorkspaceManagement {
  getWorkspaceExecutionRuntimeResolver(): WorkspaceExecutionRuntimeResolver {
    return {
      async resolve(workspaceId: EntityId<"workspaceId">): Promise<WorkspaceExecutionRuntime> {
        return {
          instanceId: "inst_openclaw_docker_01" as EntityId<"instanceId">,
          workspaceId,
          provider: "openclaw",
          status: "running",
          endpointReference: "http://127.0.0.1:18789",
          credentialReference: "demo_secure_token_abc123", // Lấy từ file .env của OpenClaw
          capabilities: ["http-sse-streaming", "local-execution"]
        };
      }
    };
  }
}

// 3. Mock Fetcher mô phỏng phản hồi từ OpenClaw Gateway Docker khi khởi chạy demo
const mockGatewayFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  console.log(`\n[Network Transport API Call] ---> POST ${url}`);
  console.log(`[Headers] ---> Authorization: ${init?.headers ? (init.headers as any)["Authorization"] : "None"}`);
  console.log(`[Payload] ---> ${init?.body ? init.body : "None"}`);

  if (url.includes("/executions/start")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        providerExecutionReference: `openclaw-exec-${Date.now()}`,
        status: "accepted",
        startedAt: new Date().toISOString()
      })
    } as Response;
  }

  if (url.includes("/cancel")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        providerExecutionReference: "openclaw-exec-demo",
        status: "canceled",
        canceledAt: new Date().toISOString()
      })
    } as Response;
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({ status: "success" })
  } as Response;
};

// ============================================================================
// CHƯƠNG TRÌNH DEMO THỰC TẾ
// ============================================================================
async function runDemo() {
  console.log("================================================================================");
  console.log("🦞 BẮT ĐẦU DEMO: KẾT NỐI TASK & ORCHESTRATION VỚI OPENCLAW RUNTIME (DOCKER)");
  console.log("================================================================================\n");

  const authService = new DemoAuthenticationService();
  const workspaceMgmt = new DemoWorkspaceManagement();
  const agentCatalog = new DemoAgentCatalog();
  const workflowCatalog = new DemoWorkflowCatalog();

  // Khởi tạo Real Network Transport với mock fetcher (hoặc fetch thật nếu trỏ tới Docker đang chạy)
  const transport = new OpenClawHttpSSETransport(mockGatewayFetch);

  // Khởi tạo Adapter
  const resolver = workspaceMgmt.getWorkspaceExecutionRuntimeResolver();
  const adapter = new OpenClawTaskExecutionAdapter(resolver, agentCatalog, workflowCatalog, transport);

  // Khởi tạo Orchestrator (quản lý 10-step start flow)
  const orchestrator = new OpenClawExecutionOrchestrator(
    authService,
    workspaceMgmt,
    agentCatalog,
    workflowCatalog,
    adapter
  );

  const taskId = "tsk_demo_work_777" as EntityId<"taskId">;
  const workspaceId = "wsp_openclaw_lab" as EntityId<"workspaceId">;

  const command: StartExecutionCommand = {
    taskId,
    workId: "wrk_chat_coord_888" as EntityId<"workId">,
    workspaceId,
    conversationId: "cnv_demo_chat_111" as EntityId<"conversationId">,
    prompt: "Vui lòng phân tích log lỗi Docker và điều phối các tác vụ dọn dẹp bộ nhớ đệm.",
    routing: {
      mode: "specific-agent",
      agentId: "agent-devops-assistant"
    }
  };

  const requestContext = { ip: "127.0.0.1", userAgent: "TaskOrchestration/1.0" };

  console.log("--> [Step 1-6] Kích hoạt 10-Step Start Flow từ Orchestrator...");
  const startResult = await orchestrator.execute10StepStartFlow(requestContext, command);
  
  console.log("\n[Execution Binding Kết quả]:", JSON.stringify(startResult.binding, null, 2));

  console.log("\n--> [Step 8-9] Mô phỏng tiếp nhận luồng sự kiện SSE (Server-Sent Events) từ OpenClaw Gateway...");

  // Mô phỏng các sự kiện stream trả về từ OpenClaw Runtime
  const rawEvents = [
    {
      eventType: "progress",
      executionId: startResult.binding.providerExecutionReference,
      stepId: "step_1",
      stepName: "Tiếp nhận yêu cầu điều phối Devops",
      status: "started",
      timestamp: Date.now() + 100
    },
    {
      eventType: "progress",
      executionId: startResult.binding.providerExecutionReference,
      stepId: "step_1",
      status: "completed",
      timestamp: Date.now() + 200
    },
    {
      eventType: "partial_output",
      executionId: startResult.binding.providerExecutionReference,
      chunk: "Đã kiểm tra bộ nhớ đệm BuildKit. Bắt đầu lên lịch dọn dẹp...",
      timestamp: Date.now() + 300
    },
    {
      eventType: "completion",
      executionId: startResult.binding.providerExecutionReference,
      finalOutput: "Hoàn tất luồng công việc điều phối. Đã giải phóng 15GB dung lượng đĩa thành công.",
      timestamp: Date.now() + 400
    }
  ];

  for (const rawEvent of rawEvents) {
    // Adapter ánh xạ raw event sang NormalizedRuntimeEvent và cập nhật trạng thái
    const mappedEvent = (adapter as any).simulateIncomingProviderEvent(
      taskId,
      (adapter as any).validateAndScopeIncomingEvent ? 
        // Import mapper ngầm hoặc dùng trực tiếp ánh xạ
        {
          type: rawEvent.eventType === "progress" ? (rawEvent.status === "started" ? "step-started" : "step-completed") :
                rawEvent.eventType === "partial_output" ? "partial-output-received" : "execution-completed",
          taskId,
          stepId: rawEvent.stepId,
          stepName: rawEvent.stepName,
          result: rawEvent.status,
          outputChunk: rawEvent.chunk,
          finalOutput: rawEvent.finalOutput,
          timestamp: new Date(rawEvent.timestamp).toISOString(),
          providerExecutionReference: rawEvent.executionId
        } : null,
      rawEvent.timestamp,
      `evt_${rawEvent.timestamp}`
    );
    await new Promise(r => setTimeout(r, 50));
  }

  console.log("\n--> [Step 10] Trạng thái nhiệm vụ trên hệ thống sau khi hoàn tất luồng stream:");
  const exposedState = await orchestrator.getExposedState(taskId);
  console.log(JSON.stringify(exposedState, null, 2));

  console.log("\n--> Kiểm tra Advanced Provider Details (Phân quyền bảo mật):");
  const advDetails = await orchestrator.getAdvancedDetails(requestContext, taskId, workspaceId);
  console.log(JSON.stringify(advDetails, null, 2));

  console.log("\n================================================================================");
  console.log("🎉 KẾT THÚC DEMO: KIẾN TRÚC ADAPTER HOẠT ĐỘNG HOÀN HẢO VÀ CHUẨN XÁC!");
  console.log("================================================================================\n");
}

runDemo().catch(err => console.error("Demo failed:", err));
