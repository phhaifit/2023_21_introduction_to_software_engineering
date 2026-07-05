import { Router, type Request, type Response } from "express";
import type {
  CreateTaskRequest,
  StartExecutionCommand,
  NormalizedRuntimeEvent,
  ConversationRepository
} from "@vcp/shared";
import type { OpenClawExecutionOrchestrator, OpenClawTaskExecutionAdapter } from "../../../features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";
import type { CreateTaskUseCase } from "../application/create-task-use-case.ts";
import type { AgentKnowledgeAskPort } from "../application/agent-knowledge-ask-port.ts";
import { CreateTaskError } from "../application/create-task-error.ts";
import { TaskValidationError } from "../domain/task.ts";
import { TaskRoutingValidationError } from "../domain/routing-validation.ts";

export type TaskOrchestrationRouterDependencies = {
  orchestrator: OpenClawExecutionOrchestrator;
  adapter: OpenClawTaskExecutionAdapter;
  conversationRepository: ConversationRepository;
  createTaskUseCase: CreateTaskUseCase;
  agentKnowledgeAskPort?: AgentKnowledgeAskPort;
};

function getRequestContext(request: Request): RequestContext {
  return (request as any).context || { requestId: request.header("x-request-id") || "unknown" };
}

export function createTaskOrchestrationRouter(
  dependencies: TaskOrchestrationRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  router.post("/tasks", async (request, response) => {
    try {
      const context = getRequestContext(request) as any;
      const routeWorkspaceId = request.params.workspaceId;

      if (!context.user?.userId) {
        response.status(401).json({
          ok: false,
          error: {
            code: "auth.unauthorized",
            message: "Authentication required."
          },
          meta: createMeta(request)
        });
        return;
      }

      if (context.workspace?.workspaceId && context.workspace.workspaceId !== routeWorkspaceId) {
        response.status(403).json({
          ok: false,
          error: {
            code: "auth.forbidden",
            message: "Workspace route does not match authenticated workspace context."
          },
          meta: createMeta(request)
        });
        return;
      }

      const body = request.body as CreateTaskRequest;
      const result = await dependencies.createTaskUseCase.execute({
        workspaceId: routeWorkspaceId as any,
        submittedByUserId: context.user.userId as any,
        prompt: body?.prompt,
        routing: body?.routing
      });

      response.status(201).json({
        ok: true,
        data: result,
        meta: createMeta(request)
      });
    } catch (error: any) {
      if (
        error instanceof TaskValidationError ||
        error instanceof TaskRoutingValidationError ||
        error instanceof CreateTaskError
      ) {
        response.status(422).json({
          ok: false,
          error: {
            code: "validation.invalid_input",
            message: error.message
          },
          meta: createMeta(request)
        });
        return;
      }

      response.status(500).json({
        ok: false,
        error: {
          code: "system.unexpected_error",
          message: error?.message || "Failed to create task."
        },
        meta: createMeta(request)
      });
    }
  });

  router.post("/tasks/agent-knowledge/ask", async (request, response) => {
    const context = getRequestContext(request) as any;
    const workspaceId = request.params.workspaceId;
    if (!context.user?.userId) {
      response.status(401).json({
        ok: false,
        error: { code: "auth.unauthorized", message: "Authentication required." },
        meta: createMeta(request)
      });
      return;
    }
    if (
      !context.workspace?.workspaceId ||
      context.workspace.workspaceId !== workspaceId
    ) {
      response.status(403).json({
        ok: false,
        error: {
          code: "auth.forbidden",
          message: "Workspace route does not match authenticated workspace context."
        },
        meta: createMeta(request)
      });
      return;
    }

    const agentId =
      typeof request.body?.agentId === "string"
        ? request.body.agentId.trim()
        : "";
    const message =
      typeof request.body?.message === "string"
        ? request.body.message.trim()
        : "";
    if (!agentId || !message) {
      response.status(422).json({
        ok: false,
        error: {
          code: "validation.invalid_input",
          message: "Agent and message are required."
        },
        meta: createMeta(request)
      });
      return;
    }
    if (!dependencies.agentKnowledgeAskPort) {
      response.status(503).json({
        ok: false,
        error: {
          code: "system.unavailable",
          message: "Assigned knowledge answering is unavailable."
        },
        meta: createMeta(request)
      });
      return;
    }

    try {
      const result = await dependencies.agentKnowledgeAskPort.ask(
        workspaceId as any,
        agentId as any,
        {
          message,
          topK: request.body?.topK,
          filters: request.body?.filters
        }
      );
      response.status(200).json({
        ok: true,
        data: result,
        meta: createMeta(request)
      });
    } catch {
      response.status(503).json({
        ok: false,
        error: {
          code: "system.unavailable",
          message: "Unable to answer from assigned knowledge right now."
        },
        meta: createMeta(request)
      });
    }
  });

  router.post("/executions/start", async (request, response) => {
    console.log(`\n[Backend API] 📥 Received POST /api/workspaces/${request.params.workspaceId}/executions/start`);
    try {
      const context = getRequestContext(request);
      const command = request.body as StartExecutionCommand;
      const result = await dependencies.orchestrator.execute10StepStartFlow(context as any, command);

      console.log(`[Backend API] ✓ Successfully executed 10-step start flow for Task ID: ${command.taskId}`);
      response.status(200).json({
        ok: true,
        data: result,
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error(`[Backend API] ❌ Failed to start execution:`, error.message);
      response.status(400).json({
        ok: false,
        error: {
          code: "execution-start-failed",
          message: error.message || "Failed to start execution"
        },
        meta: {
          requestId: getRequestContext(request).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  router.post("/executions/:taskId/cancel", async (request, response) => {
    console.log(`\n[Backend API] 📥 Received POST /api/workspaces/${request.params.workspaceId}/executions/${request.params.taskId}/cancel`);
    try {
      const context = getRequestContext(request);
      const { taskId, workspaceId } = request.params;
      await dependencies.orchestrator.forwardCancellation(context as any, taskId as any, workspaceId as any);

      console.log(`[Backend API] ✓ Successfully forwarded cancellation for Task ID: ${taskId}`);
      response.status(200).json({
        ok: true,
        data: { taskId, status: "canceled" },
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error(`[Backend API] ❌ Failed to cancel execution:`, error.message);
      response.status(400).json({
        ok: false,
        error: {
          code: "execution-cancel-failed",
          message: error.message || "Failed to cancel execution"
        },
        meta: {
          requestId: getRequestContext(request).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  router.get("/executions/:taskId/state", async (request, response) => {
    try {
      const context = getRequestContext(request);
      const { taskId } = request.params;
      const result = await dependencies.orchestrator.getExposedState(taskId as any);

      response.status(200).json({
        ok: true,
        data: result,
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      response.status(404).json({
        ok: false,
        error: {
          code: "execution-state-not-found",
          message: error.message || "Execution state not found"
        },
        meta: {
          requestId: getRequestContext(request).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  router.get("/executions/:taskId/stream", (request, response) => {
    const { taskId, workspaceId } = request.params;
    console.log(`\n[Backend API] 🔌 Client connected to SSE stream for Task ID: ${taskId} (Workspace: ${workspaceId})`);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const onEvent = (event: NormalizedRuntimeEvent) => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    dependencies.adapter.subscribe(taskId as any, onEvent);

    request.on("close", () => {
      console.log(`[Backend API] 🔌 Client disconnected from SSE stream for Task ID: ${taskId}`);
      dependencies.adapter.unsubscribe(taskId as any, onEvent);
    });
  });

  router.get("/conversations", async (request, response) => {
    console.log(`\n[Backend API] 📥 Received GET /api/workspaces/${request.params.workspaceId}/conversations`);
    try {
      const context = getRequestContext(request);
      const { workspaceId } = request.params;
      const result = await dependencies.conversationRepository.listConversationsByWorkspace(workspaceId as any);

      console.log(`[Backend API] ✓ Successfully fetched ${result.length} conversations for Workspace ID: ${workspaceId}`);
      response.status(200).json({
        ok: true,
        data: result,
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error(`[Backend API] ❌ Failed to fetch conversations:`, error.message);
      response.status(400).json({
        ok: false,
        error: {
          code: "fetch-conversations-failed",
          message: error.message || "Failed to fetch conversations"
        },
        meta: {
          requestId: getRequestContext(request).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  router.delete("/conversations/:conversationId", async (request, response) => {
    try {
      const context = getRequestContext(request);
      const { workspaceId, conversationId } = request.params;
      const conversation = await dependencies.conversationRepository.getConversation(
        conversationId as any
      );

      if (!conversation || conversation.workspaceId !== workspaceId) {
        response.status(404).json({
          ok: false,
          error: {
            code: "conversation-not-found",
            message: "Conversation not found"
          },
          meta: {
            requestId: context.requestId,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await dependencies.conversationRepository.deleteConversation(conversationId as any);
      response.status(200).json({
        ok: true,
        data: { conversationId, deleted: true },
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      response.status(400).json({
        ok: false,
        error: {
          code: "delete-conversation-failed",
          message: error.message || "Failed to delete conversation"
        },
        meta: {
          requestId: getRequestContext(request).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  router.delete("/conversations/:conversationId/turns/:taskId", async (request, response) => {
    try {
      const context = getRequestContext(request);
      const { workspaceId, conversationId, taskId } = request.params;
      const conversation = await dependencies.conversationRepository.getConversation(
        conversationId as any
      );

      if (!conversation || conversation.workspaceId !== workspaceId) {
        response.status(404).json({
          ok: false,
          error: {
            code: "conversation-not-found",
            message: "Conversation not found"
          },
          meta: {
            requestId: context.requestId,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await dependencies.conversationRepository.deleteMessages(conversationId as any, [
        taskId as any,
        `${taskId}-assistant` as any
      ]);
      response.status(200).json({
        ok: true,
        data: { conversationId, taskId, deleted: true },
        meta: {
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      response.status(400).json({
        ok: false,
        error: {
          code: "delete-conversation-turn-failed",
          message: error.message || "Failed to delete conversation turn"
        },
        meta: {
          requestId: getRequestContext(request).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  return router;
}

function createMeta(request: Request): { requestId: string; timestamp: string } {
  return {
    requestId: request.header("x-request-id") || "task-orchestration-request",
    timestamp: new Date().toISOString()
  };
}
