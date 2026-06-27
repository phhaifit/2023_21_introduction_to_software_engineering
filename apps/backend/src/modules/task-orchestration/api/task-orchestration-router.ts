import { Router, type Request, type Response } from "express";
import type { StartExecutionCommand, NormalizedRuntimeEvent } from "@vcp/shared";
import type { OpenClawExecutionOrchestrator, OpenClawTaskExecutionAdapter } from "../../../features/task-execution/adapters/openclaw-task-execution-adapter.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";

export type TaskOrchestrationRouterDependencies = {
  orchestrator: OpenClawExecutionOrchestrator;
  adapter: OpenClawTaskExecutionAdapter;
};

function getRequestContext(request: Request): RequestContext {
  return (request as any).context || { requestId: request.header("x-request-id") || "unknown" };
}

export function createTaskOrchestrationRouter(
  dependencies: TaskOrchestrationRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  router.post("/start", async (request, response) => {
    console.log(`\n[Backend API] 📥 Received POST /api/workspaces/${request.params.workspaceId}/executions/start`);
    console.log(`[Backend API] Request Body:`, JSON.stringify(request.body));
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

  router.post("/:taskId/cancel", async (request, response) => {
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

  router.get("/:taskId/state", async (request, response) => {
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

  router.get("/:taskId/stream", (request, response) => {
    const { taskId, workspaceId } = request.params;
    console.log(`\n[Backend API] 🔌 Client connected to SSE stream for Task ID: ${taskId} (Workspace: ${workspaceId})`);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const onEvent = (event: NormalizedRuntimeEvent) => {
      console.log(`[Backend API] 📤 Streaming event to client:`, JSON.stringify(event));
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    dependencies.adapter.subscribe(taskId as any, onEvent);

    request.on("close", () => {
      console.log(`[Backend API] 🔌 Client disconnected from SSE stream for Task ID: ${taskId}`);
      dependencies.adapter.unsubscribe(taskId as any, onEvent);
    });
  });

  return router;
}
