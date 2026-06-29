import { Router, type Request, type Response } from "express";
import type { StartExecutionCommand, NormalizedRuntimeEvent, ConversationRepository } from "@vcp/shared";
import type { OpenClawExecutionOrchestrator, OpenClawTaskExecutionAdapter } from "../../../features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";

export type TaskOrchestrationRouterDependencies = {
  orchestrator: OpenClawExecutionOrchestrator;
  adapter: OpenClawTaskExecutionAdapter;
  conversationRepository: ConversationRepository;
};

function getRequestContext(request: Request): RequestContext {
  return (request as any).context || { requestId: request.header("x-request-id") || "unknown" };
}

export function createTaskOrchestrationRouter(
  dependencies: TaskOrchestrationRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

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
